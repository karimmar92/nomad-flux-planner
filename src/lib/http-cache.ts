/**
 * Which responses a CDN may cache, and for how long.
 *
 * ── WHY THIS SAVES MONEY ───────────────────────────────────────────────
 *
 * Hosting bills per function invocation. Today every request for a city page,
 * a rule page or the landing page wakes a serverless function and renders the
 * same HTML it rendered for the previous visitor. Only sitemap.xml sets any
 * cache header at all.
 *
 * With `s-maxage` the CDN answers instead and the function is never invoked, so
 * the invocation, the compute and most of the egress all disappear. For public
 * pages this is the single largest lever available, and unlike an in-process
 * cache it works on the cold path — the request never reaches us.
 *
 * ── THE SAFETY PROPERTY THIS FILE EXISTS TO PROTECT ────────────────────
 *
 * A CDN cache is SHARED. If a page contains anything specific to one visitor
 * and gets cached, the next visitor is served that visitor's data. That is a
 * data breach, not a bug, and it is the reason this module denies by default:
 * a path is uncacheable unless it appears on an explicit allowlist, so a route
 * added next month is private until somebody deliberately decides otherwise.
 *
 * ── THE ASSUMPTION THE WHOLE THING RESTS ON ────────────────────────────
 *
 * Caching is safe here ONLY because the server cannot tell users apart. The
 * Supabase client stores its session in localStorage:
 *
 *     storage: typeof window !== "undefined" ? localStorage : undefined
 *
 * so no session token is ever sent to the server, SSR output is identical for
 * everybody, and personalisation happens after hydration in the browser.
 *
 * IF THAT EVER CHANGES — if auth moves to cookies, or a loader starts reading a
 * session server-side — every allowlisted page below becomes a leak. There is a
 * test in http-cache.test.ts that fails if cookie storage appears in the
 * Supabase client, precisely so that change cannot land quietly.
 *
 * No `Vary: Cookie` for the same reason: output does not depend on cookies, and
 * adding it would fragment the cache and throw away most of the benefit.
 */

/** Ten minutes at the edge, a day of stale-while-revalidate. */
const CONTENT = "public, max-age=0, s-maxage=600, stale-while-revalidate=86400";

/** Rule and legal pages change on the order of months. */
const STABLE = "public, max-age=0, s-maxage=3600, stale-while-revalidate=604800";

/**
 * Exact paths that are the same for every visitor.
 *
 * `max-age=0` keeps the BROWSER revalidating, so a deploy is visible
 * immediately to someone who reloads; `s-maxage` is what the CDN honours and
 * is where the saving comes from. Splitting the two is deliberate.
 */
const EXACT: Record<string, string> = {
  "/": CONTENT,
  "/landing": CONTENT,
  "/explore": CONTENT,
  "/pricing": STABLE,
  "/business": STABLE,
  "/creators": STABLE,
  "/creator-terms": STABLE,
  "/how-we-make-money": STABLE,
  "/phrasebook": CONTENT,
  "/emergency": CONTENT,
  "/kit": CONTENT,
  "/costs": CONTENT,
  "/compare": CONTENT,
  "/calculator": CONTENT,
  "/checklist": CONTENT,
  "/pension": CONTENT,
  "/sitemap.xml": STABLE,
  "/robots.txt": STABLE,
};

/**
 * Path PREFIXES that are public content.
 *
 * Prefixes are riskier than exact matches — "/city/" happily matches anything
 * underneath it — so the list is short and every entry is a directory of
 * generated public pages with no per-user content.
 */
const PREFIXES: { prefix: string; policy: string }[] = [
  { prefix: "/city/", policy: CONTENT },
  { prefix: "/rules/", policy: STABLE },
  { prefix: "/legal/", policy: STABLE },
];

/**
 * Never cacheable, whatever else matches. Belt and braces: none of these are on
 * the allowlist either, but stating them makes the intent reviewable and means
 * a careless allowlist edit still cannot expose them.
 *
 * `/api/` and `/.mcp/` are here because they are POST and authenticated, and a
 * cached authenticated response is the classic CDN data-leak.
 */
const NEVER: string[] = [
  "/profile",
  "/tracker",
  "/record",
  "/admin",
  "/auth",
  "/org",
  "/community",
  "/plan",
  "/hops",
  "/settings",
  "/creator",
  "/api/",
  "/.mcp",
  "/.lovable",
  "/.well-known",
];

export type CacheDecision = {
  /** The Cache-Control value, or null when the response must not be cached. */
  cacheControl: string | null;
  /** Why, so a decision can be explained without re-deriving it. */
  reason: string;
};

export function cachePolicyFor(input: {
  pathname: string;
  method: string;
  status: number;
  /** True when the request carried any credential. Belt and braces. */
  hasAuthHeader?: boolean;
}): CacheDecision {
  const { pathname, method, status } = input;

  // Only ever cache safe, successful reads. A cached 500 is an outage that
  // outlives its own cause, and a cached POST is a correctness disaster.
  if (method !== "GET" && method !== "HEAD") {
    return { cacheControl: null, reason: "not a safe method" };
  }
  if (status !== 200) {
    return { cacheControl: null, reason: `status ${status} is not cacheable` };
  }
  if (input.hasAuthHeader) {
    return { cacheControl: null, reason: "request carried credentials" };
  }

  // Normalise a trailing slash so "/pricing/" and "/pricing" agree. Without
  // this the two spellings get different treatment, which is the sort of thing
  // that makes a cache look haunted.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  for (const deny of NEVER) {
    if (path === deny || path.startsWith(deny.endsWith("/") ? deny : `${deny}/`)) {
      return { cacheControl: null, reason: `private path (${deny})` };
    }
  }

  const exact = EXACT[path];
  if (exact) return { cacheControl: exact, reason: "public page, exact match" };

  for (const { prefix, policy } of PREFIXES) {
    if (path.startsWith(prefix)) {
      return { cacheControl: policy, reason: `public page (${prefix}*)` };
    }
  }

  // DENY BY DEFAULT. Anything unrecognised — including every route added in
  // future — is private until somebody puts it on the list on purpose.
  return { cacheControl: null, reason: "not on the public allowlist" };
}
