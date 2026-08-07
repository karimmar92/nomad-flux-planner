/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The runway number and the
 * first-move ranking are what someone uses to decide whether to go at all, and
 * they must depend only on their savings, their income and the seed data —
 * never on commission. The checklist is where the commercial layer lives.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Coins, MapPin, Receipt } from "lucide-react";
import { GraduationCard } from "@/components/plan/GraduationCard";
import { LegalFooter } from "@/components/LegalFooter";
import { Stat } from "@/components/Primitives";
import { CITIES } from "@/lib/cities";
import { flagEmoji, formatUsd } from "@/lib/arbitrage";
import {
  compareRunway,
  computeRunway,
  formatMonths,
  monthsToBuffer,
} from "@/lib/plan/runway";
import { FIRST_MOVE_RATIONALE, rankForFirstMove } from "@/lib/plan/first-timer";
import {
  daysUntilDeparture,
  planProgress,
  useDeparturePlan,
} from "@/lib/plan/departure";
import { useProfile } from "@/lib/store";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan/")({
  head: () => ({
    meta: [
      { title: `How much do you need saved to leave? | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Work out how many months your savings last abroad, where to go first, and everything you need to do before you fly. Free, for people who haven't left yet.",
      },
      { property: "og:title", content: "How much do you need saved to become a nomad?" },
      {
        property: "og:description",
        content:
          `Your savings, turned into months of runway in ${CITIES.length} cities — plus a 90-day departure checklist.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanHub,
});

function PlanHub() {
  const { profile, patchProfile } = useProfile();
  const { plan, patch } = useDeparturePlan();

  const [savings, setSavings] = useState<string>(
    (plan.savingsUsd ?? profile.savings_usd ?? "").toString(),
  );
  const [income, setIncome] = useState<string>(
    (plan.incomeUsd ?? profile.monthly_income_usd ?? "").toString(),
  );
  const [buffer, setBuffer] = useState<string>((plan.bufferTargetUsd ?? 10000).toString());
  const [tier, setTier] = useState<"lean" | "mid">("lean");
  const [cityId, setCityId] = useState<string>(plan.targetCityId ?? "chiang-mai-th");
  const [homeId, setHomeId] = useState<string>(profile.home_city_id ?? "lisbon-pt");

  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0]!;
  const home = CITIES.find((c) => c.id === homeId);

  const savingsNum = savings ? Number(savings) : 0;
  const incomeNum = income ? Number(income) : 0;
  const bufferNum = buffer ? Number(buffer) : 0;

  const runway = computeRunway({ savings: savingsNum, monthlyIncome: incomeNum, city, tier });
  const toBuffer = monthsToBuffer(runway, bufferNum, savingsNum);
  const comparison = compareRunway(home, city, savingsNum, tier);
  const picks = useMemo(() => rankForFirstMove(CITIES), []);
  const daysUntil = daysUntilDeparture(plan.targetDate);
  const progress = planProgress(plan);

  const persist = () =>
    patch({
      savingsUsd: savingsNum || null,
      incomeUsd: incomeNum || null,
      bufferTargetUsd: bufferNum || null,
      targetCityId: cityId,
    });

  return (
    <div className="space-y-5">
      <GraduationCard />

      <header>
        <p className="label-xs">Before you go</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Can you actually afford to do this?
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The whole planning track is free. Work out your runway, pick somewhere sensible for a
          first move, and follow the countdown. The tracker and the document vault only start
          mattering once you have a boarding pass.
        </p>
      </header>

      {profile.stage !== "planning" ? (
        <button type="button"
          onClick={() => patchProfile({ stage: "planning" })}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Planning your first move? Switch to the planning view
        </button>
      ) : null}

      {/* ---------------- Runway calculator ---------------- */}
      <section className="panel overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Runway calculator</h2>
          <span className="label-xs">{APP_NAME}</span>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-4">
          <Field label="Savings (USD)" id="plan-savings" value={savings} onChange={setSavings} onBlur={persist} placeholder="12000" />
          <Field label="Monthly income (USD)" id="plan-income" value={income} onChange={setIncome} onBlur={persist} placeholder="0" />
          <div>
            <label className="label-xs" htmlFor="plan-city">
              Where you&apos;re going
            </label>
            <select
              id="plan-city"
              value={cityId}
              onChange={(e) => {
                setCityId(e.target.value);
                patch({ targetCityId: e.target.value });
              }}
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
        </div>

        {/* The shareable block. Deliberately crops well. */}
        <div className="grid gap-4 border-t border-border bg-surface-2/40 px-4 py-5 sm:grid-cols-3">
          <Stat
            label="Runway in this city"
            size="lg"
            tone={runway.sustainable ? "positive" : runway.months && runway.months < 4 ? "negative" : "default"}
            value={
              runway.sustainable
                ? "Doesn't run out"
                : runway.months != null
                  ? formatMonths(runway.months)
                  : "—"
            }
            hint={
              runway.sustainable
                ? "Your income covers the cost of living here, so the savings stay untouched."
                : `Burning ${formatUsd(runway.burnMonthly)} a month against ${formatUsd(savingsNum)}.`
            }
          />
          <Stat
            label={runway.surplusMonthly >= 0 ? "Monthly surplus" : "Monthly deficit"}
            size="lg"
            tone={runway.surplusMonthly >= 0 ? "positive" : "negative"}
            value={formatUsd(runway.surplusMonthly)}
            hint={`${formatUsd(runway.monthlyCost)} a month to live here, ${tier === "lean" ? "lean" : "mid-range"}.`}
          />
          <Stat
            label={`Saving to ${formatUsd(bufferNum)}`}
            size="lg"
            value={toBuffer == null ? "Not from here" : toBuffer === 0 ? "Already there" : formatMonths(toBuffer)}
            hint={
              toBuffer == null
                ? "At this income and cost you never reach that buffer in this city."
                : "At the surplus above, with nothing else changing."
            }
          />
        </div>

        <div className="border-t border-border px-4 py-3">
          <label className="label-xs" htmlFor="plan-buffer">
            Buffer you want in the bank
          </label>
          <input
            id="plan-buffer"
            inputMode="numeric"
            value={buffer}
            onBlur={persist}
            onChange={(e) => setBuffer(e.target.value.replace(/\D/g, ""))}
            className="num mt-1 w-full max-w-xs rounded-md border border-input bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
          />
        </div>
      </section>

      {/* ---------------- The thesis line ---------------- */}
      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">The same money, in two places</h2>
          <select
            value={homeId}
            onChange={(e) => {
              setHomeId(e.target.value);
              patchProfile({ home_city_id: e.target.value });
            }}
            className="ms-auto rounded-md border border-input bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
            aria-label="Where you live now"
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.city}
              </option>
            ))}
          </select>
        </div>

        {comparison ? (
          <p className="mt-3 text-lg leading-snug sm:text-xl">
            Your <span className="num font-semibold">{formatUsd(savingsNum)}</span> in{" "}
            <span className="font-semibold">{comparison.home.city.city}</span> is{" "}
            <span className="num font-semibold text-negative">
              {formatMonths(comparison.home.months)}
            </span>{" "}
            of runway. In <span className="font-semibold">{comparison.target.city.city}</span> it is{" "}
            <span className="num font-semibold text-positive">
              {formatMonths(comparison.target.months)}
            </span>
            .
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Enter your savings and pick two different cities to see the comparison.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Income excluded on both sides so the comparison is like-for-like — this is what the cash
          you already have buys you in each place, at the {tier === "lean" ? "lean" : "mid-range"}{" "}
          cost tier.
        </p>
      </section>

      {/* ---------------- Where should I start? ---------------- */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Where should I start?</h2>
          <Link to="/explore" className="text-xs text-muted-foreground hover:text-foreground">
            All {CITIES.length} cities <ArrowRight className="inline h-3 w-3" />
          </Link>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{FIRST_MOVE_RATIONALE}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {picks.map((pick) => (
            <div key={pick.city.id} className="panel flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span aria-hidden>{flagEmoji(pick.city.country_code)}</span>
                    <h3 className="truncate text-sm font-semibold">{pick.city.city}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">{pick.city.country}</p>
                </div>
                <span className="num shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {Math.round(pick.score)}
                </span>
              </div>

              <ul className="space-y-1 text-xs text-muted-foreground">
                {pick.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>

              {pick.caution ? (
                <p className="rounded-md border border-warning/40 bg-warning-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-foreground">
                  {pick.caution}
                </p>
              ) : null}

              <div className="mt-auto flex items-center justify-between pt-1">
                <span className="num text-xs text-muted-foreground">
                  {formatUsd(pick.city.costs.totalMonthlyLean)}/mo lean
                </span>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => {
                      setCityId(pick.city.id);
                      patch({ targetCityId: pick.city.id });
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Use in calculator
                  </button>
                  <Link
                    to="/city/$cityId"
                    params={{ cityId: pick.city.id }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Detail
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Onward ---------------- */}
      <section className="grid gap-3 sm:grid-cols-3">
        <HubLink
          to="/plan/checklist"
          icon={CalendarClock}
          title="Departure countdown"
          body={
            daysUntil == null
              ? "17 things, phased from 90 days out. Set a date to start the countdown."
              : `${daysUntil} days to go · ${progress.done}/${progress.total} done`
          }
        />
        <HubLink
          to="/plan/costs"
          icon={Receipt}
          title="What it actually costs to start"
          body="The one-off budget before month one. Usually two to three times what people expect."
        />
        <HubLink
          to="/plan/tax-exit"
          icon={MapPin}
          title="Leaving your home tax system"
          body="Abmeldung, P85, baja consular — what the process is and what it produces. No links, no upsell."
        />
      </section>

      <LegalFooter />
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="label-xs" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-lg font-semibold outline-none focus:border-primary"
      />
    </div>
  );
}

function HubLink({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  icon: typeof CalendarClock;
  title: string;
  body: string;
}) {
  return (
    <Link to={to} className="panel flex flex-col gap-1 p-4 transition-colors hover:border-primary/50">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{body}</p>
    </Link>
  );
}
