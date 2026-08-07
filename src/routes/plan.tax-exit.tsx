/**
 * NO PARTNER LINKS ON THIS PAGE, EVER — not eSIM, not banking, not formation.
 * See the header of src/lib/plan/tax-exit.ts for why. This page is a
 * trust-builder read by someone in the middle of the most consequential
 * paperwork of the move, and a commercial link would waste that entirely.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, FileCheck2, Info } from "lucide-react";
import { LegalFooter } from "@/components/LegalFooter";
import {
  NOT_YET_COVERED,
  TAX_EXIT_FRAMING,
  TAX_EXIT_NOTES,
  taxExitNote,
} from "@/lib/plan/tax-exit";
import { useDeparturePlan } from "@/lib/plan/departure";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan/tax-exit")({
  head: () => ({
    meta: [
      { title: `Leaving your home tax system | ${APP_NAME}` },
      {
        name: "description",
        content:
          "What deregistering actually involves before you leave: Germany's Abmeldung, the UK's P85 and split-year treatment, Spain's baja consular, and why it doesn't apply to US citizens.",
      },
      { property: "og:title", content: "Leaving your home tax system" },
      {
        property: "og:description",
        content:
          "The process, the paperwork it produces, and the part people get wrong. Information, not advice.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaxExitPage,
});

function TaxExitPage() {
  const { plan, patch } = useDeparturePlan();
  const [selected, setSelected] = useState(plan.homeCountry ?? TAX_EXIT_NOTES[0]!.countryCode);
  const note = taxExitNote(selected);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Before you go</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Leaving your home tax system
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The slowest item on the departure checklist and the one most people discover far too
            late. Start it around 90 days out.
          </p>
        </div>
        <Link to="/plan/checklist" className="text-xs text-muted-foreground hover:text-foreground">
          Back to the countdown
        </Link>
      </header>

      <div className="panel flex gap-3 border-warning/40 bg-warning-muted/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="text-xs leading-relaxed">{TAX_EXIT_FRAMING}</p>
      </div>

      <div>
        <span className="label-xs">Your home country</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAX_EXIT_NOTES.map((n) => (
            <button type="button"
              key={n.countryCode}
              onClick={() => {
                setSelected(n.countryCode);
                patch({ homeCountry: n.countryCode });
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected === n.countryCode
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {n.country}
            </button>
          ))}
        </div>
      </div>

      {note ? (
        <article className="panel overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">{note.country}</h2>
            {note.processName ? (
              <p className="text-xs text-muted-foreground">{note.processName}</p>
            ) : null}
          </div>

          <div className="space-y-4 px-4 py-4">
            <p className="text-sm leading-relaxed">{note.summary}</p>

            <div>
              <h3 className="label-xs">What the process involves</h3>
              <ol className="mt-2 space-y-2">
                {note.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed">
                    <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-positive/40 bg-positive-muted/30 p-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-positive" />
                <h3 className="text-sm font-semibold">What it produces</h3>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{note.evidence}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Store it in the{" "}
                <Link to="/record/vault" className="text-primary hover:underline">
                  document vault
                </Link>{" "}
                — you will be asked for it years later, usually by someone in another country.
              </p>
            </div>

            <div>
              <h3 className="label-xs">Timing</h3>
              <p className="mt-1 text-sm leading-relaxed">{note.timing}</p>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning-muted/30 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold">What people get wrong</h3>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{note.watchOut}</p>
            </div>
          </div>
        </article>
      ) : null}

      <section className="panel p-4">
        <h2 className="text-sm font-semibold">Countries not covered yet</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{NOT_YET_COVERED}</p>
      </section>

      <p className="text-xs text-muted-foreground">
        There are no partner links on this page, and there never will be. {APP_NAME} earns nothing
        from anything described here —{" "}
        <Link to="/how-we-make-money" className="text-primary hover:underline">
          how we make money
        </Link>
        .
      </p>

      <LegalFooter />
    </div>
  );
}
