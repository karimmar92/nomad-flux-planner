import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { PlanCardGrid, type PlanCardBilling } from "@/components/marketing/PlanCards";
import { VAT } from "@/config/legal";
import { FOUNDING_PRICE_USD } from "@/config/founding";
import { FoundingOffer } from "@/components/billing/FoundingOffer";
import { FaqList, PRICING_FAQ } from "@/components/marketing/Faq";
import { annualUsd, tier, type PlanId } from "@/config/pricing";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { getStripeEnvironment } from "@/lib/stripe";
import type { BillingInterval, PaidPlanId } from "@/config/stripe-prices";
import {
  intentMatches,
  pricingNextUrl,
  takePurchaseIntent,
  writePurchaseIntent,
} from "@/lib/billing/purchase-intent";
import { useSession, resolveSignedIn } from "@/lib/use-session";
import type { Plan } from "@/lib/types";

/**
 * Deep-link params.
 *
 * `plan`/`interval` alone mean HIGHLIGHT AND SCROLL, nothing more — a homepage
 * "Choose Pro" click must not fire a payment sheet at someone who was only
 * browsing. `checkout=1` / `founding=1` are the separate, explicit signal that
 * a purchase was already chosen and interrupted by sign-in.
 */
type PricingSearch = {
  plan?: PlanId;
  interval?: PlanCardBilling;
  checkout?: boolean;
  founding?: boolean;
};

const DEEP_LINK_PLANS: PlanId[] = ["free", "starter", "pro", "teams"];

