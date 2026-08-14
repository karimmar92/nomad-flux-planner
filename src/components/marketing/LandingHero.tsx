/**
 * Landing hero — "/" for signed-out visitors.
 *
 * STRUCTURE, and why:
 *
 * 1. Trust bar      — EU, offline, no tracking. Three facts, above the fold.
 * 2. H1 + subhead   — works for BOTH audiences. The split comes after, never
 *                     before: forcing a choice before someone knows what the
 *                     product is raises bounce sharply.
 * 3. Live calculator— the demo. A real answer beats a screenshot.
 * 4. Audience split — two doors, once the visitor has context to choose with.
 * 5. Honesty band   — what is tested, what is not, what is missing. This
 *                     replaces the logo cloud and G2 rating a mature site puts
 *                     here. It is written as confident disclosure, not apology:
 *                     the product's whole positioning is telling uncomfortable
 *                     truths, so hiding its own would be inconsistent.
 *
 * SEO: one H1 containing the primary phrase, semantic H2s below, and JSON-LD
 * emitted from the route. Copy leads with the search intent — "Schengen days",
 * "cost of living", "nomad visa" — not with the brand name.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Check, Plane, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { CITIES } from "@/lib/cities";
import { HeroCalculator } from "./HeroCalculator";

const MISTAKES: [string, string][] = [
  [
    "Leaving does not reset the clock.",
    "Days fall out of the window only by ageing past 180 days. Flying to Serbia and back does nothing.",
  ],
  ["Both the entry and exit day count in full.", "Landing at 23:50 burns a whole day."],
  [
    "The rule is tested every day, not just at the border.",
    "A stay that is legal on arrival can become illegal halfway through.",
  ],
];

export function LandingHero() {
  const cityCount = CITIES.length;

  return (
    <div className="space-y-14 pb-4">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        Hosted in the EU · Works offline · No tracking, no analytics
      </p>

      <section className="space-y-5 text-center">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Never lose track of your{" "}
          <span className="text-primary">Schengen days</span> again
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground">
          The 90/180 rule is a rolling window, not an annual reset — which is why
          people miscount it and get banned for three years. {APP_NAME} counts it
          correctly, tracks every tax-residency threshold alongside it, and keeps
          the record you will need when an accountant or a border officer asks
          where you have been.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/tracker"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start tracking — free
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/explore"
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
          >
            Compare {cityCount} cities
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No account needed. Unlimited trip logging, free forever.
        </p>
      </section>

      <HeroCalculator />

      {/* The split sits HERE, not at the top — after the visitor knows what
          this is and has seen it work. A choice presented before context is a
          bounce; a choice presented after one is a qualification. */}
      <section className="space-y-3">
        <h2 className="text-center text-lg font-semibold tracking-tight">
          Which one are you?
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/tracker"
            className="panel group space-y-2 p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plane className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold">I work from more than one country</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Day counting, tax thresholds, where to go when a limit forces you
              out, and a record you can hand to an accountant.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open the tracker
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>

          <Link
            to="/business"
            className="panel group space-y-2 p-5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-muted text-info">
              <Building2 className="h-4 w-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold">I manage people who do</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Permanent-establishment exposure across your team, per country, with
              an audit trail — and each employee keeps a personal account you
              cannot see into.
            </p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-info">
              For teams
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      <section className="panel space-y-3 p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Most people count Schengen days wrong
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The three mistakes that cause overstays, in the order they happen:
        </p>
        <ul className="space-y-2.5 text-sm">
          {MISTAKES.map(([bold, rest]) => (
            <li key={bold} className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
              <span>
                <span className="font-medium">{bold}</span>{" "}
                <span className="text-muted-foreground">{rest}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Replaces the logo cloud / rating band. Written as disclosure, not
          apology — the product's entire positioning is telling people
          uncomfortable truths, so concealing its own would undercut it. */}
      <section className="panel space-y-4 border-primary/30 p-6">
        <div>
          <p className="label-xs text-primary">Straight answer</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Built by one person. Here is exactly where that shows.
          </h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          There are no customer logos on this page because there are no customers
          yet. You would find that out in a week anyway, and a product about
          getting the awkward details right should not open with a decorative
          one.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">What is solid</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "The day-counting engine has its own test suite, run under opposing timezones so a date never shifts by one depending on where you are.",
                `${cityCount} cities with visa rules, tax thresholds and costs — each carrying the date it was last verified.`,
                "Everything works offline. It is designed for an immigration queue with no roaming.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">What is not done</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Cost figures are researched estimates, not a live feed. Volatile currencies are marked low-confidence rather than presented as fact.",
                "The community is running in one city while it finds its feet, not thirty.",
                "Nothing here is legal or tax advice, and the app never tells you that you are tax resident somewhere — only what your recorded days are against the published threshold.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
