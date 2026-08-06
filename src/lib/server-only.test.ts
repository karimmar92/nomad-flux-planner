/**
 * Key-hygiene guard rails.
 *
 * Two keys exist. The PUBLISHABLE key is meant to be public — it is inlined
 * into the client bundle by Vite and protected by RLS. The SERVICE-ROLE key
 * BYPASSES RLS entirely: with it, anyone can read every user's passport
 * documents and travel history. It must never leave the server.
 *
 * The separation currently rests on two conventions:
 *   * the service key is read from process.env WITHOUT a VITE_ prefix, so Vite
 *     cannot inline it, and
 *   * every call site imports client.server.ts dynamically INSIDE a handler.
 *
 * A single top-level `import { supabaseAdmin } from ".../client.server"` in a
 * route or *.functions.ts file would break both silently, because those files
 * are bundled for the browser. These tests make that mistake fail in CI
 * instead of in production.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

describe("service-role key never reaches the client", () => {
  it("no module imports client.server at the top level", () => {
    const offenders = files.filter((f) => {
      if (f.endsWith("client.server.ts") || f.endsWith("server-only.test.ts")) return false;
      const src = readFileSync(f, "utf8");
      // Top-level import statements only; `await import(...)` inside a handler
      // is the correct, lazy pattern and is allowed.
      return /^\s*import[^\n]*["']@\/integrations\/supabase\/client\.server["']/m.test(src);
    });
    expect(offenders, `Top-level import of the admin client in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no source file hard-codes a service-role or secret key", () => {
    const offenders = files.filter((f) => {
      if (f.endsWith("server-only.test.ts")) return false;
      const src = readFileSync(f, "utf8");
      return /sb_secret_[A-Za-z0-9_-]{8,}/.test(src) || /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(src);
    });
    expect(offenders, `Hard-coded key material in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no VITE_-prefixed variable carries secret material", () => {
    // Anything VITE_* is compiled into the browser bundle verbatim.
    const offenders = files.filter((f) =>
      /import\.meta\.env\[?['"]?VITE_[A-Z_]*(SECRET|SERVICE|PRIVATE|ADMIN)/i.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(offenders, `Secret-looking VITE_ variable in:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the committed .env contains no secret keys", () => {
    // .env is tracked on purpose (Lovable manages it, it holds only public
    // values). Real secrets belong in .env.local, which is gitignored.
    let env = "";
    try {
      env = readFileSync(join(process.cwd(), ".env"), "utf8");
    } catch {
      return; // absent in CI is fine
    }
    expect(env).not.toMatch(/SERVICE_ROLE/i);
    expect(env).not.toMatch(/sb_secret_/);
  });
});
