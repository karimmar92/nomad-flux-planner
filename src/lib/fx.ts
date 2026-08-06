/**
 * Static USD→local-currency reference rates for displaying city costs in the
 * money people will actually spend. Planning display only — never used for
 * scoring or ranking, which stay in USD.
 *
 * Update alongside seed data. Volatile currencies are flagged so the UI can
 * say so instead of implying precision.
 */

export const FX_AS_OF = "2026-08";

type FxEntry = { perUsd: number; volatile?: boolean };

export const USD_TO_LOCAL: Record<string, FxEntry> = {
  USD: { perUsd: 1 },
  EUR: { perUsd: 0.86 },
  THB: { perUsd: 32 },
  MXN: { perUsd: 18.5 },
  COP: { perUsd: 4_100 },
  ARS: { perUsd: 1_450, volatile: true },
  IDR: { perUsd: 16_300 },
  GEL: { perUsd: 2.7 },
  HUF: { perUsd: 340 },
  RSD: { perUsd: 101 },
  TRY: { perUsd: 42, volatile: true },
  PLN: { perUsd: 3.65 },
  CZK: { perUsd: 21 },
  AED: { perUsd: 3.6725 }, // pegged
  MYR: { perUsd: 4.2 },
  VND: { perUsd: 26_250 },
  TWD: { perUsd: 31 },
  KRW: { perUsd: 1_380 },
  ZAR: { perUsd: 17.5 },
  MUR: { perUsd: 46 },
  ALL: { perUsd: 83 },
  CNY: { perUsd: 7.1 },
};

export function toLocal(usd: number, currency: string): number | null {
  const fx = USD_TO_LOCAL[currency];
  return fx ? usd * fx.perUsd : null;
}

export function isVolatileCurrency(currency: string): boolean {
  return USD_TO_LOCAL[currency]?.volatile === true;
}

/**
 * "₫30.2M", "€2,020", "Rp18.7M" — compact notation once amounts get long,
 * full figures while they're readable.
 */
export function formatLocal(usd: number, currency: string): string | null {
  const local = toLocal(usd, currency);
  if (local == null || currency === "USD") return null;
  const compact = Math.abs(local) >= 100_000;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 0,
    }).format(local);
  } catch {
    return `${Math.round(local).toLocaleString("en-US")} ${currency}`;
  }
}
