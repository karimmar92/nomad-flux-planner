/**
 * FUNNEL EVENTS — four of them, and no more.
 *
 * This is not a general analytics layer and must not become one. It records
 * exactly the four moments that decide whether the paywall works:
 *
 *   paywall_intent    the sheet opened because someone reached for a paid answer
 *   soft_gate_upsell  a free monthly check was spent on a forward-looking answer
 *   hard_gate_block   a never-metered feature (vault, report, exports) was blocked
 *   trial_start       the trial CTA was pressed and checkout opened
 *
 * Rules:
 *   - No personal data. An anonymous per-device session id, the feature name,
 *     the plan, the meter position. Never an email, never a trip, never a city
 *     someone is actually in.
 *   - Fire and forget. A failed insert must never break a click; the paywall
 *     works whether or not the event lands.
 *   - Client-side only. Nothing here runs during SSR.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProFeature } from "@/lib/entitlements";
import { GATE_COPY_EXPERIMENT, gateCopyVariant } from "./experiment";

export type FunnelEvent =
  | "paywall_intent"
  | "soft_gate_upsell"
  | "hard_gate_block"
  | "trial_start"
  | "waitlist_signup";

export type FunnelPayload = {
  feature?: ProFeature | string | null;
  /** "hard" | "meter_exhausted" | "metered_spend" | plan interval, etc. */
  reason?: string | null;
  plan?: string | null;
  checksLeft?: number | null;
  props?: Record<string, string | number | boolean | null>;
};

const SESSION_KEY = "driftly.funnel.session";

/** Anonymous, per-device, regenerated if storage is cleared. Not an identity. */
export function funnelSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

export function track(event: FunnelEvent, payload: FunnelPayload = {}): void {
  if (typeof window === "undefined") return;

  const row = {
    event,
    feature: payload.feature ?? null,
    reason: payload.reason ?? null,
    plan: payload.plan ?? null,
    checks_left: payload.checksLeft ?? null,
    session_id: funnelSessionId(),
    // Every event carries the running experiment variant and the route it
    // fired on. Without the variant the A/B test cannot be read; without the
    // route you cannot tell a block on /record/vault from one on /compare.
    props: {
      ...(payload.props ?? {}),
      route: window.location.pathname,
      experiment: GATE_COPY_EXPERIMENT,
      variant: gateCopyVariant(),
    },
  };

  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await supabase
        .from("analytics_events")
        .insert({ ...row, user_id: data.session?.user.id ?? null });
    } catch {
      /* analytics never breaks a click */
    }
  })();
}
