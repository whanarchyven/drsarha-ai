import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const modelDocumentValidator = v.object({
  _id: v.id("models"),
  _creationTime: v.number(),
  name: v.string(),
  code: v.optional(v.string()),
});

export const list = query({
  args: {},
  returns: v.array(modelDocumentValidator),
  handler: async (ctx) => {
    return await ctx.db.query("models").order("desc").collect();
  },
});

export const getById = query({
  args: {
    id: v.id("models"),
  },
  returns: v.union(modelDocumentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByName = query({
  args: {
    name: v.string(),
  },
  returns: v.union(modelDocumentValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("models")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
  },
  returns: v.id("models"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("models")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      throw new Error(`Model with name "${args.name}" already exists`);
    }

    return await ctx.db.insert("models", {
      name: args.name,
      code: args.code,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("models"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.id);
    if (!current) {
      throw new Error("Model not found");
    }

    if (args.name && args.name !== current.name) {
      const duplicate = await ctx.db
        .query("models")
        .withIndex("by_name", (q) => q.eq("name", args.name!))
        .unique();
      if (duplicate) {
        throw new Error(`Model with name "${args.name}" already exists`);
      }
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      code: args.code,
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    id: v.id("models"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});
