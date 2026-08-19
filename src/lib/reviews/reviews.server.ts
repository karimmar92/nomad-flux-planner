import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Publishable-key client for public, read-only review queries during SSR.
 * Not the admin client: approved reviews are behind a narrow `TO anon` SELECT
 * policy, so anon is exactly the right level of access.
 */
export function publicSupabase() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        // Opaque sb_ keys are not JWTs; PostgREST rejects them as bearer tokens.
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}
