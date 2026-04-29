"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { openaiFetch } from "./openaiFetch";
import {
  getValueByPath,
  interpolateAny,
  interpolateString,
  isRecord,
  parseResponse,
  serializeTemplateValue,
  type RunMethodResponse,
} from "./methodShared";

export const runMethod = action({
  args: {
    methodName: v.string(),
    inputData: v.any(),
  },
  returns: v.union(
    v.object({
      methodName: v.string(),
      prompt: v.string(),
      resolvedVariables: v.record(v.string(), v.any()),
      output: v.any(),
      model: v.object({
        name: v.string(),
        code: v.string(),
      }),
    }),
    v.object({
      output: v.any(),
      outputOnly: v.literal(true),
    }),
  ),
  handler: async (ctx, args): Promise<RunMethodResponse> => {
    const method: Doc<"methods"> | null = await ctx.runQuery(api.methods.getByName, {
      name: args.methodName,
    });
    if (!method) {
      throw new Error(`Method "${args.methodName}" not found`);
    }

    const model: Doc<"models"> | null = await ctx.runQuery(api.models.getById, {
      id: method.modelId,
    });
    if (!model) {
      throw new Error(`Model for method "${method.name}" not found`);
    }
    if (!model.code) {
      throw new Error(`Model "${model.name}" does not have OpenAI model code`);
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const inputData: Record<string, unknown> =
      args.inputData && typeof args.inputData === "object" && !Array.isArray(args.inputData)
        ? (args.inputData as Record<string, unknown>)
        : {};

    const resolvedVariables: Record<string, unknown> = {};
    for (const variable of method.variables) {
      if (variable.type === "literal") {
        resolvedVariables[variable.name] = variable.value;
      }
    }

    const functionVariables = method.variables.filter((variable) => variable.type === "function");
    const baseContext = { ...inputData, ...resolvedVariables };

    const functionResults = await Promise.all(
      functionVariables.map(async (variable) => {
        const functionMethod = variable.method.toUpperCase();
        const resolvedUrl = interpolateString(variable.url, baseContext);
        const resolvedHeaders = interpolateAny(variable.headers, baseContext) as Record<string, string>;
        const resolvedPayload = interpolateAny(variable.payload, baseContext);
        const shouldSendBody = functionMethod !== "GET" && functionMethod !== "DELETE";

        const response = await fetch(resolvedUrl, {
          method: functionMethod,
          headers: {
            "Content-Type": "application/json",
            ...resolvedHeaders,
          },
          body: shouldSendBody ? JSON.stringify(resolvedPayload) : undefined,
        });

        const parsed = await parseResponse(response);
        if (!response.ok) {
          throw new Error(
            `Function variable "${variable.name}" failed with ${response.status}: ${serializeTemplateValue(parsed)}`,
          );
        }
        return {
          name: variable.name,
          value: parsed,
          extractedVars: variable.extractedVars ?? [],
        };
      }),
    );

    for (const result of functionResults) {
      resolvedVariables[result.name] = result.value;
      const responseObj = isRecord(result.value) ? result.value : null;
      for (const { path, varName } of result.extractedVars) {
        if (responseObj) {
          const val = getValueByPath(responseObj, path);
          if (val !== undefined) {
            resolvedVariables[varName] = val;
          }
        }
      }
    }

    const promptContext: Record<string, unknown> = { ...inputData, ...resolvedVariables };
    const interpolatedPrompt = interpolateString(method.prompt, promptContext);
    const modelType = model.type ?? "text";

    let output: unknown;
    let resolvedOutput: unknown;
    let finalPrompt: string;

    if (modelType === "image") {
      finalPrompt = interpolatedPrompt;
      const isDallE = /^dall-e-/.test(model.code ?? "");
      const imageBody: Record<string, unknown> = {
        model: model.code,
        prompt: finalPrompt,
        n: 1,
      };
      if (isDallE) {
        imageBody.response_format = "url";
        imageBody.size = "1024x1024";
      }
      const imageResponse = await openaiFetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify(imageBody),
      });

      output = await parseResponse(imageResponse);
      if (!imageResponse.ok) {
        throw new Error(
          `Model "${model.name}" request failed with ${imageResponse.status}: ${serializeTemplateValue(output)}`,
        );
      }

      const data = isRecord(output) && Array.isArray((output as { data?: unknown }).data)
        ? (output as { data: Array<{ url?: string; b64_json?: string }> }).data
        : [];
      const first = data[0];
      resolvedOutput = first?.url ?? first?.b64_json ?? output;
    } else {
      finalPrompt = `${interpolatedPrompt}\n\nФормат выходных данных ${method.outputFormat}`;
      const modelResponse = await openaiFetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: model.code,
          input: finalPrompt,
        }),
      });

      output = await parseResponse(modelResponse);
      if (!modelResponse.ok) {
        throw new Error(
          `Model "${model.name}" request failed with ${modelResponse.status}: ${serializeTemplateValue(output)}`,
        );
      }

      resolvedOutput =
        isRecord(output) && typeof (output as { output_text?: string }).output_text === "string"
          ? (output as { output_text: string }).output_text
          : output;
    }

    const fullResponse = {
      methodName: method.name,
      prompt: finalPrompt,
      resolvedVariables,
      output: resolvedOutput,
      model: {
        name: model.name,
        code: model.code,
      },
    };

    const outputField = method.outputField?.trim();
    if (outputField) {
      const extracted = getValueByPath(fullResponse as unknown as Record<string, unknown>, outputField);
      const outputValue = extracted !== undefined ? extracted : resolvedOutput;
      return {
        output: outputValue,
        outputOnly: true as const,
      };
    }

    return fullResponse;
  },
});
