/**
 * Business tier commercials. Single source of truth for every price shown
 * on /business and inside /org. No self-serve checkout at this stage —
 * these are sales conversations, so the CTA is a call, not a card form.
 */

export const B2B_PRICING = {
  perSeatMonthlyUsd: 8,
  minimumSeats: 10,
  annualDiscountPct: 15,
} as const;

export function monthlyTotal(seats: number): number {
  return Math.max(seats, B2B_PRICING.minimumSeats) * B2B_PRICING.perSeatMonthlyUsd;
}

/** Annual billing, ~15% off the monthly run rate. */
export function annualTotal(seats: number): number {
  const gross = monthlyTotal(seats) * 12;
  return Math.round(gross * (1 - B2B_PRICING.annualDiscountPct / 100));
}

export function annualPerSeatMonthly(): number {
  return (
    Math.round(
      B2B_PRICING.perSeatMonthlyUsd * (1 - B2B_PRICING.annualDiscountPct / 100) * 100,
    ) / 100
  );
}

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
