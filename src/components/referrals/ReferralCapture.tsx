import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { captureReferral } from "@/lib/referrals/attribution";
import { logReferralClick } from "@/lib/referrals/clicks.functions";
import { REFERRAL_PARAM } from "@/lib/referrals/config";

/**
 * Stores ?r=CODE first-party (30-day last-touch) and logs the click once.
 * Attribution itself is locked to the profile at signup, not here.
 */
export function ReferralCapture() {
  const log = useServerFn(logReferralClick);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const hasParam = new URLSearchParams(window.location.search).has(REFERRAL_PARAM);
    const stored = captureReferral();
    if (!hasParam || !stored) return;

    void log({ data: { code: stored.code, path: window.location.pathname } }).catch(() => {
      /* a lost click is not worth surfacing to the visitor */
    });
  }, [log]);

  return null;
}
