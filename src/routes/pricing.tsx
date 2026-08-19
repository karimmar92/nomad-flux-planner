import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { tier, type PlanId } from "@/config/pricing";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { getStripeEnvironment } from "@/lib/stripe";
import type { PaidPlanId } from "@/config/stripe-prices";
import { useSession, resolveSignedIn } from "@/lib/use-session";
import type { Plan } from "@/lib/types";

/** Deep-link params the homepage plan cards send, e.g. ?plan=pro&interval=annual. */
type PricingSearch = { plan?: PlanId; interval?: PlanCardBilling };

const DEEP_LINK_PLANS: PlanId[] = ["free", "starter", "pro", "teams"];

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): PricingSearch => {
    const plan = DEEP_LINK_PLANS.find((p) => p === search["plan"]);
    const interval = search["interval"] === "monthly" || search["interval"] === "annual"
      ? (search["interval"] as PlanCardBilling)
      : undefined;
    return {
      ...(plan ? { plan } : {}),
      ...(interval ? { interval } : {}),
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

function Pricing() {
  const { t } = useTranslation("common");
  const { profile, patchProfile } = useProfile();
  const { ready, signedIn } = useSession();
  const { plan: deepLinkPlan, interval: deepLinkInterval } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);
  const [billing, setBilling] = useState<PlanCardBilling>(deepLinkInterval ?? "annual");

  // Scroll the named tier into view once, so ?plan=pro lands on the card the
  // homepage button promised rather than at the top of the page.
  useEffect(() => {
    if (!deepLinkPlan) return;
    const el = document.getElementById(`plan-${deepLinkPlan}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [deepLinkPlan]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Free to put your data in. Paid to get the answers out. You are on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
      </div>

      {/*
        Above the plan table, on purpose. The founding offer is strictly better
        than any subscription for the first hundred people, so burying it under
        the monthly tiers would mean most readers price-anchor on $29/mo and
        never scroll to the thing we actually want them to take.
      */}
      <FoundingOffer />

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
