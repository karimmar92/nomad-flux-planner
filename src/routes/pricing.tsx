import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: `Pricing | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Unlimited trip tracking, free forever. Pro at $9/mo adds the border-run planner, forward planning, alerts, exports, the vault and full city ranking.",
      },
      { property: "og:title", content: `Pricing | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Free to put your data in. Pro at $9/mo to get the answers out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

/**
 * The split: free to put data in, paid to get value out. Copy order matters —
 * "unlimited trip tracking, free forever" is the first line of the free column
 * because the tracker is the habit loop, not the paywall.
 */
const FREE = [
  "Unlimited trip tracking, free forever — no cap, ever",
  "Your Schengen 90/180 status today: days used, days remaining",
  "Day counts for every country you have visited, against each threshold",
  "Every city, with the full cost breakdown",
  "The whole “Before you go” planning track",
  "The LLC eligibility tool",
  "The collaboration radar",
  "Arbitrage against one city you choose",
];

const PRO = [
  "Border-run planner — every exit ranked, not just the top one",
  "Forward planning — “if I enter on 3 October, how long can I stay?” and full-year trip planning",
  "Threshold alerts at 75% and 90%, by email and in-app",
  "Tax presence report, and all exports (PDF, CSV)",
  "Document vault",
  "Compare across cities",
  "Full arbitrage ranking across every city, plus the savings-target calculator",
  "Compliance calendar beyond the next 30 days",
];

function Pricing() {
  const { t } = useTranslation("common");
  const { profile, patchProfile } = useProfile();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Free to put your data in. Pro to get the answers out. You are on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
      </div>

      {/* TEMP until billing exists: local-only Pro preview so Pro features can
          be tested end to end. Remove when a real checkout flips profile.plan. */}
      <div className="panel flex items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold">Pro preview (testing)</div>
          <p className="text-xs text-muted-foreground">
            Billing isn&apos;t wired up yet. This toggles Pro on this device only, so the
            gated features can be tried before checkout exists.
          </p>
        </div>
        <button
          onClick={() => patchProfile({ plan: profile.plan === "pro" ? "free" : "pro" })}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
        >
          {profile.plan === "pro" ? "Switch to Free" : "Enable Pro preview"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <h2 className="text-sm font-semibold">Free</h2>
          <div className="num mt-1 text-3xl font-semibold">$0</div>
          <p className="text-xs text-muted-foreground">
            Everything you need to build a record, and to know when something is wrong.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel border-primary/50 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pro</h2>
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              Recommended
            </span>
          </div>
          <div className="num mt-1 text-3xl font-semibold">
            $9
            <span className="text-base font-normal text-muted-foreground">/mo</span>
          </div>
          {/* PAngV: once checkout is live, consumer prices must be shown as the
              total payable INCLUDING VAT. VAT on digital services is due in the
              customer's country (OSS), so this line needs to become a gross
              price — or state that VAT is added — before the first charge. */}
          <p className="text-xs text-muted-foreground">
            The forward-looking and the exportable. Billed monthly or yearly. Checkout is not open
            yet — prices shown are indicative and will be confirmed including VAT.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() =>
                toast(t("pricing.toast.checkoutSoonTitle"), {
                  description: t("pricing.toast.checkoutSoonDescription"),
                })
              }
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Go Pro monthly
            </button>
            <button
              onClick={() =>
                toast(t("pricing.toast.checkoutSoonTitle"), {
                  description: t("pricing.toast.checkoutSoonDescription"),
                })
              }
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-medium"
            >
              Yearly
            </button>
          </div>
        </div>
      </div>

      <section className="panel flex items-start gap-2.5 p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {/* Scoped deliberately. The unlock covers the border-run list only —
              exports, alerts and the vault stay gated. "Nothing is ever gated
              mid-emergency" read as a broader promise than the code keeps, and
              a published promise about a paid service is one you can be held
              to. src/lib/entitlements.test.ts pins both halves. */}
          You are never left stranded behind the paywall. If you are over a limit, or within seven
          days of one, the full ranked{" "}
          <Link to="/tracker" className="underline hover:text-foreground">
            border-run list
          </Link>{" "}
          opens regardless of plan. Someone about to overstay is not someone to charge.
        </p>
      </section>
    </div>
  );
}
