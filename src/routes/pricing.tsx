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
  const { profile } = useProfile();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-sm text-muted-foreground">
          Free to put your data in. Pro to get the answers out. You are on the{" "}
          <span className="font-medium capitalize text-foreground">{profile.plan}</span> plan.
        </p>
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
          <p className="text-xs text-muted-foreground">
            The forward-looking and the exportable. Billed monthly or yearly.
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
          Nothing is ever gated mid-emergency. If you are over a limit, or within seven days of
          one, the full ranked{" "}
          <Link to="/tracker" className="underline hover:text-foreground">
            border-run list
          </Link>{" "}
          opens regardless of plan. Someone about to overstay is not someone to charge $9.
        </p>
      </section>
    </div>
  );
}
