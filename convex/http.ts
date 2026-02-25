import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

http.route({
  pathPrefix: "/run-method/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const methodName = decodeURIComponent(url.pathname.replace("/run-method/", ""));
    if (!methodName) {
      return new Response(JSON.stringify({ error: "Method name is required in URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: unknown = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }

    try {
      const result = await ctx.runAction(api.methods.runMethod, {
        methodName,
        inputData: isRecord(payload) && "inputs" in payload ? payload.inputs : payload,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

export default http;
