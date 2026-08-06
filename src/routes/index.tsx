/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. Explore ranking, filtering and sorting
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { CityCard } from "@/components/CityCard";
import { Onboarding } from "@/components/Onboarding";
import { EmptyState } from "@/components/Primitives";
import { Landing } from "./landing";
import { useSession } from "@/lib/use-session";
import { CITIES, REGIONS } from "@/lib/cities";
import {
  computeArbitrage,
  formatUsd,
  isSchengenCity,
  monthlyCost,
  nomadIncomeMonthly,
  touristDaysFor,
} from "@/lib/arbitrage";
import { useProfile, useSavedCities } from "@/lib/store";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      // "/" is the landing page for signed-out visitors, so the metadata
      // describes the product rather than the city grid (that is /explore).
      { title: `${APP_NAME} — know how many days you have left, everywhere` },
      {
        name: "description",
        content:
          "Track your Schengen 90/180 allowance and tax-residency days as you travel. Alerts before you cross a line, and a year-end presence record for your accountant. Free to track, no account needed.",
      },
      { property: "og:title", content: `${APP_NAME} — visa and tax day tracking for nomads` },
      {
        property: "og:description",
        content:
          "Rolling 90/180 counter, per-country tax day counts, border-run planning and an exportable presence record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

/**
 * "/" serves two different audiences, so it renders two different things.
 *
 * Signed out: the landing page. Someone arriving cold needs to know what this
 * is before they see thirty city cards and an arbitrage column that means
 * nothing without their income.
 *
 * Signed in: straight to Explore. A returning user should not scroll past
 * marketing to reach their own tool.
 *
 * The city grid is still reachable signed-out at /explore — browsing is the
 * acquisition surface and gating it would cost more traffic than it earns.
 */
function Home() {
  const { signedIn, ready } = useSession();

  // Render nothing rather than flashing the wrong page for a frame while the
  // session resolves — the flicker reads as a bug.
  if (!ready) return null;

  if (signedIn) return <Explore />;

  // One landing page, defined in ./landing.tsx and rendered here. Two
  // implementations of the same page is how a price gets updated in one place
  // and not the other.
  return <Landing />;
}

type SortKey = "savings" | "cheapest" | "internet" | "weather";

export function Explore() {
  const { profile, hydrated } = useProfile();
  const { saved, toggle } = useSavedCities();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [maxBudget, setMaxBudget] = useState(4000);
  const [minInternet, setMinInternet] = useState(0);
  const [minSafety, setMinSafety] = useState(0);
  const [nomadOnly, setNomadOnly] = useState(false);
  const [outsideSchengen, setOutsideSchengen] = useState(false);
  const [incomeQualifies, setIncomeQualifies] = useState(false);
  const [sort, setSort] = useState<SortKey>("savings");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const income = profile.monthly_income_usd;

  const cities = useMemo(() => {
    const list = CITIES.filter((city) => {
      const cost = monthlyCost(city);
      if (query) {
        const q = query.toLowerCase();
        if (!city.city.toLowerCase().includes(q) && !city.country.toLowerCase().includes(q))
          return false;
      }
      if (region !== "all" && city.region !== region) return false;
      if (cost > maxBudget) return false;
      if (city.scores.internetSpeedMbps < minInternet) return false;
      if (city.scores.safety < minSafety) return false;
      if (nomadOnly && !city.visa.nomadVisa.exists) return false;
      if (outsideSchengen && isSchengenCity(city)) return false;
      if (incomeQualifies) {
        const req = nomadIncomeMonthly(city) ?? 0;
        if (!income || income < req) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sort === "cheapest") return monthlyCost(a) - monthlyCost(b);
      if (sort === "internet") return b.scores.internetSpeedMbps - a.scores.internetSpeedMbps;
      if (sort === "weather") return b.scores.weather - a.scores.weather;
      return (
        computeArbitrage(b, income).surplusMonthly - computeArbitrage(a, income).surplusMonthly
      );
    });
  }, [
    query,
    region,
    maxBudget,
    minInternet,
    minSafety,
    nomadOnly,
    outsideSchengen,
    incomeQualifies,
    sort,
    income,
  ]);

  const best = cities[0] ? computeArbitrage(cities[0], income) : null;

  return (
    <div className="space-y-6">
      {hydrated && !profile.onboarded && showOnboarding ? (
        <Onboarding
          onDone={(stage) => {
            setShowOnboarding(false);
            // Planning-track users land on the runway calculator, not on a
            // ranking of cities they cannot yet act on.
            if (stage === "planning") void navigate({ to: "/plan" });
          }}
        />
      ) : null}

      {/* Explore needs to say what it is. Someone landing here from search or
          from the landing page's "Browse cities" button previously met a
          filter panel and a column of dollar figures with no explanation of
          what was being compared or why the numbers were generic. */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Explore cities</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What each city costs, and what you would keep there each month once your income is
          entered. Every figure carries a last-verified date, and the downsides are printed on the
          city page rather than hidden.
        </p>
      </header>

      {/* Hero stat panel — soft card, big number */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="label-xs">Arbitrage overview</span>
          <span className="label-xs">
            {cities.length}/{CITIES.length} cities
          </span>
        </div>
        <div className="px-4 py-5">
          {income && best && cities[0] ? (
            <>
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="num text-5xl font-semibold leading-none text-positive">
                  {formatUsd(best.surplusMonthly)}
                </span>
                <span className="pb-1 text-sm text-muted-foreground">
                  /mo kept in {cities[0].city}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-positive"
                  style={{ width: `${Math.max(0, Math.min(100, best.savingsRate))}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <HeroStat label="Savings rate" value={`${best.savingsRate.toFixed(0)}%`} />
                <HeroStat label="Monthly cost" value={formatUsd(best.cost)} />
                <HeroStat label="Per year" value={formatUsd(best.surplusAnnual)} />
                <HeroStat label="Visa-free days" value={`${touristDaysFor(cities[0])}`} />
              </dl>
            </>
          ) : (
            <>
              {/* h2, not h1 — the page heading is above. Two h1s on one page
                  is both an accessibility fault and an SEO one. */}
              <h2 className="text-2xl font-semibold tracking-tight">
                Add your income to personalise every number.
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Every figure below is generic until we know your income and passport.
              </p>
              <Link
                to="/profile"
                className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Enter income
              </Link>
            </>
          )}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${CITIES.length} cities`}
            className="w-full rounded-full border border-border bg-card py-3 ps-11 pe-4 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-colors focus:border-primary"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Filters"
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors",
            filtersOpen && "border-primary bg-primary text-primary-foreground",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Quick chips — same state as the full filter panel, no separate logic */}
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <QuickChip
          active={!nomadOnly && !outsideSchengen && maxBudget >= 5000 && region === "all"}
          onClick={() => {
            setNomadOnly(false);
            setOutsideSchengen(false);
            setMaxBudget(5000);
            setRegion("all");
          }}
        >
          All
        </QuickChip>
        <QuickChip
          active={maxBudget <= 1500}
          onClick={() => setMaxBudget(maxBudget <= 1500 ? 5000 : 1500)}
        >
          Under {formatUsd(1500)}
        </QuickChip>
        <QuickChip active={nomadOnly} onClick={() => setNomadOnly((v) => !v)}>
          Nomad visa
        </QuickChip>
        <QuickChip active={outsideSchengen} onClick={() => setOutsideSchengen((v) => !v)}>
          Non-Schengen
        </QuickChip>
        {REGIONS.map((r) => (
          <QuickChip
            key={r}
            active={region === r}
            onClick={() => setRegion(region === r ? "all" : r)}
          >
            {r}
          </QuickChip>
        ))}
      </div>


      {filtersOpen ? (
        <div className="panel grid gap-5 p-4 sm:grid-cols-2">
          <div>
            <label className="label-xs">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-sm"
            >
              <option value="all">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-xs">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-1.5 w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-sm"
            >
              <option value="savings">Highest savings</option>
              <option value="cheapest">Cheapest</option>
              <option value="internet">Fastest internet</option>
              <option value="weather">Best weather</option>
            </select>
          </div>
          <RangeRow
            label="Max monthly budget"
            value={maxBudget}
            display={formatUsd(maxBudget)}
            min={500}
            max={5000}
            step={100}
            onChange={setMaxBudget}
          />
          <RangeRow
            label="Min internet"
            value={minInternet}
            display={`${minInternet} Mbps`}
            min={0}
            max={250}
            step={10}
            onChange={setMinInternet}
          />
          <RangeRow
            label="Min safety score"
            value={minSafety}
            display={`${minSafety.toFixed(1)} / 5`}
            min={0}
            max={5}
            step={0.5}
            onChange={setMinSafety}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Toggle active={nomadOnly} onClick={() => setNomadOnly((v) => !v)}>
              Has nomad visa
            </Toggle>
            <Toggle active={outsideSchengen} onClick={() => setOutsideSchengen((v) => !v)}>
              Outside Schengen
            </Toggle>
            <Toggle active={incomeQualifies} onClick={() => setIncomeQualifies((v) => !v)}>
              I meet the income requirement
            </Toggle>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="label-xs">Cities</h2>
          <span className="num text-xs text-muted-foreground">{cities.length}</span>
        </div>

        {/*
          One ask, above the grid — not "add income" repeated on all thirty
          cards. The personalised surplus is the whole product, so the prompt
          has to be visible, but thirty of them reads as noise and makes the
          grid look unfinished. Set it once and every card fills in together.
        */}
        {income == null ? (
          <Link
            to="/profile"
            className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3"
          >
            <span className="text-sm">
              <span className="font-medium">Add your income</span>
              <span className="block text-xs text-muted-foreground">
                See what you&apos;d keep each month in every city, not just what it costs.
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">Add</span>
          </Link>
        ) : null}

        {cities.length === 0 ? (
          <EmptyState
            title="No cities match those filters"
            body={`Loosen the budget or internet minimum to see more of the ${CITIES.length}-city dataset.`}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((city) => (
              <CityCard
                key={city.id}
                city={city}
                income={income}
                saved={saved.includes(city.id)}
                onToggleSave={() => toggle(city.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Marketing sections deliberately NOT rendered here any more. They now
          live on the signed-out "/" alongside the hero. A signed-in user
          browsing cities does not need the pitch again, and a signed-out user
          reaching /explore came here to browse, not to be sold to. */}

      <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        Cost figures are estimates and carry a last-verified date on each city page. Always confirm
        visa and tax rules with official authorities.
      </p>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <dt className="label-xs">{label}</dt>
      <dd className="num mt-0.5 text-base font-semibold">{value}</dd>
    </div>
  );
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label-xs">{label}</label>
        <span className="num text-xs font-medium">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-3 py-1.5 text-xs",
        active && "border-primary bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function QuickChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
