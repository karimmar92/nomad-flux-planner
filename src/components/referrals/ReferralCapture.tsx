import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { captureReferral, purgeLegacyAttribution } from "@/lib/referrals/attribution";
import { logReferralClick } from "@/lib/referrals/clicks.functions";
import { REFERRAL_PARAM } from "@/lib/referrals/config";

/**
 * Holds ?r=CODE for this browsing session and logs the click once.
 *
 * Session-scoped, not a 30-day cookie — see the reasoning in attribution.ts.
 * Attribution itself is locked to the profile at signup, not here.
 */
export function ReferralCapture() {
  const log = useServerFn(logReferralClick);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    // Visitors from before the session-scoped change still carry the old
    // 30-day cookie and localStorage record. We no longer have a lawful basis
    // to hold either, so clear them on the next visit rather than waiting for
    // them to expire.
    purgeLegacyAttribution();

    const hasParam = new URLSearchParams(window.location.search).has(REFERRAL_PARAM);
    const stored = captureReferral();
    if (!hasParam || !stored) return;

    void log({ data: { code: stored.code, path: window.location.pathname } }).catch(() => {
      /* a lost click is not worth surfacing to the visitor */
    });
  }, [log]);

  return null;
}
