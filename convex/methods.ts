import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const httpMethodValidator = v.union(
  v.literal("GET"),
  v.literal("get"),
  v.literal("POST"),
  v.literal("post"),
  v.literal("PUT"),
  v.literal("put"),
  v.literal("DELETE"),
  v.literal("delete"),
  v.literal("PATCH"),
  v.literal("patch"),
  v.literal("OPTIONS"),
  v.literal("options"),
);

const inputValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  active: v.optional(v.boolean()),
});

const methodVariableValidator = v.union(
  v.object({
    type: v.literal("literal"),
    name: v.string(),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    value: v.any(),
  }),
  v.object({
    type: v.literal("function"),
    name: v.string(),
    description: v.optional(v.string()),
    active: v.optional(v.boolean()),
    url: v.string(),
    method: httpMethodValidator,
    payload: v.any(),
    headers: v.record(v.string(), v.string()),
    extractedVars: v.optional(
      v.array(v.object({
        path: v.string(),
        varName: v.string(),
        description: v.optional(v.string()),
        active: v.optional(v.boolean()),
      })),
    ),
  }),
);

const methodDocumentValidator = v.object({
  _id: v.id("methods"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  modelId: v.id("models"),
  prompt: v.string(),
  outputFormat: v.string(),
  inputs: v.array(inputValidator),
  settings: v.optional(v.any()),
  variables: v.array(methodVariableValidator),
});

function serializeTemplateValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function getValueByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

function interpolateString(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key: string) => {
    const value = getValueByPath(context, key);
    return value === undefined ? match : serializeTemplateValue(value);
  });
}

function interpolateAny(value: unknown, context: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return interpolateString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => interpolateAny(item, context));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = interpolateAny(item, context);
    }
    return result;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

type RunMethodResponse = {
  methodName: string;
  prompt: string;
  resolvedVariables: Record<string, unknown>;
  output: unknown;
  model: {
    name: string;
    code: string;
  };
};

export const list = query({
  args: {},
  returns: v.array(methodDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("methods").order("desc").collect();
  },
});

export const getById = query({
  args: {
    id: v.id("methods"),
  },
  returns: v.union(methodDocumentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByName = query({
  args: {
    name: v.string(),
  },
  returns: v.union(methodDocumentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("methods")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    modelId: v.id("models"),
    prompt: v.string(),
    outputFormat: v.string(),
    inputs: v.array(inputValidator),
    settings: v.optional(v.any()),
    variables: v.array(methodVariableValidator),
  },
  returns: v.id("methods"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("methods")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      throw new Error(`Method with name "${args.name}" already exists`);
    }

    const model = await ctx.db.get(args.modelId);
    if (!model) {
      throw new Error("Model not found");
    }

    return await ctx.db.insert("methods", {
      name: args.name,
      description: args.description,
      modelId: args.modelId,
      prompt: args.prompt,
      outputFormat: args.outputFormat,
      inputs: args.inputs,
      settings: args.settings,
      variables: args.variables,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("methods"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    modelId: v.optional(v.id("models")),
    prompt: v.optional(v.string()),
    outputFormat: v.optional(v.string()),
    inputs: v.optional(v.array(inputValidator)),
    settings: v.optional(v.any()),
    variables: v.optional(v.array(methodVariableValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) {
      throw new Error("Method not found");
    }

    if (args.name && args.name !== current.name) {
      const duplicate = await ctx.db
        .query("methods")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .unique();
      if (duplicate) {
        throw new Error(`Method with name "${args.name}" already exists`);
      }
    }

    if (args.modelId) {
      const model = await ctx.db.get(args.modelId);
      if (!model) {
        throw new Error("Model not found");
      }
    }

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.modelId !== undefined) patch.modelId = args.modelId;
    if (args.prompt !== undefined) patch.prompt = args.prompt;
    if (args.outputFormat !== undefined) patch.outputFormat = args.outputFormat;
    if (args.inputs !== undefined) patch.inputs = args.inputs;
    if (args.settings !== undefined) patch.settings = args.settings;
    if (args.variables !== undefined) patch.variables = args.variables;
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.id, patch);
    }
    return null;
  },
});

export const testFunction = action({
  args: {
    url: v.string(),
    method: httpMethodValidator,
    payload: v.any(),
    headers: v.record(v.string(), v.string()),
    context: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const context = args.context ?? {};
    const resolvedUrl = interpolateString(args.url, context);
    const resolvedHeaders = interpolateAny(args.headers, context) as Record<string, string>;
    const resolvedPayload = interpolateAny(args.payload, context);
    const methodUpper = args.method.toUpperCase();
    const shouldSendBody = methodUpper !== "GET" && methodUpper !== "DELETE";

    const response = await fetch(resolvedUrl, {
      method: methodUpper,
      headers: {
        "Content-Type": "application/json",
        ...resolvedHeaders,
      },
      body: shouldSendBody ? JSON.stringify(resolvedPayload) : undefined,
    });

    const parsed = await parseResponse(response);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${serializeTemplateValue(parsed)}`,
      );
    }
    return parsed;
  },
});

export const remove = mutation({
  args: {
    id: v.id("methods"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const runMethod = action({
  args: {
    methodName: v.string(),
    inputData: v.any(),
  },
  returns: v.object({
    methodName: v.string(),
    prompt: v.string(),
    resolvedVariables: v.record(v.string(), v.any()),
    output: v.any(),
    model: v.object({
      name: v.string(),
      code: v.string(),
    }),
  }),
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
    const finalPrompt = `${interpolatedPrompt}\n\nФормат выходных данных ${method.outputFormat}`;

    const modelResponse = await fetch("https://api.openai.com/v1/responses", {
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

    const output = await parseResponse(modelResponse);
    if (!modelResponse.ok) {
      throw new Error(
        `Model "${model.name}" request failed with ${modelResponse.status}: ${serializeTemplateValue(output)}`,
      );
    }

    const resolvedOutput =
      isRecord(output) && typeof output.output_text === "string" ? output.output_text : output;

    return {
      methodName: method.name,
      prompt: finalPrompt,
      resolvedVariables,
      output: resolvedOutput,
      model: {
        name: model.name,
        code: model.code,
      },
    };
  },
});
