"use node";

/**
 * Выходящие запросы к api.openai.com идут с IP Convex; в части регионов OpenAI
 * отвечает unsupported_country_region_territory. Через прокси в US/EU
 * задаётся env OPENAI_HTTPS_PROXY (или стандартный HTTPS_PROXY).
 * Формат: http(s)://user:pass@host:port или http://host:port
 */
import { fetch as undiciFetch, ProxyAgent } from "undici";

let cachedProxy: string | undefined;
let dispatcher: InstanceType<typeof ProxyAgent> | undefined;

function getDispatcher(): InstanceType<typeof ProxyAgent> | undefined {
  const proxyUrl = process.env.OPENAI_HTTPS_PROXY ?? process.env.HTTPS_PROXY;
  if (!proxyUrl?.trim()) return undefined;
  const trimmed = proxyUrl.trim();
  if (cachedProxy !== trimmed || !dispatcher) {
    cachedProxy = trimmed;
    dispatcher = new ProxyAgent(trimmed);
  }
  return dispatcher;
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> | undefined {
  if (headers === undefined) return undefined;
  if (typeof headers === "string") return undefined;
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([k, v]) => [k, String(v)]));
  }
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  return headers as Record<string, string>;
}

/** Только запросы к OpenAI API (не затрагивает ваши функции-переменные). */
export async function openaiFetch(url: string, init: RequestInit): Promise<Response> {
  const d = getDispatcher();
  if (!d) {
    return fetch(url, init);
  }
  const result = await undiciFetch(url, {
    method: init.method,
    headers: headersToRecord(init.headers),
    body: init.body != null ? String(init.body) : undefined,
    dispatcher: d,
  });
  return result as unknown as Response;
}
