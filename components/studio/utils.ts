"use client";

import JSON5 from "json5";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function safeParseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    try {
      return { ok: true, value: JSON5.parse(text) };
    } catch (json5Error) {
      return {
        ok: false,
        error:
          json5Error instanceof Error
            ? json5Error.message
            : error instanceof Error
              ? error.message
              : "Некорректный JSON",
      };
    }
  }
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function tokenStyle(token: string): { backgroundColor: string; color: string; borderColor: string } {
  const hue = hashToken(token) % 360;
  return {
    backgroundColor: `hsla(${hue}, 90%, 60%, 0.20)`,
    color: `hsl(${hue}, 70%, 30%)`,
    borderColor: `hsla(${hue}, 90%, 50%, 0.45)`,
  };
}

export function extractPromptTokens(prompt: string): Array<string> {
  const tokens = new Set<string>();
  const regex = /{{\s*([\w.]+)\s*}}/g;
  for (const match of prompt.matchAll(regex)) {
    if (match[1]) {
      tokens.add(match[1]);
    }
  }
  return Array.from(tokens);
}
