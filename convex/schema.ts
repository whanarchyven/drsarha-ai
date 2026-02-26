import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
const roleValidator = v.union(v.literal("admin"), v.literal("moderator"));

export default defineSchema({
  ...authTables,
  userRoles: defineTable({
    userId: v.id("users"),
    role: roleValidator,
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"]),
  models: defineTable({
    name: v.string(),
    code: v.optional(v.string()),
  }).index("by_name", ["name"]),
  methods: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    modelId: v.id("models"),
    prompt: v.string(),
    outputFormat: v.string(),
    inputs: v.array(
      v.object({
        name: v.string(),
        description: v.optional(v.string()),
        active: v.optional(v.boolean()),
      }),
    ),
    settings: v.optional(v.any()),
    variables: v.array(
      v.union(
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
          method: v.union(
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
          ),
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
      ),
    ),
  }).index("by_name", ["name"]),
  numbers: defineTable({
    value: v.number(),
  }),
});
