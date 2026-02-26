import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { createAccount } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

const roleValidator = v.union(v.literal("admin"), v.literal("moderator"));

type CtxWithDb = QueryCtx | MutationCtx;

async function getRoleForUser(ctx: CtxWithDb, userId: Id<"users">): Promise<"admin" | "moderator" | null> {
  const roleDoc = await ctx.db
    .query("userRoles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return roleDoc?.role ?? null;
}

export const getMyRole = query({
  args: {},
  returns: v.union(roleValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return getRoleForUser(ctx, userId);
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      role: v.union(roleValidator, v.null()),
      isCurrentUser: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const role = await getRoleForUser(ctx, userId);
    if (role !== "admin") return [];

    const users = await ctx.db.query("users").collect();
    const roleDocs = await ctx.db.query("userRoles").collect();
    const roleMap = new Map(roleDocs.map((r) => [r.userId, r.role]));

    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: roleMap.get(u._id) ?? null,
      isCurrentUser: u._id === userId,
    }));
  },
});

export const create = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const role = await ctx.runQuery(api.users.getMyRole);
    if (role !== "admin") throw new Error("Требуется роль admin");
    const emailTrimmed = args.email.trim().toLowerCase();
    if (!emailTrimmed) throw new Error("Email обязателен");
    if (!args.password || args.password.length < 8) throw new Error("Пароль минимум 8 символов");

    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: emailTrimmed, secret: args.password },
      profile: { email: emailTrimmed },
    });
    return user._id;
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(roleValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Не авторизован");
    const callerRole = await getRoleForUser(ctx, callerId);
    if (callerRole !== "admin") throw new Error("Требуется роль admin");

    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (args.role === null) {
      if (existing) await ctx.db.delete(existing._id);
    } else {
      if (existing) {
        await ctx.db.patch(existing._id, { role: args.role });
      } else {
        await ctx.db.insert("userRoles", { userId: args.userId, role: args.role });
      }
    }
    return null;
  },
});

export const remove = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Не авторизован");
    const callerRole = await getRoleForUser(ctx, callerId);
    if (callerRole !== "admin") throw new Error("Требуется роль admin");
    if (args.userId === callerId) throw new Error("Нельзя удалить себя");

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Пользователь не найден");

    const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    for (const session of sessions) {
      const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", session._id)).collect();
      for (const token of tokens) await ctx.db.delete(token._id);
      await ctx.db.delete(session._id);
    }

    const userAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", args.userId))
      .collect();
    for (const account of userAccounts) {
      const codes = await ctx.db.query("authVerificationCodes").withIndex("accountId", (q) => q.eq("accountId", account._id)).collect();
      for (const code of codes) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }

    const roleDoc = await ctx.db.query("userRoles").withIndex("by_user", (q) => q.eq("userId", args.userId)).unique();
    if (roleDoc) await ctx.db.delete(roleDoc._id);

    await ctx.db.delete(args.userId);
    return null;
  },
});
