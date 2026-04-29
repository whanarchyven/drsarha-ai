import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import {
  httpMethodValidator,
  inputValidator,
  methodDocumentValidator,
  methodVariableValidator,
  interpolateAny,
  interpolateString,
  parseResponse,
  serializeTemplateValue,
} from "./methodShared";

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
    outputField: v.optional(v.string()),
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
      outputField: args.outputField,
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
    outputField: v.optional(v.string()),
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
    if (args.outputField !== undefined) patch.outputField = args.outputField;
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
      throw new Error(`HTTP ${response.status}: ${serializeTemplateValue(parsed)}`);
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
