import { v } from "convex/values";

export const httpMethodValidator = v.union(
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

export const inputValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  active: v.optional(v.boolean()),
});

export const methodVariableValidator = v.union(
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
      v.array(
        v.object({
          path: v.string(),
          varName: v.string(),
          description: v.optional(v.string()),
          active: v.optional(v.boolean()),
        }),
      ),
    ),
  }),
);

export const methodDocumentValidator = v.object({
  _id: v.id("methods"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  modelId: v.id("models"),
  prompt: v.string(),
  outputFormat: v.string(),
  outputField: v.optional(v.string()),
  inputs: v.array(inputValidator),
  settings: v.optional(v.any()),
  variables: v.array(methodVariableValidator),
});

export function serializeTemplateValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function getValueByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc === undefined || acc === null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[segment];
  }, source);
}

export function interpolateString(template: string, context: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (match, key: string) => {
    const value = getValueByPath(context, key);
    return value === undefined ? match : serializeTemplateValue(value);
  });
}

export function interpolateAny(value: unknown, context: Record<string, unknown>): unknown {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json();
  }
  return await response.text();
}

export type RunMethodResponse =
  | {
      methodName: string;
      prompt: string;
      resolvedVariables: Record<string, unknown>;
      output: unknown;
      model: { name: string; code: string };
    }
  | { output: unknown; outputOnly: true };
