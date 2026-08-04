import type { PartnerPlacement } from "@/config/partners";

/**
 * Mirrors the `partner_clicks` table (see docs/partner-clicks.sql).
 * Logged so we can delete placements that earn nothing rather than
 * accumulating clutter. No page-view or profiling data is stored.
 */
export interface PartnerClick {
  id: string;
  user_id: string | null;
  partner_id: string;
  placement: PartnerPlacement;
  city_id: string | null;
  created_at: string;
}

const KEY = "driftly.partner_clicks";

export function logPartnerClick(input: {
  partner_id: string;
  placement: PartnerPlacement;
  city_id?: string | null;
  user_id?: string | null;
}) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const rows = raw ? (JSON.parse(raw) as PartnerClick[]) : [];
    rows.push({
      id: crypto.randomUUID(),
      user_id: input.user_id ?? null,
      partner_id: input.partner_id,
      placement: input.placement,
      city_id: input.city_id ?? null,
      created_at: new Date().toISOString(),
    });
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-500)));
  } catch {
    /* logging must never break an outbound click */
  }
}

export function readPartnerClicks(): PartnerClick[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PartnerClick[]) : [];
  } catch {
    return [];
  }
}
