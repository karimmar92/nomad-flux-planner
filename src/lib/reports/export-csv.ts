import type { TaxReport } from "./tax-report";

/**
 * The line that must appear on every export, on every PDF page, and on screen.
 * It states what the document is (a record) and what it is not (a determination).
 */
export const REPORT_DISCLAIMER =
  "This is a record of your travel, not a determination of your tax status. Day count is one test among several. Give it to a qualified adviser.";

export function reportFileName(year: number, ext: string): string {
  return `presence-record-${year}.${ext}`;
}

function csvCell(value: string | number | boolean | null): string {
  const s = value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRows(rows: (string | number | boolean | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Flat CSV an accountant can drop straight into a spreadsheet. */
export function taxReportToCsv(report: TaxReport): string {
  const rows: (string | number | boolean | null)[][] = [];

  rows.push([`Presence record ${report.year}`]);
  rows.push([REPORT_DISCLAIMER]);
  rows.push([`Generated ${report.generatedAt}`]);
  rows.push([]);

  rows.push(["PRESENCE BY COUNTRY"]);
  rows.push([
    "Country",
    "ISO",
    "Days present",
    "Day-count threshold",
    "Presence exceeds threshold",
    "Tax-year basis",
    "Period start",
    "Period end",
  ]);
  for (const c of report.countries) {
    rows.push([
      c.basis.country,
      c.basis.country_code,
      c.days,
      c.basis.thresholdDays,
      c.exceedsThreshold ? "yes" : "no",
      c.basis.basisLabel,
      c.periodStart,
      c.periodEnd,
    ]);
  }
  rows.push([]);

  rows.push(["ENTRY AND EXIT LOG"]);
  rows.push([
    "Country",
    "ISO",
    "Entry date",
    "Exit date",
    "Counted from",
    "Counted to",
    "Days in period",
    "Purpose",
  ]);
  for (const c of report.countries) {
    for (const s of c.segments) {
      rows.push([
        c.basis.country,
        c.basis.country_code,
        s.entry_date,
        s.exit_date ?? "(no exit recorded)",
        s.countedFrom,
        s.countedTo,
        s.daysInPeriod,
        s.purpose,
      ]);
    }
  }
  rows.push([]);

  rows.push(["SCHENGEN SUMMARY"]);
  rows.push(["Days recorded in the Schengen Area", report.schengen.daysInSchengen]);
  rows.push(["Maximum days used in any rolling 180-day window", report.schengen.maxWindowDays]);
  rows.push(["Date of that maximum", report.schengen.maxWindowDate ?? "n/a"]);
  rows.push(["Dates where the recorded 90-day limit was exceeded", report.schengen.exceededDates.length]);
  for (const d of report.schengen.exceededDates) rows.push(["", d]);
  rows.push([]);

  rows.push(["DATA QUALITY"]);
  rows.push(["Kind", "Severity", "Flag", "Detail"]);
  if (report.dataQuality.length === 0) {
    rows.push(["", "", "No gaps, open trips or retrospective entries found", ""]);
  }
  for (const f of report.dataQuality) rows.push([f.kind, f.severity, f.label, f.detail]);
  rows.push([]);

  rows.push(["SPECIAL REGIMES THAT MAY BE RELEVANT — ASK YOUR ADVISER"]);
  rows.push(["Country", "Regime", "Headline rate", "Note"]);
  for (const r of report.regimes) rows.push([r.country, r.name, r.rate, r.note]);

  return csvRows(rows);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
