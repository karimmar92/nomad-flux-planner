/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The arbitrage calculator
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CITIES } from "@/lib/cities";
import {
  computeArbitrage,
  flagEmoji,
  formatUsd,
  monthsToTarget,
  type CostTier,
} from "@/lib/arbitrage";
import { formatLocal, isVolatileCurrency, FX_AS_OF } from "@/lib/fx";
import {
  DEFAULT_FREELANCE_INPUTS,
  TAX_REGIMES,
  computeFreelanceIncome,
  computeScenarios,
  hoursPerClientPerDay,
  type FreelanceInputs,
} from "@/lib/freelance";
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
  const [tier, setTier] = useState<CostTier>("mid");

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
                  <Td right>
                    <div>{formatUsd(arb.cost)}</div>
                    {formatLocal(arb.cost, city.local_currency) && (
                      <div className="text-[11px] font-normal text-muted-foreground">
                        {formatLocal(arb.cost, city.local_currency)}
                        {isVolatileCurrency(city.local_currency) ? " ±" : ""}
                      </div>
                    )}
                  </Td>
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
          {tier === "luxury"
            ? "Luxury is a derived estimate: serviced/luxury apartment, everything eaten out incl. fine dining, housekeeper, ride-hailing everywhere, premium gym/spa and a regional-trips budget — priced from each city's own component costs."
            : `Surplus = income − (rent central + coworking + groceries + eating out + utilities + mobile + transport + gym) at the ${tier === "mid" ? "mid-range" : "lean"} tier.`}{" "}
          Local-currency figures use reference rates as of {FX_AS_OF}; ± marks volatile
          currencies. Each city page shows its last-verified date.
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
            {formatLocal(focusArb.cost, focusCity.local_currency) && (
              <div className="text-[11px] text-muted-foreground">
                {formatLocal(focusArb.cost, focusCity.local_currency)}
                {isVolatileCurrency(focusCity.local_currency) ? " · volatile" : ""}
              </div>
            )}
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
            {(["lean", "mid", "luxury"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={cn(
                  "flex-1 rounded px-2 py-1.5",
                  tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {t === "mid" ? "Mid-range" : t === "lean" ? "Lean" : "Luxury"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <FreelancePanel
        onUseNet={(net) => {
          const v = String(Math.round(net));
          setIncome(v);
          patchProfile({ monthly_income_usd: Math.round(net) });
        }}
      />

      {rankingSection}
    </div>
  );
}

/**
 * Freelance scenario builder: models income from concurrent client slots
 * (hourly base + per-appointment fee), then nets it out under three tax
 * regimes. "Use" feeds the net into the city ranking above.
 */
function FreelancePanel({ onUseNet }: { onUseNet: (net: number) => void }) {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<FreelanceInputs>(DEFAULT_FREELANCE_INPUTS);
  const income = computeFreelanceIncome(inputs);
  const scenarios = computeScenarios(inputs);

  const patch = (p: Partial<FreelanceInputs>) => setInputs((s) => ({ ...s, ...p }));
  const numField = (
    id: string,
    label: string,
    value: number,
    set: (n: number) => void,
  ) => (
    <div>
      <label className="label-xs" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "") || 0))}
        className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
      />
    </div>
  );

  return (
    <section className="panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline justify-between px-4 py-3 text-start"
      >
        <span className="text-sm font-semibold">
          Don&apos;t know your net income? Model it from freelance work
        </span>
        <span className="label-xs">{open ? "Hide" : "Open"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <span className="label-xs">Client slots</span>
              <div className="mt-1 flex rounded-md border border-border p-0.5 text-sm">
                {([2, 3] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => patch({ clients: n })}
                    className={cn(
                      "flex-1 rounded px-2 py-1.5",
                      inputs.clients === n
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {n} × {hoursPerClientPerDay(n)}h/day
                  </button>
                ))}
              </div>
            </div>
            {numField("fl-rate", "Hourly rate (USD)", inputs.hourlyRateUsd, (n) =>
              patch({ hourlyRateUsd: n }),
            )}
            {numField("fl-fee", "Fee per appointment (USD)", inputs.appointmentFeeUsd, (n) =>
              patch({ appointmentFeeUsd: n }),
            )}
            {numField(
              "fl-appts",
              "Appointments / client / mo",
              inputs.appointmentsPerClient,
              (n) => patch({ appointmentsPerClient: n }),
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {formatUsd(income.hourlyBilledUsd)} hourly + {formatUsd(income.appointmentBilledUsd)}{" "}
            appointment fees = {formatUsd(income.grossBilledUsd)} billed ·{" "}
            {formatUsd(income.afterPlatformUsd)} after the{" "}
            {Math.round(inputs.platformFeePct * 100)}% platform fee ·{" "}
            {formatUsd(income.profitUsd)} profit before tax.
          </p>

          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th>Regime</Th>
                  <Th right>Tax/mo</Th>
                  <Th right>Insurance/mo</Th>
                  <Th right>Net/mo</Th>
                  <Th right>Take-home</Th>
                  <Th right>{null}</Th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const regime = TAX_REGIMES.find((r) => r.id === s.regime)!;
                  return (
                    <tr key={s.regime} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{regime.label}</div>
                        <div className="mt-0.5 max-w-[420px] text-[11px] text-muted-foreground">
                          {regime.caveat}
                        </div>
                      </td>
                      <Td right>{formatUsd(s.taxUsd)}</Td>
                      <Td right>{formatUsd(s.insuranceUsd)}</Td>
                      <Td right className="font-semibold text-positive">
                        {formatUsd(s.netUsd)}
                      </Td>
                      <Td right>{(100 - s.effectiveRate).toFixed(0)}%</Td>
                      <td className="px-4 py-2.5 text-end">
                        <button
                          onClick={() => onUseNet(s.netUsd)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Estimates for planning, not tax advice. Capacity assumes ~6 prime calling hours in
            the 8–18 client-timezone window and 21 workdays. Vietnam rows require actually
            ending German unlimited tax liability — keeping a Wohnsitz (even a room with a key)
            keeps the German row in force. Vietnam has no nomad visa; the 90-day e-visa is the
            practical route, and 183+ days makes you tax resident on worldwide income.
          </p>
        </div>
      )}
    </section>
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
