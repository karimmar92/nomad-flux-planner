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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Infinity as InfinityIcon, Minus } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchFoundingTaken } from "@/lib/founding/rpc";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { createFoundingCheckout } from "@/lib/billing/billing.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { pricingNextUrl, writePurchaseIntent } from "@/lib/billing/purchase-intent";

import { useSession, resolveSignedIn } from "@/lib/use-session";
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

export function FoundingOffer({
  autoOpen = false,
  onAutoOpened,
}: {
  /** Set by /pricing when a FRESH founding intent survived the sign-in. */
  autoOpen?: boolean;
  onAutoOpened?: () => void;
} = {}) {
  const { ready, signedIn } = useSession();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [taken, setTaken] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createSession = useServerFn(createFoundingCheckout);
  const createSessionRef = useRef(createSession);
  createSessionRef.current = createSession;
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const autoOpenedRef = useRef(false);

  // At most once per arrival: dismissing the form must not reopen it.
  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current) return;
    if (profile.plan !== "free") return;
    autoOpenedRef.current = true;
    try {
      getStripeEnvironment();
    } catch (e) {
      toast("Checkout is not available", {
        description: e instanceof Error ? e.message : undefined,
      });
      onAutoOpened?.();
      return;
    }
    setOpen(true);
    onAutoOpened?.();
  }, [autoOpen, profile.plan, onAutoOpened]);




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
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = createSessionRef.current({
        data: {
          environment: getStripeEnvironment(),
          // Stripe substitutes the session id server-side before returning here.
          returnUrl: `${window.location.origin}/profile?checkout=founding&session_id={CHECKOUT_SESSION_ID}`,
        },
      }).then((result) => {
        if ("error" in result) throw new Error(result.error);
        if (!result.clientSecret) throw new Error("Checkout could not be started.");
        return result.clientSecret;
      });
      // Otherwise the buyer just sees an empty iframe. Close it and say why.
      sessionPromiseRef.current.catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Please try again.";
        setError(message);
        toast("Checkout could not be opened", { description: message });
        sessionPromiseRef.current = null;
        setOpen(false);
      });
    }

    return sessionPromiseRef.current;
  }, []);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <section id="founding" className="panel border-primary/40 ring-1 ring-primary/15 p-6">
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

      {/*
        THE TOTAL, STATED BEFORE THE BUTTON.
        The single most common complaint about any checkout is a number going
        up between the page and the payment screen. Nothing is added here — no
        VAT under § 19 UStG, no renewal, no stored card — so say all three
        plainly at the point of decision rather than leaving the buyer to find
        out by clicking. The payback line is derived, not written by hand: it
        was hardcoded as "under four months" and silently became wrong the
        moment the price moved.
      */}
      <p className="mt-2 text-sm font-medium">
        ${FOUNDING_PRICE_USD} is the total you pay. No VAT on top, no renewal, no card kept on file.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pro is ${tier("pro").monthlyUsd}/mo, so this pays for itself in under{" "}
        {Math.ceil(FOUNDING_PRICE_USD / tier("pro").monthlyUsd)} months and then never asks again.
        Compare ${proYear} for a single year.
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
      ) : (
        <>
          {/*
            ONE BUTTON, ALWAYS CLICKABLE.

            This used to render a permanently disabled "Checking account…"
            while the session hydrated. When the session read failed, `ready`
            never became true and the offer had no buy button at all — the
            reason people reported the founding spot could not be purchased.
            The session is resolved on click instead: signed in opens checkout,
            signed out goes to /auth.
          */}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setBusy(true);
              void (async () => {
                const authed = ready ? signedIn : await resolveSignedIn();
                setBusy(false);
                if (!authed) {
                  // The choice travels twice: durably in the URL, and freshly
                  // in sessionStorage so a same-tab sign-in reopens instantly.
                  writePurchaseIntent({ founding: true });
                  void navigate({
                    to: "/auth",
                    search: { next: pricingNextUrl({ founding: true }) },
                  });
                  return;
                }

                setOpen(true);
              })();
            }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <InfinityIcon className="h-4 w-4" aria-hidden />
            {busy || open ? "Opening checkout…" : `Take a founding spot — $${FOUNDING_PRICE_USD}`}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-negative">
              {error}
            </p>
          ) : null}
        </>
      )}


      {open ? (
        <div className="mt-4 rounded-md border border-border p-2">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                // Closed without paying: drop ?founding=1 so a refresh does not
                // put the payment form back in front of them.
                onAutoOpened?.();
              }}
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
