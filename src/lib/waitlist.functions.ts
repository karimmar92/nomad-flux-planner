import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const WAITLIST_FEATURES = [
  "community",
  "stays",
  "radar_city",
  "b2b",
  "recruiter",
] as const;
export type WaitlistFeature = (typeof WAITLIST_FEATURES)[number];

export type WaitlistInput = {
  email: string;
  feature: WaitlistFeature;
  city_id?: string | null;
};

/**
 * Public, insert-only. The table has no client read policy, so we can never
 * check for an existing row first — a duplicate is detected from the unique
 * violation (23505) coming back and reported as "already on the list", never
 * as an error. The uniqueness index treats a missing city as '' so that
 * feature-level signups (stays, community) dedupe too.
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: WaitlistInput) => d)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
      throw new Error("Enter a valid email address");
    }
    if (!WAITLIST_FEATURES.includes(data.feature)) throw new Error("Unknown feature");

    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const supabase = createClient<Database>(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { error } = await supabase.from("waitlist").insert({
      email,
      feature: data.feature,
      city_id: data.city_id ? data.city_id.slice(0, 80) : null,
    });

    if (error) {
      if (error.code === "23505") return { ok: true, already: true };
      throw new Error(error.message);
    }
    return { ok: true, already: false };
  });
