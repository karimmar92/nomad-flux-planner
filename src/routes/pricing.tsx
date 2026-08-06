import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { PricingTable } from "@/components/PricingTable";
import { FaqList, PRICING_FAQ } from "@/components/marketing/Faq";
import { tier } from "@/config/pricing";
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
        content: "Free to put your data in. Paid to get the answers out. Prices on the page, no demo call.",
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Free to put your data in. Paid to get the answers out. You are on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
      </div>

      {/* TEMP until billing exists: local-only plan switch so gated features can
          be tested end to end. Remove when a real checkout sets profile.plan. */}
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold">Plan preview (testing)</div>
          <p className="text-xs text-muted-foreground">
            Billing isn&apos;t wired up yet. This switches plans on this device only.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["free", "starter", "pro", "teams"] as const).map((p: Plan) => (
            <button
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

      <PricingTable
        onChoose={() =>
          toast(t("pricing.toast.checkoutSoonTitle"), {
            description: t("pricing.toast.checkoutSoonDescription"),
          })
        }
      />

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
