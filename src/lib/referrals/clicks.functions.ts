/**
 * Click logging for the funnel. Public by design — a click happens before
 * sign-in. It writes one row and never returns data.
 */

import { createServerFn } from "@tanstack/react-start";

export const logReferralClick = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; path?: string }) => {
    const code = input.code?.trim().toUpperCase() ?? "";
    if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new Error("Invalid referral code.");
    return { code, path: (input.path ?? "/").slice(0, 200) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Which program the code belongs to decides which dashboard counts it.
    const { data: creator } = await supabaseAdmin
      .from("creators")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();

    await supabaseAdmin.from("referral_clicks").insert({
      code: data.code,
      program: creator ? "creator" : "user",
      landing_path: data.path,
    });

    return { ok: true };
  });
