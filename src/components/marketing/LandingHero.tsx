/**
 * Landing hero — shown at "/" to signed-out visitors only.
 *
 * LandingSections covers features, pricing, privacy, FAQ and the closing CTA,
 * but has no hero because it was originally built to sit BELOW the city grid.
 * This supplies the missing top: what the product is, and why the thing it
 * counts is easy to get wrong.
 *
 * Deliberately no customer logos, star rating or testimonials. Those exist on
 * mature reference sites because those companies have customers. An invented
 * one is both a lie and trivially disprovable, and an empty slot looks worse
 * than no slot.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { CITIES } from "@/lib/cities";

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
    <div className="space-y-12 pb-4">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        Hosted in the EU · Works offline · No tracking or analytics
      </p>

      <section className="space-y-5 text-center">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Know exactly how many days <span className="text-primary">you have left</span>
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground">
          Schengen 90/180 is a rolling window, not an annual reset — which is why
          people miscount it and get banned for three years. {APP_NAME} counts it
          properly, tracks every tax-residency threshold alongside it, and keeps
          the record you will need when someone asks where you have been.
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
            Browse {cityCount} cities
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          No account needed to start. Unlimited trip logging, free forever.
        </p>
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
    </div>
  );
}
