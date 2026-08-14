/**
 * Pulls the paid plan from the database into the local profile.
 *
 * THE BUG THIS FIXES: entitlements read `profile.plan`, which lives in
 * localStorage. Stripe's webhook writes `profiles.plan` in Postgres. Nothing
 * connected the two — so a customer could pay, have Stripe charge them, have
 * the webhook correctly record "pro" in the database, and still see the free
 * tier in the app forever. They would have paid and received nothing, and the
 * only symptom would be a support email or a chargeback.
 *
 * DIRECTION IS ONE-WAY AND DELIBERATE: server → device, never device → server.
 * `profiles.plan` is write-protected against end users by a database trigger
 * precisely so that holding a paid tier requires having paid. Pushing the
 * local value up would either fail or, worse, succeed and become a way to
 * grant yourself Pro by editing localStorage.
 *
 * Runs on sign-in, when the tab regains focus, and once more shortly after
 * returning from checkout — Stripe's webhook usually lands within a second or
 * two of the redirect, but not always, so one delayed re-check turns a
 * confusing "still free" into a brief wait.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import type { Plan } from "@/lib/types";

const VALID: readonly Plan[] = ["free", "starter", "pro", "teams"];

/** Delay before the post-checkout re-check, in ms. */
const AFTER_CHECKOUT_RECHECK_MS = 4000;

function isPlan(v: unknown): v is Plan {
  return typeof v === "string" && (VALID as readonly string[]).includes(v);
}

export function usePlanSync() {
  const { userId, signedIn } = useSession();
  const { profile, patchProfile } = useProfile();

  /**
   * The current plan and the patch function are read through refs so they do
   * NOT appear in the dependency array. `patchProfile` is rebuilt on every
   * profile change, so depending on it would tear down and re-run this effect
   * — refetching the plan and re-registering the focus listener — on every
   * keystroke in a profile field.
   */
  const latest = useRef({ plan: profile.plan, patch: patchProfile });
  latest.current = { plan: profile.plan, patch: patchProfile };

  useEffect(() => {
    if (!signedIn || !userId) return;
    let active = true;

    async function pull() {
      const { data, error } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", userId!)
        .maybeSingle();

      // Offline or transient failure: keep whatever the device already has.
      // Never downgrade someone to free because a request failed — they may be
      // on a train, and losing paid features mid-trip is the worst outcome.
      if (!active || error || !data) return;

      const remote = (data as { plan?: unknown }).plan;
      if (isPlan(remote) && remote !== latest.current.plan) {
        latest.current.patch({ plan: remote });
      }
    }

    void pull();

    // Returning from the Stripe portal or checkout fires a focus event; the
    // plan may have changed while the user was away.
    function onFocus() {
      void pull();
    }
    window.addEventListener("focus", onFocus);

    // One delayed re-check, for the race between the redirect and the webhook.
    const justPaid =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("checkout") === "success";
    const timer = justPaid ? window.setTimeout(() => void pull(), AFTER_CHECKOUT_RECHECK_MS) : null;

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      if (timer) window.clearTimeout(timer);
    };
  }, [signedIn, userId]);
}
