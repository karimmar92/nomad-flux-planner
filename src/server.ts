import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { cachePolicyFor } from "./lib/http-cache";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * Attach a CDN cache policy on the way out.
 *
 * Done here, at the one point every response passes through, rather than in
 * thirty route files. Two reasons: a route that forgets to opt in stays
 * private (which is the safe direction), and the whole policy is reviewable in
 * a single file instead of scattered across the app.
 *
 * A route that sets its own Cache-Control keeps it — sitemap.xml already does,
 * and a handler that has thought about its own caching knows better than a
 * general rule.
 */
function withCachePolicy(request: Request, response: Response): Response {
  if (response.headers.has("cache-control")) return response;

  const decision = cachePolicyFor({
    pathname: new URL(request.url).pathname,
    method: request.method,
    status: response.status,
    hasAuthHeader: request.headers.has("authorization"),
  });
  if (!decision.cacheControl) return response;

  // Headers on a Response are immutable once constructed, so clone.
  const headers = new Headers(response.headers);
  headers.set("cache-control", decision.cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withCachePolicy(request, normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
