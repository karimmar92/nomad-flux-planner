/**
 * What the buyer sees in the seconds after paying.
 *
 * ── THE PROBLEM THIS SOLVES ────────────────────────────────────────────
 *
 * Before this existed, the return URL carried `?checkout=founding&session_id=…`
 * and the profile page ignored both. So the moment after handing over money,
 * the buyer saw an ordinary profile page and a product that still behaved as
 * though they had not paid. There was no confirmation, no receipt reference,
 * and no feature unlock — the arbitrage page stayed blurred.
 *
 * In a shop that is the worst possible moment to say nothing. The buyer has
 * just taken a risk on an unknown product, and silence reads as "it failed".
 * The next actions are a support email or a chargeback, and a chargeback costs
 * more than the sale.
 *
 * ── THE THREE STATES, ALL OF THEM SPOKEN ───────────────────────────────
 *
 * WORKING   — verification in flight. Says what is happening, not a bare
 *             spinner, because "checking your payment with Stripe" is
 *             reassuring and a spinner is not.
 * GRANTED   — confirms the plan by name, states that nothing else will be
 *             charged, and links straight to the thing they bought rather
 *             than leaving them to find it.
 * PENDING   — a real state, not an error. Delayed payment methods settle
 *             later, and telling somebody their payment failed when it has
 *             not is worse than telling them to wait.
 * FAILED    — Stripe's own words, plus what to do. Never "Something went
 *             wrong", which is the least useful sentence in software.
 *
 * ── WHY IT PATCHES THE LOCAL PLAN ──────────────────────────────────────
 *
 * Entitlement is read from the local profile, which usePlanSync refreshes
 * from the server. Waiting for that round trip means several seconds of a
 * paid customer still seeing locked features. The server has already written
 * the plan by the time this returns, so patching locally is not inventing an
 * entitlement, it is displaying one that already exists.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { verifyCheckoutSession } from "@/lib/billing/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useProfile } from "@/lib/store";
import { FOUNDING_PRICE_USD } from "@/config/founding";
import { VAT } from "@/config/legal";
import type { Plan } from "@/lib/types";

type State =
  | { kind: "working" }
  | { kind: "granted"; plan: string; foundingNumber: number | null }
  | { kind: "pending"; message: string }
  | { kind: "failed"; message: string };

const PLAN_LABEL: Record<string, string> = {
  founding_lifetime: "Founding Lifetime",
  pro: "Pro",
  starter: "Starter",
  teams: "Teams",
};

export function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const verify = useServerFn(verifyCheckoutSession);
  const { patchProfile } = useProfile();
  const [state, setState] = useState<State>({ kind: "working" });

  // Refs, so the effect does not re-run when the profile object is rebuilt.
  const patchRef = useRef(patchProfile);
  patchRef.current = patchProfile;

  const run = useCallback(async () => {
    setState({ kind: "working" });
    try {
      const result = await verify({
        data: { sessionId, environment: getStripeEnvironment() },
      });

      if ("error" in result) {
        setState(
          result.pending
            ? { kind: "pending", message: result.error }
            : { kind: "failed", message: result.error },
        );
        return;
      }

      patchRef.current({ plan: result.plan as Plan });
      setState({
        kind: "granted",
        plan: result.plan,
        foundingNumber: result.foundingNumber,
      });
    } catch (e) {
      setState({
        kind: "failed",
        message: e instanceof Error ? e.message : "Could not reach the payment service.",
      });
    }
  }, [sessionId, verify]);

  useEffect(() => {
    void run();
  }, [run]);

  if (state.kind === "working") {
    return (
      <Panel tone="neutral">
        <Loader2
          className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-muted-foreground"
          aria-hidden
        />
        <div>
          <p className="font-medium">Checking your payment with Stripe.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This takes a moment. You do not need to pay again.
          </p>
        </div>
      </Panel>
    );
  }

  if (state.kind === "granted") {
    const isFounding = state.plan === "founding_lifetime";
    return (
      <Panel tone="positive">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-positive" aria-hidden />
        <div>
          <p className="font-medium">
            Payment received. You are on {PLAN_LABEL[state.plan] ?? state.plan}.
          </p>
          {isFounding ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {state.foundingNumber ? `You are founding member #${state.foundingNumber}. ` : ""}
              You paid ${FOUNDING_PRICE_USD} once. There is no renewal and no card kept on file.{" "}
              {VAT.exempt ? "No VAT was added." : null}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Your receipt is on its way by email. You can cancel any time from the billing section
              below.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* /compare, not /explore. The blurred panel a buyer is most
                likely to have just bounced off is the comparison table, which
                gates on isPro(). Sending them to the thing they were blocked
                by is the point; a generic "go to dashboard" wastes the one
                moment they are certain to click. */}
            <Link
              to="/compare"
              search={{ cities: "" }}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Open the full comparison
            </Link>
            <Link
              to="/tracker"
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
            >
              Go to the tracker
            </Link>
          </div>
        </div>
      </Panel>
    );
  }

  if (state.kind === "pending") {
    return (
      <Panel tone="neutral">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">Your payment is still settling.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.message} Some payment methods take a few minutes. Your access opens automatically
            when the money arrives, and nothing further is needed from you.
          </p>
          <button
            type="button"
            onClick={() => void run()}
            className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Check again
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel tone="negative">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-negative" aria-hidden />
      <div>
        <p className="font-medium">We could not confirm that payment.</p>
        {/* Stripe's own message, verbatim. The buyer can quote it to support. */}
        <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          If your card was charged, do not pay again. Reply to your Stripe receipt and it will be
          sorted out by hand.
        </p>
        <button
          type="button"
          onClick={() => void run()}
          className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          Try again
        </button>
      </div>
    </Panel>
  );
}

function Panel({
  tone,
  children,
}: {
  tone: "neutral" | "positive" | "negative";
  children: React.ReactNode;
}) {
  const border =
    tone === "positive"
      ? "border-accent-positive/40 bg-accent-positive-muted"
      : tone === "negative"
        ? "border-negative/40 bg-negative-muted"
        : "border-border bg-surface-2";
  return (
    <section
      role="status"
      aria-live="polite"
      className={`flex gap-3 rounded-xl border p-4 ${border}`}
    >
      {children}
    </section>
  );
}
