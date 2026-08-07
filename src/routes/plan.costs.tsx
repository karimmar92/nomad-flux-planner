/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. This page exists to give people
 * an honest, slightly pessimistic number for what leaving costs. A shopping
 * list attached to a budget stops being a budget.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CITIES } from "@/lib/cities";
import { flagEmoji, formatUsd } from "@/lib/arbitrage";
import { setupBudget } from "@/lib/plan/runway";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan/costs")({
  head: () => ({
    meta: [
      { title: `What it actually costs to start | ${APP_NAME}` },
      {
        name: "description",
        content:
          "The one-off cost of leaving: flights, deposit, insurance, visa fees, gear and a buffer. A realistic range, not an aspirational one.",
      },
      { property: "og:title", content: "What it actually costs to start as a nomad" },
      {
        property: "og:description",
        content:
          "Most people underestimate the one-off setup cost, and it's the main reason first attempts end early.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CostsPage,
});

function CostsPage() {
  const [cityId, setCityId] = useState("chiang-mai-th");
  const [tier, setTier] = useState<"lean" | "mid">("lean");
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0]!;
  const budget = setupBudget(city, tier);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Before you go</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            What it actually costs to start
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Everything you pay before your first ordinary month begins. These ranges are
            deliberately cautious: running out in month two is the most common way a first move
            ends, and an optimistic number would be the least useful thing we could print.
          </p>
        </div>
        <Link to="/plan" className="text-xs text-muted-foreground hover:text-foreground">
          Back to planning
        </Link>
      </header>

      <section className="panel grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label className="label-xs" htmlFor="cost-city">
            Destination
          </label>
          <select
            id="cost-city"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city}, {c.country}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label-xs">Cost tier</span>
          <div className="mt-1 flex rounded-md border border-border p-0.5 text-sm">
            {(["lean", "mid"] as const).map((t) => (
              <button type="button"
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "flex-1 rounded px-2 py-1.5",
                  tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t === "lean" ? "Lean" : "Mid-range"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Shareable block */}
      <section className="panel overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            <span aria-hidden>{flagEmoji(city.country_code)}</span> Starting in {city.city}
          </h2>
          <span className="label-xs">{APP_NAME}</span>
        </div>

        <div className="grid gap-4 bg-surface-2/40 px-4 py-5 sm:grid-cols-3">
          <div>
            <span className="label-xs">One-off setup</span>
            <p className="num mt-1 text-3xl font-semibold sm:text-4xl">
              {formatUsd(budget.low)}–{formatUsd(budget.high)}
            </p>
            <p className="text-xs text-muted-foreground">Before you have lived there a single day.</p>
          </div>
          <div>
            <span className="label-xs">Plus {budget.monthsOfCostsIncluded} months of living costs</span>
            <p className="num mt-1 text-3xl font-semibold sm:text-4xl">
              {formatUsd(budget.recommendedTotal - budget.high)}
            </p>
            <p className="text-xs text-muted-foreground">
              The buffer that turns a bad first month into an inconvenience.
            </p>
          </div>
          <div>
            <span className="label-xs">Cash on hand we'd want to see</span>
            <p className="num mt-1 text-3xl font-semibold text-positive sm:text-4xl">
              {formatUsd(budget.recommendedTotal)}
            </p>
            <p className="text-xs text-muted-foreground">
              Top of the setup range plus the buffer, at the{" "}
              {tier === "lean" ? "lean" : "mid-range"} tier.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {budget.lines.map((line) => (
            <li key={line.key} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{line.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{line.note}</p>
              </div>
              <span className="num shrink-0 text-sm font-semibold">
                {formatUsd(line.low)}–{formatUsd(line.high)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Ranges are estimates built from the seed cost data and typical fares, not quotes. Fares,
        deposits and visa fees vary by season, nationality and how far ahead you book. Check the
        current figures before you commit to any of them.{" "}
        <Link to="/plan" className="text-primary hover:underline">
          Turn this into months of runway
        </Link>
        .
      </p>

      <LegalFooter />
    </div>
  );
}
