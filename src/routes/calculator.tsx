/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The arbitrage calculator
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CITIES } from "@/lib/cities";
import { computeArbitrage, flagEmoji, formatUsd, monthsToTarget } from "@/lib/arbitrage";
import { useProfile } from "@/lib/store";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";
import { isPro } from "@/lib/entitlements";
import { LockedPreview } from "@/components/ProGate";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: `Arbitrage calculator | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Rank every city by monthly and annual surplus on your income, and see how long each takes to hit your savings target.",
      },
      { property: "og:title", content: `Arbitrage calculator | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Rank every city by what you'd actually keep on your income.",
      },
    ],
  }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const { profile, patchProfile } = useProfile();
  const [income, setIncome] = useState<string>(profile.monthly_income_usd?.toString() ?? "");
  const [target, setTarget] = useState("50000");
  const [tier, setTier] = useState<"lean" | "mid">("mid");

  const inc = income ? Number(income) : null;
  const targetNum = target ? Number(target) : 0;
  // FREE: arbitrage against one chosen city. PRO: the ranking across all of
  // them, plus the savings-target column.
  const pro = isPro(profile.plan);
  const [focusId, setFocusId] = useState<string>(CITIES[0]!.id);
  const focusCity = CITIES.find((c) => c.id === focusId) ?? CITIES[0]!;
  const focusArb = computeArbitrage(focusCity, inc, tier);

  const rows = CITIES.map((city) => {
    const arb = computeArbitrage(city, inc, tier);
    return { city, arb, months: monthsToTarget(arb.surplusMonthly, targetNum) };
  }).sort((a, b) => b.arb.surplusMonthly - a.arb.surplusMonthly);
  const best = rows[0];

  const rankingTable = (
      <section className="panel overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {inc ? `${formatUsd(inc)}/mo across ${CITIES.length} cities` : "Enter an income"}
          </h2>
          <span className="label-xs">{APP_NAME}</span>
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-start">
                <Th>City</Th>
                <Th right>Cost/mo</Th>
                <Th right>Surplus/mo</Th>
                <Th right>Surplus/yr</Th>
                <Th right>Rate</Th>
                <Th right>To {formatUsd(targetNum)}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ city, arb, months }) => (
                <tr key={city.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/city/$cityId"
                      params={{ cityId: city.id }}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <span aria-hidden>{flagEmoji(city.country_code)}</span>
                      <span className="font-medium">{city.city}</span>
                      <span className="text-xs text-muted-foreground">{city.country}</span>
                    </Link>
                  </td>
                  <Td right>{formatUsd(arb.cost)}</Td>
                  <Td
                    right
                    className={cn(
                      "font-semibold",
                      inc ? (arb.surplusMonthly >= 0 ? "text-positive" : "text-negative") : "",
                    )}
                  >
                    {inc ? formatUsd(arb.surplusMonthly) : "—"}
                  </Td>
                  <Td right>{inc ? formatUsd(arb.surplusAnnual) : "—"}</Td>
                  <Td right>{inc ? `${arb.savingsRate.toFixed(0)}%` : "—"}</Td>
                  <Td right>
                    {!inc || months == null
                      ? "Never"
                      : months < 12
                        ? `${months.toFixed(1)} mo`
                        : `${(months / 12).toFixed(1)} yr`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Surplus = income − (rent central + coworking + groceries + eating out + utilities +
          mobile + transport + gym) at the {tier === "mid" ? "mid-range" : "lean"} tier. Each
          city page shows its last-verified date.
        </p>
      </section>
  );

  const rankingSection = pro ? (
    rankingTable
  ) : (
    <>
      <section className="panel p-4">
        <h2 className="text-sm font-semibold">
          {flagEmoji(focusCity.country_code)} {focusCity.city} on {inc ? formatUsd(inc) : "your income"}
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="label-xs">Cost/mo</div>
            <div className="num text-lg font-semibold">{formatUsd(focusArb.cost)}</div>
          </div>
          <div>
            <div className="label-xs">Surplus/mo</div>
            <div
              className={cn(
                "num text-lg font-semibold",
                inc ? (focusArb.surplusMonthly >= 0 ? "text-positive" : "text-negative") : "",
              )}
            >
              {inc ? formatUsd(focusArb.surplusMonthly) : "—"}
            </div>
          </div>
          <div>
            <div className="label-xs">Surplus/yr</div>
            <div className="num text-lg font-semibold">
              {inc ? formatUsd(focusArb.surplusAnnual) : "—"}
            </div>
          </div>
        </div>
      </section>
      <LockedPreview
        headline={
          inc && best
            ? `Best of ${CITIES.length} cities is ${best.city.city} · ${formatUsd(best.arb.surplusMonthly)}/mo surplus`
            : `All ${CITIES.length} cities ranked by what you would keep`
        }
        detail="Pro ranks every city at once on your income and shows how long each one takes to hit a savings target."
      >
        {rankingTable}
      </LockedPreview>
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Arbitrage calculator</h1>
        <p className="text-sm text-muted-foreground">
          Every city ranked by what you&apos;d actually keep.
        </p>
      </div>

      <section className="panel grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="label-xs" htmlFor="calc-income">
            Monthly income (USD)
          </label>
          <input
            id="calc-income"
            inputMode="numeric"
            value={income}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setIncome(v);
              patchProfile({ monthly_income_usd: v ? Number(v) : null });
            }}
            placeholder="5000"
            className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
          />
        </div>
        {pro ? (
          <div>
            <label className="label-xs" htmlFor="calc-target">
              Savings target (USD)
            </label>
            <input
              id="calc-target"
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/\D/g, ""))}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div>
            <label className="label-xs" htmlFor="calc-city">
              City
            </label>
            <select
              id="calc-city"
              value={focusId}
              onChange={(e) => setFocusId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.city}, {c.country}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <span className="label-xs">Cost tier</span>
          <div className="mt-1 flex rounded-md border border-border p-0.5 text-sm">
            {(["lean", "mid"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "flex-1 rounded px-2 py-1.5",
                  tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t === "mid" ? "Mid-range" : "Lean"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {rankingSection}
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn("label-xs px-4 py-2 font-medium", right && "text-end")}>{children}</th>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("num px-4 py-2.5", right && "text-end", className)}>{children}</td>
  );
}
