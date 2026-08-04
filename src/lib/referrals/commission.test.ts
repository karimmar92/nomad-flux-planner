import { describe, expect, it } from "vitest";
import {
  accrualAmountCents,
  accrualCountForUser,
  buildFunnel,
  capReached,
  deriveBalance,
  hardBlock,
  softFlags,
  type LedgerRow,
} from "./commission";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    id: crypto.randomUUID(),
    creator_id: "creator-1",
    referred_user_id: "user-1",
    type: "accrual",
    amount_cents: 900,
    currency: "usd",
    status: "available",
    available_at: "2026-01-01T00:00:00.000Z",
    stripe_invoice_id: null,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const NOW = new Date("2026-08-04T00:00:00.000Z");

describe("deriveBalance", () => {
  it("is a pure sum over rows, never a stored number", () => {
    const b = deriveBalance(
      [
        row({ amount_cents: 900, status: "available" }),
        row({ amount_cents: 900, status: "available" }),
        row({ amount_cents: 900, status: "pending", available_at: "2026-09-01T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(b.availableCents).toBe(1800);
    expect(b.pendingCents).toBe(900);
    expect(b.lifetimeEarnedCents).toBe(2700);
  });

  it("nets clawbacks and payouts, allowing a negative carry-forward", () => {
    const b = deriveBalance(
      [
        row({ amount_cents: 900, status: "available" }),
        row({ type: "payout", amount_cents: -900, status: "paid" }),
        row({ type: "clawback", amount_cents: -900, status: "available" }),
      ],
      NOW,
    );
    expect(b.availableCents).toBe(-900);
    expect(b.isNegative).toBe(true);
    expect(b.paidOutCents).toBe(900);
    expect(b.payoutEligible).toBe(false);
  });

  it("reports days until the oldest pending row clears", () => {
    const b = deriveBalance(
      [row({ status: "pending", available_at: "2026-08-14T00:00:00.000Z" })],
      NOW,
    );
    expect(b.nextClearsInDays).toBe(10);
  });

  it("ignores reversed rows", () => {
    const b = deriveBalance([row({ amount_cents: 900, status: "reversed" })], NOW);
    expect(b.availableCents).toBe(0);
    expect(b.lifetimeEarnedCents).toBe(0);
  });

  it("only counts $50+ as payable", () => {
    expect(deriveBalance([row({ amount_cents: 4999 })], NOW).payoutEligible).toBe(false);
    expect(deriveBalance([row({ amount_cents: 5000 })], NOW).payoutEligible).toBe(true);
  });
});

describe("accrual", () => {
  it("pays 30% of collected revenue", () => {
    expect(accrualAmountCents(2900)).toBe(870);
    expect(accrualAmountCents(999)).toBe(300);
  });

  it("caps at 12 months per referred user", () => {
    const rows = Array.from({ length: 11 }, () => row({}));
    expect(capReached(rows, "user-1")).toBe(false);
    expect(capReached([...rows, row({})], "user-1")).toBe(true);
    expect(accrualCountForUser(rows, "user-2")).toBe(0);
  });
});

describe("hard blocks", () => {
  const base = {
    creatorUserId: "c",
    referredUserId: "u",
    creatorEmail: "creator@example.com",
    referredEmail: "friend@example.com",
    paymentFingerprint: "fp_1",
    creatorPaymentFingerprints: ["fp_9"],
  };

  it("blocks self referral", () => {
    expect(hardBlock({ ...base, referredUserId: "c" })).toBe("self_referral");
  });

  it("blocks matching email regardless of case", () => {
    expect(hardBlock({ ...base, referredEmail: "Creator@Example.com " })).toBe("email_match");
  });

  it("blocks a reused payment method fingerprint", () => {
    expect(hardBlock({ ...base, creatorPaymentFingerprints: ["fp_1"] })).toBe(
      "payment_fingerprint_match",
    );
  });

  it("allows a clean referral", () => {
    expect(hardBlock(base)).toBeNull();
  });
});

describe("soft flags", () => {
  const clean = {
    signupsFromSameIpLast24h: 3,
    conversionRate: 0.05,
    signupsLast24h: 2,
    dailyBaselineLast30d: 2,
  };

  it("never blocks — shared coworking IPs are normal for nomads", () => {
    const flags = softFlags({ ...clean, signupsFromSameIpLast24h: 20 });
    expect(flags.map((f) => f.kind)).toEqual(["ip_cluster"]);
  });

  it("flags implausible conversion rates", () => {
    expect(softFlags({ ...clean, conversionRate: 0.55 }).map((f) => f.kind)).toContain(
      "high_conversion_rate",
    );
  });

  it("flags a 10x spike against the creator's own baseline", () => {
    expect(softFlags({ ...clean, signupsLast24h: 20 }).map((f) => f.kind)).toContain(
      "volume_spike",
    );
  });

  it("returns nothing for ordinary activity", () => {
    expect(softFlags(clean)).toEqual([]);
  });
});

describe("funnel", () => {
  it("computes rates and tolerates zero", () => {
    const f = buildFunnel(1000, 80, 4);
    expect(f.signupRate).toBeCloseTo(0.08);
    expect(f.conversionRate).toBeCloseTo(0.05);
    expect(buildFunnel(0, 0, 0).conversionRate).toBe(0);
  });
});
