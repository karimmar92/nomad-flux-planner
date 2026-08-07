/**
 * Pension exit calculator.
 *
 * RDG DISCIPLINE (same rule as the tax report, different statute):
 * Rentenberatung is regulated in Germany. This page shows the arithmetic
 * behind a Renteninformation figure and the statutory conditions of
 * §210 SGB VI, side by side. It never states an eligibility verdict and never
 * recommends an action. See the header comment in src/lib/pension/germany.ts.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Info, Landmark, X } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { useProfile } from "@/lib/store";
import { canUse } from "@/lib/entitlements";
import { ProPrompt } from "@/components/ProGate";
import {
  PENSION_YEARS,
  evaluateGermanPension,
  type PensionResult,
} from "@/lib/pension/germany";
import { PENSION_COUNTRIES, PENSION_DATA_VERIFIED } from "@/lib/pension/countries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pension")({
  head: () => ({
    meta: [
      { title: `Pension exit calculator | ${APP_NAME}` },
      {
        name: "description",
        content:
          "What happens to your state pension when you leave. Turns a Renteninformation figure into Entgeltpunkte, checks the §210 refund conditions, and shows which countries refund contributions on departure.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PensionPage,
});

function PensionPage() {
  const { profile } = useProfile();
  const unlocked = canUse(profile.plan, "tax_report");

  const [monthly, setMonthly] = useState("320");
  const [letterYear, setLetterYear] = useState(2023);
  const [euNational, setEuNational] = useState(true);
  const [monthsSince, setMonthsSince] = useState("30");

  const value = Number(monthly) || 0;
  const result: PensionResult | null =
    value > 0
      ? evaluateGermanPension({
          monthlyPensionEur: value,
          letterYear,
          entitledToVoluntaryInsurance: euNational,
          ...(monthsSince ? { monthsSinceLastContribution: Number(monthsSince) } : {}),
        })
      : null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Landmark className="h-5 w-5 text-primary" aria-hidden />
          Pension exit calculator
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Leaving Germany raises a question nobody answers clearly: can you get your pension
          contributions back? This turns the figure on your Renteninformation into the points
          behind it and sets out the statutory conditions. It is a calculation, not advice —
          take the result to the DRV or a Rentenberater.
        </p>
      </header>

      <section className="panel grid gap-4 p-4 sm:grid-cols-4">
        <label className="block">
          <span className="label-xs">Future monthly pension (€)</span>
          <input
            inputMode="decimal"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value.replace(/[^\d.]/g, ""))}
            className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            &ldquo;Höhe Ihrer künftigen Regelaltersrente&rdquo;
          </span>
        </label>

        <label className="block">
          <span className="label-xs">Year of the letter</span>
          <select
            value={letterYear}
            onChange={(e) => setLetterYear(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {PENSION_YEARS.map((y) => (
              <option key={y.year} value={y.year}>
                {y.year}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-xs">Months since last contribution</span>
          <input
            inputMode="numeric"
            value={monthsSince}
            onChange={(e) => setMonthsSince(e.target.value.replace(/\D/g, ""))}
            className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="label-xs">Nationality</span>
          <div className="mt-1 flex rounded-md border border-border p-0.5 text-xs">
            {[
              { v: true, l: "German / EU / EEA" },
              { v: false, l: "Other" },
            ].map((o) => (
              <button
                key={o.l}
                onClick={() => setEuNational(o.v)}
                className={cn(
                  "flex-1 rounded px-2 py-1.5",
                  euNational === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </section>

      {result ? (
        <>
          <section className="panel grid gap-4 p-4 sm:grid-cols-4">
            <Figure label="Entgeltpunkte" value={result.entgeltpunkte.toFixed(2)} />
            <Figure
              label="Contribution months"
              value={`${result.contributionMonths}`}
              hint={result.contributionMonthsAreEstimated ? "implied by the points" : "from your record"}
            />
            <Figure
              label="Contributions behind it"
              value={`€${result.totalContributionsEur.toLocaleString("de-DE")}`}
              hint="both shares, today's money"
            />
            <Figure
              label="Employee share"
              value={`€${result.refundUpperBoundEur.toLocaleString("de-DE")}`}
              hint="the most §210 could return"
            />
          </section>

          <section className="panel p-4">
            <h2 className="text-sm font-semibold">The §210 SGB VI conditions</h2>
            <ul className="mt-3 space-y-3">
              {result.bars.map((bar) => (
                <li key={bar.id} className="flex items-start gap-2.5">
                  {bar.blocks ? (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden />
                  ) : (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
                  )}
                  <div>
                    <div className="text-sm font-medium">{bar.label}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{bar.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
              {result.refundPossible ? (
                <>
                  No condition above is currently unmet on these figures. Whether a refund is
                  actually granted is for the DRV to decide on your full Versicherungsverlauf.
                </>
              ) : (
                <>
                  At least one statutory condition is not met on these figures, so a refund under
                  §210 does not arise. The contributions remain as a pension entitlement instead —
                  €{result.annualPensionEur.toLocaleString("de-DE")} a year from the standard
                  retirement age, adjusted annually and payable to an account abroad.
                </>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              For scale: €{result.refundUpperBoundEur.toLocaleString("de-DE")} equals about{" "}
              {result.breakEvenYears.toFixed(1)} years of that pension, before any annual
              adjustment. A refund also extinguishes the entitlement permanently. Method version{" "}
              {result.methodVersion}; {result.year.year} reference values (Rentenwert €
              {result.year.rentenwert}, Durchschnittsentgelt €
              {result.year.durchschnittsentgelt.toLocaleString("de-DE")}).
            </p>
          </section>
        </>
      ) : null}

      {unlocked ? (
        <section className="panel overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Leaving other countries</h2>
            <span className="label-xs">verified {PENSION_DATA_VERIFIED}</span>
          </div>
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th>Country</Th>
                  <Th>System</Th>
                  <Th>Refund on departure</Th>
                  <Th>Qualifying period</Th>
                  <Th>Deadline</Th>
                </tr>
              </thead>
              <tbody>
                {PENSION_COUNTRIES.map((c) => (
                  <tr key={c.code} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-4 py-3 font-medium">{c.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.system}</td>
                    <td className="px-4 py-3">
                      <Availability value={c.availability} />
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">{c.note}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.qualifyingPeriod}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.claimDeadline ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            The pattern across every system: refunds exist for people who left before qualifying.
            Once the qualifying period is complete, the refund closes and a pension accrues
            instead.
          </p>
        </section>
      ) : (
        <ProPrompt
          title="The country comparison is Pro"
          body="Which systems refund contributions when you leave, the qualifying period that closes each refund, and the claim deadlines that expire. The German calculator above stays free."
        />
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          This is a calculation from published values, not pension or legal advice — advising on
          pension entitlements is a regulated activity. Figures assume contributions were earned
          at average earnings; your Versicherungsverlauf is the authoritative record. A refund
          returns nominal amounts without interest, so the real figure is lower than the estimate
          above.{" "}
          <Link to="/record" className="underline hover:text-foreground">
            Your presence record
          </Link>{" "}
          is what an adviser will ask for alongside it.
        </span>
      </p>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="num mt-0.5 text-2xl font-semibold">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Availability({ value }: { value: string }) {
  const map: Record<string, { label: string; className: string }> = {
    refund_possible: { label: "Possible", className: "text-positive" },
    conditional: { label: "Conditional", className: "text-accent-warning" },
    no_refund: { label: "No refund", className: "text-muted-foreground" },
  };
  const v = map[value] ?? map["no_refund"]!;
  return <span className={cn("text-xs font-medium", v.className)}>{v.label}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="label-xs px-4 py-2 text-start font-medium">{children}</th>;
}
