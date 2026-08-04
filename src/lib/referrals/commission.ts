/**
 * Pure money + fraud logic for the creator program.
 *
 * THE RULE: the commission balance is a DERIVED value. There is no mutable
 * `balance` column anywhere and there never will be. Every credit, clawback,
 * payout and adjustment is an append-only ledger row, and the balance is a
 * filtered SUM over those rows. A creator disputing a payout can always be
 * shown the exact rows that produced the number.
 */

import { CREATOR_PROGRAM } from "./config";

export type LedgerType = "accrual" | "clawback" | "payout" | "adjustment";
export type LedgerStatus = "pending" | "available" | "paid" | "reversed";

export type LedgerRow = {
  id: string;
  creator_id: string;
  referred_user_id: string | null;
  type: LedgerType;
  /** Signed. Negative for clawbacks and payouts. */
  amount_cents: number;
  currency: string;
  status: LedgerStatus;
  available_at: string;
  stripe_invoice_id: string | null;
  note: string | null;
  created_at: string;
};

export type Balance = {
  availableCents: number;
  pendingCents: number;
  lifetimeEarnedCents: number;
  paidOutCents: number;
  /** Days until the oldest pending row clears, or null when nothing is pending. */
  nextClearsInDays: number | null;
  /** Negative balances are legitimate: a clawback after a payout. */
  isNegative: boolean;
  payoutEligible: boolean;
};

const DAY_MS = 86_400_000;

function sum(rows: LedgerRow[], predicate: (r: LedgerRow) => boolean) {
  return rows.reduce((total, row) => (predicate(row) ? total + row.amount_cents : total), 0);
}

export function deriveBalance(rows: LedgerRow[], now: Date = new Date()): Balance {
  const live = rows.filter((r) => r.status !== "reversed");
  const availableCents = sum(live, (r) => r.status === "available" || r.status === "paid");
  const pendingCents = sum(live, (r) => r.status === "pending");
  const lifetimeEarnedCents = sum(live, (r) => r.type === "accrual");
  const paidOutCents = -sum(live, (r) => r.type === "payout");

  const pendingDates = live
    .filter((r) => r.status === "pending")
    .map((r) => Date.parse(r.available_at))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const nextClearsInDays =
    pendingDates.length > 0
      ? Math.max(0, Math.ceil(((pendingDates[0] as number) - now.getTime()) / DAY_MS))
      : null;

  return {
    availableCents,
    pendingCents,
    lifetimeEarnedCents,
    paidOutCents,
    nextClearsInDays,
    isNegative: availableCents < 0,
    payoutEligible: availableCents >= CREATOR_PROGRAM.minPayoutCents,
  };
}

/** 30% of what was actually collected — never of what was invoiced. */
export function accrualAmountCents(collectedCents: number) {
  return Math.round(collectedCents * CREATOR_PROGRAM.revenueShare);
}

/** How many monthly accruals this referred user has already produced. */
export function accrualCountForUser(rows: LedgerRow[], referredUserId: string) {
  return rows.filter(
    (r) => r.type === "accrual" && r.status !== "reversed" && r.referred_user_id === referredUserId,
  ).length;
}

export function capReached(rows: LedgerRow[], referredUserId: string) {
  return accrualCountForUser(rows, referredUserId) >= CREATOR_PROGRAM.capMonthsPerReferredUser;
}

export function availableAtFrom(createdAt: Date) {
  return new Date(createdAt.getTime() + CREATOR_PROGRAM.holdDays * DAY_MS);
}

/* ------------------------------------------------------------------ */
/* Fraud                                                               */
/* ------------------------------------------------------------------ */

export type HardBlockReason =
  | "self_referral"
  | "email_match"
  | "payment_fingerprint_match";

export type HardBlockInput = {
  creatorUserId: string;
  referredUserId: string;
  creatorEmail: string | null;
  referredEmail: string | null;
  paymentFingerprint: string | null;
  creatorPaymentFingerprints: string[];
};

/** Hard blocks reject the accrual outright. Keep this list short and certain. */
export function hardBlock(input: HardBlockInput): HardBlockReason | null {
  if (input.creatorUserId === input.referredUserId) return "self_referral";

  const a = input.creatorEmail?.trim().toLowerCase();
  const b = input.referredEmail?.trim().toLowerCase();
  if (a && b && a === b) return "email_match";

  if (
    input.paymentFingerprint &&
    input.creatorPaymentFingerprints.includes(input.paymentFingerprint)
  ) {
    return "payment_fingerprint_match";
  }

  return null;
}

export type SoftFlagKind = "ip_cluster" | "high_conversion_rate" | "volume_spike";

export type SoftFlag = { kind: SoftFlagKind; detail: Record<string, number> };

export type SoftFlagInput = {
  signupsFromSameIpLast24h: number;
  conversionRate: number;
  signupsLast24h: number;
  dailyBaselineLast30d: number;
};

/**
 * Soft flags accrue normally and queue for a human. They never auto-reject.
 *
 * IMPORTANT, app-specific: shared IP is NOT a block. Our users are nomads
 * working from coworking spaces and cafés — twenty legitimate signups from one
 * Canggu café IP in a week is normal behaviour. Hard-blocking on IP would hit
 * exactly the users we most want.
 */
export function softFlags(input: SoftFlagInput): SoftFlag[] {
  const flags: SoftFlag[] = [];

  if (input.signupsFromSameIpLast24h > 10) {
    flags.push({
      kind: "ip_cluster",
      detail: { signups: input.signupsFromSameIpLast24h },
    });
  }

  if (input.conversionRate > 0.4) {
    flags.push({
      kind: "high_conversion_rate",
      detail: { rate: Number(input.conversionRate.toFixed(3)) },
    });
  }

  if (
    input.dailyBaselineLast30d > 0 &&
    input.signupsLast24h >= input.dailyBaselineLast30d * 10
  ) {
    flags.push({
      kind: "volume_spike",
      detail: { today: input.signupsLast24h, baseline: input.dailyBaselineLast30d },
    });
  }

  return flags;
}

/* ------------------------------------------------------------------ */
/* Funnel + cohorts                                                    */
/* ------------------------------------------------------------------ */

export type Funnel = {
  clicks: number;
  signups: number;
  conversions: number;
  signupRate: number;
  conversionRate: number;
  clickToPaidRate: number;
};

export function buildFunnel(clicks: number, signups: number, conversions: number): Funnel {
  const rate = (a: number, b: number) => (b > 0 ? a / b : 0);
  return {
    clicks,
    signups,
    conversions,
    signupRate: rate(signups, clicks),
    conversionRate: rate(conversions, signups),
    clickToPaidRate: rate(conversions, clicks),
  };
}

export function pct(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}
