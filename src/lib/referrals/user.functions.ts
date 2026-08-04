/**
 * Program B — User referrals. Free months only. There is no cash path here and
 * no ledger row is ever written by this module.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { USER_PROGRAM } from "./config";

export type UserReferralSummary = {
  code: string | null;
  friendsJoined: number;
  monthsEarned: number;
  monthsPending: number;
  monthsRemainingThisYear: number;
  qualifyingDays: number;
  referredByCode: string | null;
};

export const getUserReferralSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserReferralSummary> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: rewards }, { count: friends }] = await Promise.all([
      supabase.from("profiles").select("referral_code, referred_by").eq("id", userId).maybeSingle(),
      supabase
        .from("user_referral_rewards")
        .select("side, status, created_at")
        .eq("referrer_id", userId),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", userId),
    ]);

    const yearAgo = Date.now() - 365 * 86_400_000;
    const earnedThisYear = (rewards ?? []).filter(
      (r) => r.status === "granted" && Date.parse(r.created_at) >= yearAgo,
    ).length;

    return {
      code: profile?.referral_code ?? null,
      friendsJoined: friends ?? 0,
      monthsEarned: (rewards ?? []).filter((r) => r.status === "granted").length,
      monthsPending: (rewards ?? []).filter((r) => r.status === "pending").length,
      monthsRemainingThisYear: Math.max(
        0,
        USER_PROGRAM.maxEarnedMonthsPerRollingYear - earnedThisYear,
      ),
      qualifyingDays: USER_PROGRAM.referrerQualifyingDays,
      referredByCode: profile?.referred_by ?? null,
    };
  });

/**
 * Writes the self-reported "how did you hear about us?" answer. This is the
 * reconciliation signal when cookie attribution is lost to tracking prevention
 * and a creator says their numbers look low.
 */
export const saveHeardAbout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { heard_about: string }) => {
    const value = input.heard_about?.trim() ?? "";
    if (value.length > 300) throw new Error("Keep it under 300 characters.");
    return { heard_about: value };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ heard_about: data.heard_about })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
