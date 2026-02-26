import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * One-time migration: converts old methods format to new schema.
 * Run from Convex dashboard: mutations.migrations.migrateMethodsToNewSchema
 */
export const migrateMethodsToNewSchema = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const methods = await ctx.db.query("methods").collect();
    let count = 0;
    for (const doc of methods) {
      const raw = doc as unknown as Record<string, unknown>;
      const inputs = raw.inputs;
      const variables = raw.variables;

      let needsPatch = false;
      const patch: Record<string, unknown> = {};

      if (Array.isArray(inputs) && inputs.length > 0) {
        const first = inputs[0];
        if (typeof first === "string") {
          patch.inputs = inputs.map((s: string) => ({ name: s, description: "", active: true }));
          needsPatch = true;
        } else {
          const hasMissingActive = (inputs as Array<Record<string, unknown>>).some((i) => !("active" in i));
          if (hasMissingActive) {
            patch.inputs = inputs.map((i: Record<string, unknown>) => ({ ...i, active: "active" in i ? i.active : true }));
            needsPatch = true;
          }
        }
      }

      if (Array.isArray(variables) && variables.length > 0) {
        let needsVarPatch = false;
        const migrated = variables.map((variable: Record<string, unknown>) => {
          const copy = { ...variable };
          if (!("description" in copy)) { copy.description = ""; needsVarPatch = true; }
          if (!("active" in copy)) { copy.active = true; needsVarPatch = true; }
          if (variable.type === "function") {
            if (!("extractedVars" in copy)) copy.extractedVars = [];
            else {
              const evs = copy.extractedVars as Array<Record<string, unknown>>;
              const needsEvPatch = evs.some((ev) => !("description" in ev) || !("active" in ev));
              if (needsEvPatch) {
                copy.extractedVars = evs.map((ev) => ({
                  ...ev,
                  description: "description" in ev ? ev.description : "",
                  active: "active" in ev ? ev.active : true,
                }));
                needsVarPatch = true;
              }
            }
          }
          return copy;
        });
        if (needsVarPatch) {
          patch.variables = migrated;
          needsPatch = true;
        }
      }

      if (!("description" in raw) || raw.description === undefined) {
        patch.description = "";
        needsPatch = true;
      }

      if (needsPatch) {
        await ctx.db.patch(doc._id, patch);
        count++;
      }
    }
    return count;
  },
});

/**
 * Set user as admin by email. Run from Convex dashboard: mutations.migrations.setAdminByEmail
 * Example: { "email": "admin@example.com" }
 */
export const setAdminByEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const emailNorm = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", emailNorm))
      .unique();
    if (!user) throw new Error(`User with email ${args.email} not found`);
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { role: "admin" });
    } else {
      await ctx.db.insert("userRoles", { userId: user._id, role: "admin" });
    }
    return null;
  },
});