const truthy = (v: unknown) => v === true || v === "1" || v === "true";

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): PricingSearch => {
    const plan = DEEP_LINK_PLANS.find((p) => p === search["plan"]);
    const interval = search["interval"] === "monthly" || search["interval"] === "annual"
      ? (search["interval"] as PlanCardBilling)
      : undefined;
    return {
      ...(plan ? { plan } : {}),
      ...(interval ? { interval } : {}),
      ...(truthy(search["checkout"]) ? { checkout: true } : {}),
      ...(truthy(search["founding"]) ? { founding: true } : {}),
    };
  },

  head: () => ({
    meta: [
      { title: `Pricing | ${APP_NAME}` },
      {
        name: "description",
        content: `Unlimited trip tracking, free forever. Pro $${tier("pro").monthlyUsd}/mo with two months free on annual, or $${FOUNDING_PRICE_USD} once for the Founding 100.`,
      },
      { property: "og:title", content: `Pricing | ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Free to put your data in. Paid to get the answers out. Prices on the page, no demo call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

/** What the confirm button names, so nobody clicks without seeing the price. */
function planLabel(plan: PaidPlanId, interval: BillingInterval): string {
  const t = tier(plan as PlanId);
  return interval === "yearly"
    ? `${t.name}, annual · $${annualUsd(t)}/yr`
    : `${t.name}, monthly · $${t.monthlyUsd}/mo`;
}

function Pricing() {
  const { t } = useTranslation("common");
  const { profile, patchProfile } = useProfile();
  const { ready, signedIn } = useSession();
  const {
    plan: deepLinkPlan,
    interval: deepLinkInterval,
    checkout: wantCheckout,
    founding: wantFounding,
  } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const [confirm, setConfirm] = useState<CheckoutRequest | null>(null);
  const [foundingAutoOpen, setFoundingAutoOpen] = useState(false);
  const [alreadyOwned, setAlreadyOwned] = useState<string | null>(null);
  const [billing, setBilling] = useState<PlanCardBilling>(deepLinkInterval ?? "annual");
  const arrivalHandled = useRef(false);

  // Scroll the named tier into view once, so ?plan=pro lands on the card the
  // homepage button promised rather than at the top of the page.
  useEffect(() => {
    if (!deepLinkPlan) return;
    const el = document.getElementById(`plan-${deepLinkPlan}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [deepLinkPlan]);

  /** Once the purchase is done or abandoned, a refresh must not reopen it. */
  const clearIntentParams = useCallback(() => {
    void navigate({
      to: "/pricing",
      search: (prev: Record<string, unknown>) => {
        const { checkout: _c, founding: _f, ...rest } = prev;
        return rest as PricingSearch;
      },
      replace: true,
    });
  }, [navigate]);

  /**
   * Arrival. Runs at most once — dismissing the dialog must never reopen it.
   *
   * The URL says what was chosen; the session record says whether this is the
   * same continuous action. Fresh + matching opens Stripe straight away; the
   * durable intent alone gets a confirm step instead.
   */
  useEffect(() => {
    if (arrivalHandled.current) return;
    if (!wantCheckout && !wantFounding) return;
    arrivalHandled.current = true;
    const intent = takePurchaseIntent();

    if (wantFounding) {
      if (profile.plan === "founding_lifetime") {
        setAlreadyOwned("You already hold a founding spot — there is nothing more to pay.");
        clearIntentParams();
        return;
      }
      document.getElementById("founding")?.scrollIntoView({ behavior: "smooth", block: "center" });
      // Without a fresh record the founding card's own button is the confirm
      // step: it already names the offer and the exact price.
      if (!intentMatches(intent, { founding: true })) return;
      void (async () => {
        const authed = ready ? signedIn : await resolveSignedIn();
        if (authed) setFoundingAutoOpen(true);
      })();
      return;
    }

    if (!deepLinkPlan || deepLinkPlan === "free") return;
    const plan = deepLinkPlan as PaidPlanId;
    const interval: BillingInterval =
      (deepLinkInterval ?? "annual") === "annual" ? "yearly" : "monthly";

    if (profile.plan === plan || profile.plan === "founding_lifetime") {
      setAlreadyOwned(
        profile.plan === "founding_lifetime"
          ? "Your founding spot already covers everything in Pro."
          : `You are already on the ${tier(plan as PlanId).name} plan.`,
      );
      clearIntentParams();
      return;
    }

    try {
      getStripeEnvironment();
    } catch (e) {
      toast("Checkout is not available", {
        description: e instanceof Error ? e.message : undefined,
      });
      clearIntentParams();
      return;
    }

    const request: CheckoutRequest = { plan, interval };
    if (!intentMatches(intent, { plan, interval })) {
      setConfirm(request);
      return;
    }
    void (async () => {
      const authed = ready ? signedIn : await resolveSignedIn();
      if (!authed) {
        setConfirm(request);
        return;
      }
      setCheckout(request);
    })();
  }, [
    wantCheckout,
    wantFounding,
    deepLinkPlan,
    deepLinkInterval,
    profile.plan,
    ready,
    signedIn,
    clearIntentParams,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Free to put your data in. Paid to get the answers out. You are on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
      </div>

      {alreadyOwned ? (
        <div className="panel border-positive/40 p-4 text-sm">
          {alreadyOwned}{" "}
          <Link to="/tracker" className="underline hover:text-foreground">
            Go to your tracker
          </Link>
          .
        </div>
      ) : null}

      {/*
        THE CONFIRM STEP.

        The URL carries a purchase intent but no fresh session record — an
        email-confirmation link, a new tab, another device. Opening a payment
        sheet out of that reads as a trap, so one unmissable button names
        exactly what is being charged and waits for a click.
      */}
      {confirm ? (
        <div
          className="panel flex flex-wrap items-center justify-between gap-3 border-primary/40 p-4"
          role="region"
          aria-label="Confirm your plan"
        >
          <div>
            <div className="text-sm font-semibold">Ready to finish?</div>
            <p className="text-xs text-muted-foreground">
              You picked {planLabel(confirm.plan, confirm.interval)} before signing in.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCheckout(confirm);
                setConfirm(null);
              }}
              className="min-h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue — {planLabel(confirm.plan, confirm.interval)}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirm(null);
                clearIntentParams();
              }}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Choose a different plan
            </button>
          </div>
        </div>
      ) : null}

      {/*
        Above the plan table, on purpose. The founding offer is strictly better
        than any subscription for the first hundred people, so burying it under
        the monthly tiers would mean most readers price-anchor on $29/mo and
        never scroll to the thing we actually want them to take.
      */}
      <FoundingOffer autoOpen={foundingAutoOpen} onAutoOpened={clearIntentParams} />


      {/*
        DEV ONLY — and it was not.

        This block shipped publicly with the label "Plan preview (testing)" and
        four buttons that set profile.plan to any tier. Entitlements are read
        from profile.plan, so every paid feature was two clicks away from free,
        on the pricing page, for anyone. Its own comment said "remove when a
        real checkout sets profile.plan" — that checkout now exists.

        `import.meta.env.DEV` is statically replaced at build time, so this
        whole subtree is eliminated from the production bundle rather than
        merely hidden.

        Note the wider point this exposes: profile.plan lives in localStorage,
        so client-side gating can always be edited by a determined user. That
        is acceptable for UI gating, but anything that must be paid for on the
        server — exports, the vault, reports — has to check entitlement
        server-side too. See the launch checklist.
      */}
      {import.meta.env.DEV ? (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-dashed p-4">
          <div>
            <div className="text-sm font-semibold">Plan switch (dev build only)</div>
            <p className="text-xs text-muted-foreground">
              Switches plans on this device so gated features can be tested. Not present in
              production builds.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["free", "starter", "pro", "teams"] as const).map((p: Plan) => (
              <button
                type="button"
                key={p}
                onClick={() => patchProfile({ plan: p })}
                className={
                  profile.plan === p
                    ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    : "rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
                }
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* The same cards as the homepage, deliberately. Someone who clicked
          "Choose Pro" there should recognise what they land on; a different
          pricing presentation at the point of payment is where trust goes. */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <div
            className="inline-flex rounded-full border border-border p-1"
            role="group"
            aria-label="Billing period"
          >
            {(["monthly", "annual"] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBilling(b)}
                aria-pressed={billing === b}
                className={
                  billing === b
                    ? "min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
                    : "min-h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {b === "monthly" ? "Monthly" : "Annual · two months free"}
              </button>
            ))}
          </div>
        </div>

        <PlanCardGrid
          billing={billing}
          busyPlan={busy}
          highlight={deepLinkPlan ?? null}
          onSelect={(chosen, chosenBilling) => {
            if (chosen === "free") {
              void navigate({ to: "/tracker" });
              return;
            }
            try {
              // Throws when the build shipped without a payments token. Better a
              // named error here than a dead button or a broken form.
              getStripeEnvironment();
            } catch (e) {
              toast("Checkout is not available", {
                description: e instanceof Error ? e.message : undefined,
              });
              return;
            }
            setBusy(chosen);
            void (async () => {
              // Auth hydration NEVER disables a purchase button: if the session
              // has not resolved when the click arrives, resolve it here.
              const authed = ready ? signedIn : await resolveSignedIn();
              if (!authed) {
                setBusy(null);
                void navigate({ to: "/auth", search: { next: "/pricing" } });
                return;
              }
              setCheckout({
                plan: chosen as PaidPlanId,
                interval: chosenBilling === "annual" ? "yearly" : "monthly",
              });
            })();
          }}
        />

        <p className="text-center text-xs text-muted-foreground">
          {VAT.notice} Managing several people?{" "}
          <Link to="/business" className="underline hover:text-foreground">
            See how team accounts work
          </Link>
          .
        </p>
      </div>



      {checkout ? (
        <CheckoutDialog
          request={checkout}
          onClose={() => {
            setCheckout(null);
            setBusy(null);
          }}
        />
      ) : null}


      <section className="panel flex items-start gap-2.5 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {/* Scoped deliberately. The unlock covers the border-run list only —
              exports, alerts and the vault stay gated. A published promise about
              a paid service is one you can be held to, so the copy states
              exactly what the code does. src/lib/entitlements.test.ts pins it. */}
          You are never left stranded behind the paywall. If you are over a limit, or within seven
          days of one, the full ranked{" "}
          <Link to="/tracker" className="underline hover:text-foreground">
            border-run list
          </Link>{" "}
          opens regardless of plan. Someone about to overstay is not someone to charge.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Questions people ask before paying</h2>
        <FaqList items={PRICING_FAQ} />
      </section>
    </div>
  );
}
