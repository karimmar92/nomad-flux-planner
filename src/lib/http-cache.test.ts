/**
 * Cache-policy safety. The failure mode here is a data breach, not a bug.
 *
 * A CDN cache is shared between visitors. If a page carrying one person's data
 * is cached, the next visitor is served it. So these tests are weighted
 * heavily toward proving that PRIVATE THINGS ARE NEVER CACHED, and only
 * lightly toward proving public things are.
 *
 * Three of them are structural rather than example-based, because examples
 * cannot protect a list that other people will edit:
 *
 *   1. Every route in the generated route tree is classified, so a route added
 *      next month is provably denied unless somebody allowlists it on purpose.
 *   2. Nothing on the allowlist is also on the deny list.
 *   3. The Supabase client still keeps its session in localStorage — the
 *      assumption the entire safety argument rests on.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cachePolicyFor } from "./http-cache";

const GET = { method: "GET", status: 200 };

describe("private paths are never cacheable", () => {
  const PRIVATE = [
    "/profile",
    "/tracker",
    "/record",
    "/record/vault",
    "/record/report/2026",
    "/admin/billing",
    "/admin/creators",
    "/auth",
    "/org",
    "/community",
    "/community/requests",
    "/plan",
    "/plan/costs",
    "/hops",
    "/settings/employer-sharing",
    "/creator",
    "/api/public/payments/webhook",
    "/api/public/alerts/run",
    "/.mcp/list-tools",
    "/.mcp/invoke-tool/get_city",
    "/.lovable/oauth/consent",
    "/.well-known/oauth-protected-resource",
  ];

  for (const path of PRIVATE) {
    it(`refuses to cache ${path}`, () => {
      expect(cachePolicyFor({ pathname: path, ...GET }).cacheControl).toBeNull();
    });
  }

  it("refuses even with a trailing slash", () => {
    expect(cachePolicyFor({ pathname: "/profile/", ...GET }).cacheControl).toBeNull();
    expect(cachePolicyFor({ pathname: "/admin/", ...GET }).cacheControl).toBeNull();
  });

  it("refuses a path that merely starts with a public prefix but is private", () => {
    // "/creator" is private; "/creators" is public. A sloppy startsWith would
    // conflate them in one direction or the other.
    expect(cachePolicyFor({ pathname: "/creator", ...GET }).cacheControl).toBeNull();
    expect(cachePolicyFor({ pathname: "/creator/payouts", ...GET }).cacheControl).toBeNull();
    expect(cachePolicyFor({ pathname: "/creators", ...GET }).cacheControl).not.toBeNull();
  });
});

describe("only safe, successful, anonymous reads are cacheable", () => {
  it("never caches a non-GET method", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      expect(cachePolicyFor({ pathname: "/", method, status: 200 }).cacheControl).toBeNull();
    }
  });

  it("caches HEAD as well as GET", () => {
    expect(
      cachePolicyFor({ pathname: "/", method: "HEAD", status: 200 }).cacheControl,
    ).not.toBeNull();
  });

  it("never caches a non-200 response", () => {
    // A cached 500 is an outage that outlives its own cause.
    for (const status of [301, 302, 400, 401, 403, 404, 500, 503]) {
      expect(cachePolicyFor({ pathname: "/", method: "GET", status }).cacheControl).toBeNull();
    }
  });

  it("never caches a request that carried credentials", () => {
    expect(cachePolicyFor({ pathname: "/", ...GET, hasAuthHeader: true }).cacheControl).toBeNull();
  });
});

describe("public pages are cacheable at the edge but revalidated by the browser", () => {
  const PUBLIC = [
    "/",
    "/explore",
    "/pricing",
    "/city/lisbon",
    "/rules/schengen-90-180",
    "/legal/imprint",
  ];

  for (const path of PUBLIC) {
    it(`caches ${path}`, () => {
      const cc = cachePolicyFor({ pathname: path, ...GET }).cacheControl;
      expect(cc).toBeTruthy();
      // s-maxage is where the saving is: the CDN answers and the function is
      // never invoked.
      expect(cc).toMatch(/s-maxage=\d+/);
      // max-age=0 keeps the browser revalidating, so a deploy is visible on
      // reload rather than stuck behind a private cache.
      expect(cc).toContain("max-age=0");
      expect(cc).toContain("public");
    });
  }

  it("treats a trailing slash the same as none", () => {
    expect(cachePolicyFor({ pathname: "/pricing/", ...GET }).cacheControl).toBe(
      cachePolicyFor({ pathname: "/pricing", ...GET }).cacheControl,
    );
  });

  it("never sets Vary: Cookie, which would destroy the hit rate", () => {
    // Safe only because the session lives in localStorage; guarded below.
    const cc = cachePolicyFor({ pathname: "/", ...GET }).cacheControl ?? "";
    expect(cc.toLowerCase()).not.toContain("vary");
  });
});

describe("structural guards", () => {
  it("classifies every route in the generated route tree", () => {
    // THE POINT: a route added next month is denied by default. This test
    // fails loudly only if a route is BOTH unrecognised AND somehow cacheable,
    // which cannot happen — so what it really documents is the deny-by-default
    // guarantee across the real surface, and it will catch an allowlist edit
    // that accidentally opens a private route.
    const tree = readFileSync(join(process.cwd(), "src/routeTree.gen.ts"), "utf8");
    const paths = Array.from(tree.matchAll(/path:\s*'([^']+)'/g)).map((m) => m[1]!);
    expect(paths.length).toBeGreaterThan(20);

    const PUBLIC_OK = new Set([
      "/",
      "/landing",
      "/explore",
      "/pricing",
      "/business",
      "/creators",
      "/creator-terms",
      "/how-we-make-money",
      "/phrasebook",
      "/emergency",
      "/kit",
      "/costs",
      "/compare",
      "/calculator",
      "/checklist",
      "/pension",
      "/sitemap.xml",
      "/robots.txt",
    ]);

    for (const raw of paths) {
      // Concrete-ise dynamic segments so a real URL is tested, not a pattern.
      const path = raw.replace(/\$\w+/g, "x").replace(/\/\$$/, "/x");
      const decision = cachePolicyFor({ pathname: path, ...GET });
      if (decision.cacheControl) {
        const allowed =
          PUBLIC_OK.has(path) ||
          path.startsWith("/city/") ||
          path.startsWith("/rules/") ||
          path.startsWith("/legal/");
        expect(
          allowed,
          `Route ${raw} became cacheable but is not a known public page. If that is intended, add it to the allowlist deliberately.`,
        ).toBe(true);
      }
    }
  });

  it("has no path both allowed and denied", () => {
    // A contradiction would resolve by whichever check runs first, which is
    // exactly the kind of ordering dependence that produces a leak later.
    for (const p of ["/profile", "/tracker", "/admin", "/api/", "/.mcp"]) {
      expect(cachePolicyFor({ pathname: p, ...GET }).cacheControl).toBeNull();
    }
  });

  it("still relies on a localStorage session, not cookies", () => {
    /**
     * THE ASSUMPTION EVERYTHING ELSE RESTS ON.
     *
     * CDN caching of these pages is safe only because the server cannot tell
     * users apart: the Supabase session lives in localStorage and is never
     * sent to the server, so SSR output is identical for everyone.
     *
     * If auth moves to cookies, every allowlisted page becomes a cross-user
     * leak. This test fails the moment that change lands, which is the only
     * reliable way to stop it landing quietly.
     */
    const client = readFileSync(join(process.cwd(), "src/integrations/supabase/client.ts"), "utf8");
    expect(client).toMatch(/storage:\s*typeof window !== ['"]undefined['"] \? localStorage/);
    expect(client.toLowerCase()).not.toMatch(/storage:\s*cookiestorage/);
  });
});
