/**
 * The one place a screen asks "can this person see this answer?".
 *
 * Order of precedence, and it is not negotiable:
 *
 *   1. EMERGENCY. Over a limit, or inside seven days of one → allowed, always,
 *      whatever the plan and whatever the meter says.
 *   2. ENTITLEMENT. Their plan covers the feature → allowed.
 *   3. METER. A forward-looking feature already unlocked this month → allowed.
 *   4. Otherwise locked, with a request() that either spends a free check or
 *      opens the paywall at that exact moment of intent.
 */
import { useCallback } from "react";
import { useProfile } from "@/lib/store";
import { canUse, type ProFeature } from "@/lib/entitlements";
import { isMetered, isUnlocked, remaining, type MeteredFeature } from "@/lib/paywall/meter";
import { usePaywall } from "@/components/paywall/PaywallProvider";
import { track } from "@/lib/analytics/funnel";

export type Gate = {
  /** True when the content may render in full, right now. */
  allowed: boolean;
  /** True when a free check would open it. Drives the button label. */
  metered: boolean;
  /** Free forward-looking checks left this month. */
  checksLeft: number;
  /**
   * Call from a click, never from render. Spends a check when one is left and
   * the feature is metered; otherwise opens the paywall.
   */
  request: () => void;
};

export function useGate(feature: ProFeature, opts?: { emergency?: boolean }): Gate {
  const { profile } = useProfile();
  const { meter, spendCheck, open } = usePaywall();

  const entitled = opts?.emergency === true || canUse(profile.plan, feature);
  const metered = isMetered(feature);
  const unlocked =
    metered && meter.period !== "" && isUnlocked(meter, feature as MeteredFeature);
  const checksLeft = meter.period === "" ? 0 : remaining(meter);

  const request = useCallback(() => {
    if (entitled) return;
    if (metered && checksLeft > 0) {
      const granted = spendCheck(feature);
      if (granted) {
        track("soft_gate_upsell", {
          feature,
          reason: "metered_spend",
          plan: profile.plan,
          checksLeft: checksLeft - 1,
        });
      }
      return;
    }
    if (!metered) {
      track("hard_gate_block", { feature, reason: "hard", plan: profile.plan });
    }
    open({ feature, reason: metered ? "meter_exhausted" : "hard" });
  }, [entitled, metered, checksLeft, spendCheck, open, feature, profile.plan]);

  return {
    allowed: entitled || unlocked,
    metered: metered && !entitled && !unlocked && checksLeft > 0,
    checksLeft,
    request,
  };
}
