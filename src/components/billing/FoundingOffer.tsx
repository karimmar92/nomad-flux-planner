/**
 * The Founding 100 offer card.
 *
 * ── UX DECISIONS, AND WHY ─────────────────────────────────────────────
 *
 * THE COUNTER IS FETCHED, NOT FAKED. It comes from a COUNT() over the
 * profiles table via an RPC that returns one integer and no rows. If the
 * fetch fails the card renders WITHOUT a number rather than guessing:
 * an invented scarcity figure is misleading advertising, and on a page
 * whose neighbouring section admits the product has no customers, it
 * would also be self-defeating.
 *
 * NO COUNTDOWN TIMER. Scarcity here is a real cap, so it needs no theatre.
 * A ticking clock would be the single most obvious tell that the honesty
 * elsewhere on the page is a technique rather than a position.
 *
 * THE RISK NOTE IS ABOVE THE BUTTON, NOT BELOW IT. Anything a buyer
 * would be annoyed to discover afterwards belongs before they decide.
 * That is worth a few conversions: someone who buys having read "this may
 * shut down" does not file a chargeback in a year, and a chargeback costs
 * more than the sale plus the dispute fee.
 *
 * SOLD OUT STAYS SOLD OUT. When it closes, the card explains what
 * happened and points at the normal plans. It does not reappear next
 * month with a bigger number.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Infinity as InfinityIcon, Minus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchFoundingTaken } from "@/lib/founding/rpc";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { createFoundingCheckout } from "@/lib/billing/billing.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useSession } from "@/lib/use-session";
import { useProfile } from "@/lib/store";
import {
  FOUNDING_EXCLUDES,
  FOUNDING_INCLUDES,
  FOUNDING_PRICE_USD,
  FOUNDING_RISK_NOTE,
  FOUNDING_SPOTS,
  foundingCounterLabel,
  foundingIsOpen,
} from "@/config/founding";
import { tier } from "@/config/pricing";

export function FoundingOffer() {
  const { ready, signedIn } = useSession();
  const { profile } = useProfile();
  const [taken, setTaken] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createSession = useServerFn(createFoundingCheckout);
  const busy = false;

  useEffect(() => {
    let active = true;
    // Leaves `taken` null on failure. The card then shows no count at all,
    // which is honest, rather than a number we made up.
    void fetchFoundingTaken(supabase).then((n) => {
      if (active && n != null) setTaken(n);
    });
    return () => {
      active = false;
    };
  }, []);

  const soldOut = taken != null && !foundingIsOpen(taken);
  const proYear = tier("pro").monthlyUsd * 12;

  /**
   * Embedded checkout, matching the subscription flow. The server returns a
   * client secret rather than a redirect URL, so the payment form opens inside
   * the app and the buyer never leaves the page they decided on.
   */
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createSession({
      data: {
        environment: getStripeEnvironment(),
        // Stripe substitutes the session id server-side before returning here.
        returnUrl: `${window.location.origin}/profile?checkout=founding&session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    // Stripe's own message verbatim. "Something went wrong" mid-payment is the
    // least useful sentence in software.
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Checkout could not be started.");
    return result.clientSecret;
  }, [createSession]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <section className="panel border-primary/40 ring-1 ring-primary/15 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-xs text-primary">Founding {FOUNDING_SPOTS}</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Pay once. Keep it.
          </h2>
        </div>
        {taken != null ? (
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {foundingCounterLabel(taken)}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="num text-4xl font-semibold">${FOUNDING_PRICE_USD}</span>
        <span className="text-sm text-muted-foreground">once, not per month</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Pro is ${tier("pro").monthlyUsd}/mo, so this pays for itself in under four months and then
        never asks again. Compare ${proYear} for a year.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What you get</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {FOUNDING_INCLUDES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">What it does not cover</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {FOUNDING_EXCLUDES.map((f) => (
              <li key={f} className="flex gap-2">
                <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Before the button, deliberately. See the header note. */}
      <p className="mt-5 rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Read this first.</span> {FOUNDING_RISK_NOTE}
      </p>

      {soldOut ? (
        <div className="mt-5">
          <p className="text-sm font-medium">All {FOUNDING_SPOTS} spots are gone.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            That was the whole offer, and it will not come back with a bigger number. The monthly
            plans below are the way in now.
          </p>
        </div>
      ) : profile.plan !== "free" ? (
        <p className="mt-5 text-sm text-muted-foreground">
          You are already on a paid plan. If you would rather hold a founding spot than keep
          subscribing, email us and we will sort it out.
        </p>
       ) : !ready ? (
         <button
           type="button"
           disabled
           className="mt-5 inline-flex cursor-wait items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground opacity-60"
         >
           <InfinityIcon className="h-4 w-4" aria-hidden />
           Checking account…
         </button>
       ) : signedIn ? (
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <InfinityIcon className="h-4 w-4" aria-hidden />
            {busy ? "Opening checkout…" : `Take a founding spot — $${FOUNDING_PRICE_USD}`}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-negative">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <Link
          to="/auth"
          search={{ next: "/pricing" }}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <InfinityIcon className="h-4 w-4" aria-hidden />
          Sign in to take a spot
        </Link>
      )}

      {open ? (
        <div className="mt-4 rounded-md border border-border p-2">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        One payment, no subscription, nothing to cancel. 14-day right of withdrawal applies as
        normal.{" "}
        <Link to="/legal/refunds" className="underline underline-offset-2 hover:text-foreground">
          Refund policy
        </Link>
      </p>
    </section>
  );
}
