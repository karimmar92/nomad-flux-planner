import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { REPORT_DISCLAIMER, downloadBlob, reportFileName, taxReportToCsv } from "@/lib/reports/export-csv";
import { taxReportToPdf } from "@/lib/reports/export-pdf";
import { buildTaxReport, yearsWithData } from "@/lib/reports/tax-report";
import { useProfile, useTrips } from "@/lib/store";
import { todayIso } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/record/report/$year")({
  head: ({ params }) => ({
    meta: [
      { title: `Presence record ${params.year} | ${APP_NAME}` },
      {
        name: "description",
        content: `Days recorded per country for ${params.year}, measured against each country's day-count threshold, with an exportable entry and exit log.`,
      },
      { property: "og:title", content: `Presence record ${params.year} | ${APP_NAME}` },
      {
        property: "og:description",
        content: "A record of where you were, ready to hand to an adviser. Never a determination.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { year: yearParam } = Route.useParams();
  const year = Number(yearParam);
  const { trips } = useTrips();
  const { profile } = useProfile();
  const [busy, setBusy] = useState<null | "pdf" | "csv">(null);

  const report = useMemo(() => buildTaxReport(trips, year, todayIso()), [trips, year]);
  const years = yearsWithData(trips, todayIso());

  async function exportPdf() {
    setBusy("pdf");
    try {
      const blob = await taxReportToPdf(report, profile.display_name);
      downloadBlob(blob, reportFileName(year, "pdf"));
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    setBusy("csv");
    try {
      downloadBlob(
        new Blob([taxReportToCsv(report)], { type: "text/csv;charset=utf-8" }),
        reportFileName(year, "csv"),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/record"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Your record
      </Link>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Presence record {year}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{REPORT_DISCLAIMER}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={exportPdf} disabled={busy !== null} className="btn-primary">
            <Download className="me-1.5 h-3.5 w-3.5" aria-hidden />
            {busy === "pdf" ? "Building PDF…" : "Export PDF"}
          </button>
          <button onClick={exportCsv} disabled={busy !== null} className="btn">
            <FileSpreadsheet className="me-1.5 h-3.5 w-3.5" aria-hidden />
            Export CSV
          </button>
          {years
            .filter((y) => y !== year)
            .map((y) => (
              <Link
                key={y}
                to="/record/report/$year"
                params={{ year: String(y) }}
                className="btn num"
              >
                {y}
              </Link>
            ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Both exports are generated on this device. Nothing is uploaded to produce them.
        </p>
      </header>

      {report.countries.length === 0 ? (
        <div className="panel p-4 text-sm text-muted-foreground">
          No trips recorded for {year}. Add entries in the{" "}
          <Link to="/tracker" className="underline">
            Tracker
          </Link>{" "}
          and this becomes a full record — including trips you add retrospectively.
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Presence by country</h2>
            <div className="panel overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Country</th>
                    <th className="px-3 py-2 text-end font-medium">Days</th>
                    <th className="px-3 py-2 text-end font-medium">Threshold</th>
                    <th className="px-3 py-2 font-medium">Recorded presence</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {report.countries.map((c) => (
                    <tr key={c.basis.country_code} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.basis.country}</div>
                        <div className="text-[11px] text-muted-foreground">{c.basis.basisLabel}</div>
                      </td>
                      <td className="num px-3 py-2 text-end tabular-nums">{c.days}</td>
                      <td className="num px-3 py-2 text-end tabular-nums text-muted-foreground">
                        {c.basis.thresholdDays}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px]",
                            c.exceedsThreshold
                              ? "bg-accent-warning/10 text-accent-warning"
                              : "bg-surface-2 text-muted-foreground",
                          )}
                        >
                          {c.exceedsThreshold ? "exceeds threshold" : "below threshold"}
                        </span>
                      </td>
                      <td className="num hidden px-3 py-2 text-[11px] text-muted-foreground sm:table-cell">
                        {c.periodStart} → {c.periodEnd}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Day count is one test among several. Ties such as a permanent home, family or centre of
              economic interest can matter more. Non-calendar tax years are used where they apply.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Entry and exit log</h2>
            {report.countries.map((c) => (
              <div key={c.basis.country_code} className="panel p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">{c.basis.country}</h3>
                  <span className="num text-xs text-muted-foreground">
                    {c.days} days · {c.periodStart} → {c.periodEnd}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {c.basis.otherTests}
                </p>
                <ul className="mt-2 space-y-1">
                  {c.segments.map((s) => (
                    <li
                      key={s.tripId}
                      className="num flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground"
                    >
                      <span className="text-foreground">
                        {s.countedFrom} → {s.countedTo}
                      </span>
                      <span>{s.daysInPeriod}d</span>
                      <span>{s.purpose.replace("_", " ")}</span>
                      {s.openEnded ? (
                        <span className="text-accent-warning">no exit recorded</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Schengen summary</h2>
        <div className="panel grid gap-3 p-4 sm:grid-cols-3">
          <Stat label="Days in the Schengen Area" value={String(report.schengen.daysInSchengen)} />
          <Stat
            label="Max in any rolling 180-day window"
            value={`${report.schengen.maxWindowDays} / 90`}
            hint={report.schengen.maxWindowDate ?? undefined}
          />
          <Stat
            label="Dates above the 90-day limit"
            value={String(report.schengen.exceededDates.length)}
            hint={
              report.schengen.exceededDates.length > 0
                ? `${report.schengen.exceededDates[0]} onward`
                : "none recorded"
            }
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Data quality</h2>
        <p className="text-xs text-muted-foreground">
          The weaknesses in this record, stated plainly so the numbers above can be relied on
          knowingly.
        </p>
        {report.dataQuality.length === 0 ? (
          <div className="panel p-3 text-xs text-muted-foreground">
            No gaps, open trips or retrospective entries found for {year}.
          </div>
        ) : (
          <ul className="space-y-2">
            {report.dataQuality.map((f, i) => (
              <li
                key={`${f.kind}-${i}`}
                className={cn(
                  "panel border-s-2 p-3",
                  f.severity === "warning" ? "border-s-accent-warning" : "border-s-border",
                )}
              >
                <div className="text-xs font-medium">{f.label}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.regimes.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Special regimes that may be relevant</h2>
          <p className="text-xs text-muted-foreground">
            Factual pointers, not recommendations, and not a statement that you qualify.
          </p>
          {report.regimes.map((r) => (
            <div key={`${r.country_code}-${r.name}`} className="panel p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-xs font-medium">{r.name}</span>
                <span className="num text-[11px] text-muted-foreground">
                  {r.country} · {r.rate}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </section>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div>
      <div className="num text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {hint ? <div className="num text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
