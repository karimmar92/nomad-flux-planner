/**
 * Program A — Creator program. Server functions.
 *
 * Nothing here mutates a balance. Reads project the append-only ledger and
 * derive numbers in `commission.ts`.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveBalance, buildFunnel, type LedgerRow } from "./commission";
import { CREATOR_PROGRAM } from "./config";

export type CohortRow = {
  month: string;
  newReferrals: number;
  conversions: number;
  accruedCents: number;
  clearedCents: number;
};

export type CreatorDashboard = {
  isCreator: boolean;
  code: string | null;
  status: string | null;
  payoutsEnabled: boolean;
  applicationStatus: "pending" | "approved" | "rejected" | null;
  ledger: LedgerRow[];
  balance: ReturnType<typeof deriveBalance>;
  funnel: ReturnType<typeof buildFunnel>;
  activeSubscribers: number;
  cohorts: CohortRow[];
  retention60: { creator: number | null; platform: number | null };
  payouts: {
    id: string;
    amount_cents: number;
    status: string;
    created_at: string;
    period_start: string | null;
    period_end: string | null;
  }[];
};

const monthKey = (iso: string) => iso.slice(0, 7);
const DAY_MS = 86_400_000;

export const getCreatorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorDashboard> => {
    const { supabase, userId } = context;

    const [{ data: creator }, { data: application }] = await Promise.all([
      supabase.from("creators").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("creator_applications")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const empty: CreatorDashboard = {
      isCreator: false,
      code: null,
      status: null,
      payoutsEnabled: false,
      applicationStatus: (application?.status as CreatorDashboard["applicationStatus"]) ?? null,
      ledger: [],
      balance: deriveBalance([]),
      funnel: buildFunnel(0, 0, 0),
      activeSubscribers: 0,
      cohorts: [],
      retention60: { creator: null, platform: null },
      payouts: [],
    };

    if (!creator) return empty;

    const [{ data: ledgerRows }, { count: clicks }, { data: referred }, { data: payouts }] =
      await Promise.all([
        supabase
          .from("commission_ledger")
          .select("*")
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("referral_clicks")
          .select("id", { count: "exact", head: true })
          .eq("code", creator.code),
        supabase
          .from("profiles")
          .select("id, plan, created_at, updated_at, referred_at")
          .eq("referred_by", userId),
        supabase
          .from("creator_payouts")
          .select("id, amount_cents, status, created_at, period_start, period_end")
          .eq("creator_id", creator.id)
          .order("created_at", { ascending: false }),
      ]);

    const ledger = (ledgerRows ?? []) as LedgerRow[];
    const signups = referred ?? [];
    const conversions = signups.filter((p) => p.plan !== "free");

    // Cohorts by signup month.
    const byMonth = new Map<string, CohortRow>();
    const ensure = (month: string) => {
      let row = byMonth.get(month);
      if (!row) {
        row = { month, newReferrals: 0, conversions: 0, accruedCents: 0, clearedCents: 0 };
        byMonth.set(month, row);
      }
      return row;
    };
    for (const p of signups) {
      const row = ensure(monthKey(p.referred_at ?? p.created_at));
      row.newReferrals += 1;
      if (p.plan !== "free") row.conversions += 1;
    }
    for (const l of ledger) {
      if (l.type !== "accrual" || l.status === "reversed") continue;
      const row = ensure(monthKey(l.created_at));
      row.accruedCents += l.amount_cents;
      if (l.status === "available" || l.status === "paid") row.clearedCents += l.amount_cents;
    }
    const cohorts = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));

    // 60-day retention: referred users who signed up at least 60 days ago and
    // are still active (used the app in the last 30 days).
    const now = Date.now();
    const eligible = signups.filter((p) => now - Date.parse(p.created_at) >= 60 * DAY_MS);
    const retained = eligible.filter((p) => now - Date.parse(p.updated_at) <= 30 * DAY_MS);
    const creatorRetention = eligible.length > 0 ? retained.length / eligible.length : null;

    return {
      isCreator: true,
      code: creator.code,
      status: creator.status,
      payoutsEnabled: creator.payouts_enabled,
      applicationStatus: "approved",
      ledger,
      balance: deriveBalance(ledger),
      funnel: buildFunnel(clicks ?? 0, signups.length, conversions.length),
      activeSubscribers: conversions.length,
      cohorts,
      retention60: { creator: creatorRetention, platform: null },
      payouts: payouts ?? [],
    };
  });

export type ApplicationInput = {
  contact_email: string;
  audience_description: string;
  primary_channel: string;
  channel_url?: string;
  audience_size?: number;
  pitch?: string;
};

export const submitCreatorApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ApplicationInput) => {
    const email = input.contact_email?.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      throw new Error("A valid contact email is required.");
    }
    const audience = input.audience_description?.trim();
    if (!audience || audience.length < 20 || audience.length > 1000) {
      throw new Error("Tell us about your audience in 20–1000 characters.");
    }
    const channel = input.primary_channel?.trim();
    if (!channel || channel.length > 60) throw new Error("Pick a primary channel.");
    return {
      contact_email: email,
      audience_description: audience,
      primary_channel: channel,
      channel_url: input.channel_url?.trim().slice(0, 300) || null,
      audience_size:
        typeof input.audience_size === "number" && input.audience_size >= 0
          ? Math.round(input.audience_size)
          : null,
      pitch: input.pitch?.trim().slice(0, 1000) || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("creator_applications")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { status: "pending" as const, termsVersion: CREATOR_PROGRAM.termsVersion };
  });
