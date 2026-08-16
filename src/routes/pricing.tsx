import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { PricingTable } from "@/components/PricingTable";
import { FoundingOffer } from "@/components/billing/FoundingOffer";
import { FaqList, PRICING_FAQ } from "@/components/marketing/Faq";
import { tier, type PlanId } from "@/config/pricing";
import { CheckoutDialog, type CheckoutRequest } from "@/components/billing/CheckoutDialog";
import { getStripeEnvironment } from "@/lib/stripe";
import type { PaidPlanId } from "@/config/stripe-prices";
import { useSession } from "@/lib/use-session";
import type { Plan } from "@/lib/types";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Pricing | ${APP_NAME}` },
      {
        name: "description",
        content: `Unlimited trip tracking, free forever. Starter $${tier("starter").monthlyUsd}/mo, Pro $${tier("pro").monthlyUsd}/mo, Teams $${tier("teams").monthlyUsd}/seat — two months free on annual.`,
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
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [checkout, setCheckout] = useState<CheckoutRequest | null>(null);

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

      <PricingTable
        // Until auth hydration completes, paid controls stay inert. Otherwise
        // a fast first click can be mistaken for a signed-out user and bounce
        // through /auth before the existing session is restored.
        busyPlan={ready ? busy : "account-session"}
        onChoose={(chosen, billing) => {
          if (!signedIn) {
            void navigate({ to: "/auth", search: { next: "/pricing" } });
            return;
          }
          if (chosen.id === "free") return;
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
          setBusy(chosen.id);
          /**
           * Seats are not sent from here. This previously sent a fixed count
           * for per-seat plans, so someone clicking Teams landed on a checkout
           * for seats they never asked for — a different price from the card
           * they clicked. The seat picker lives on the checkout form itself,
           * where the total updates as it changes.
           */
          setCheckout({
            plan: chosen.id as PaidPlanId,
            interval: billing === "annual" ? "yearly" : "monthly",
          });
        }}
      />

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
