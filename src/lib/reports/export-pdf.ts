import { APP_NAME } from "@/lib/app";
import { REPORT_DISCLAIMER, reportFileName } from "./export-csv";
import type { TaxReport } from "./tax-report";

/**
 * Client-side PDF generation, so the report can be produced with no network —
 * the same reason the rest of the app is offline-first.
 *
 * Wording rule (see tax-report.ts): this document reports presence against a
 * threshold. It never asserts residency.
 */
export async function taxReportToPdf(report: TaxReport, ownerName: string): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  const heading = (text: string, size = 12) => {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size + 8;
  };

  const body = (text: string, size = 9) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    if (y + lines.length * (size + 3) > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 6;
  };

  // ---- Cover block -------------------------------------------------
  heading(`Presence record — ${report.year}`, 18);
  body(
    `${ownerName ? `${ownerName}. ` : ""}Prepared with ${APP_NAME} on ${report.generatedAt.slice(0, 10)}. ` +
      `Covers ${report.countries.length} ${report.countries.length === 1 ? "country" : "countries"} with recorded presence.`,
  );
  body(REPORT_DISCLAIMER, 10);
  y += 6;

  // ---- Presence by country ----------------------------------------
  heading("Presence by country");
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 33] },
    head: [["Country", "Days", "Threshold", "Presence vs threshold", "Basis", "Period"]],
    body: report.countries.map((c) => [
      c.basis.country,
      String(c.days),
      `${c.basis.thresholdDays} days`,
      c.exceedsThreshold ? "Exceeds day-count threshold" : "Below day-count threshold",
      c.basis.basisLabel,
      `${c.periodStart} → ${c.periodEnd}`,
    ]),
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  for (const c of report.countries) {
    heading(`${c.basis.country} — ${c.days} days in ${report.year}`, 11);
    body(
      `${c.basis.country}'s day-count threshold is ${c.basis.thresholdDays} days per ${c.basis.basisLabel} ` +
        `(${c.periodStart} to ${c.periodEnd}). Your recorded presence ${
          c.exceedsThreshold ? "exceeds it" : "does not reach it"
        }.`,
    );
    body(`Day count is one test among several. ${c.basis.otherTests} ${REPORT_DISCLAIMER}`);
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 33] },
      head: [["Entry", "Exit", "Counted from", "Counted to", "Days", "Purpose"]],
      body: c.segments.map((s) => [
        s.entry_date,
        s.exit_date ?? "no exit recorded",
        s.countedFrom,
        s.countedTo,
        String(s.daysInPeriod),
        s.purpose.replace("_", " "),
      ]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // ---- Schengen ----------------------------------------------------
  heading("Schengen Area summary");
  body(
    `Days recorded in the Schengen Area during ${report.year}: ${report.schengen.daysInSchengen}. ` +
      `Maximum used in any rolling 180-day window: ${report.schengen.maxWindowDays} of 90` +
      (report.schengen.maxWindowDate ? `, measured on ${report.schengen.maxWindowDate}.` : "."),
  );
  body(
    report.schengen.exceededDates.length === 0
      ? "No date in this year shows recorded presence above the 90-day limit."
      : `The recorded 90-day limit was exceeded on ${report.schengen.exceededDates.length} date(s), ` +
          `from ${report.schengen.exceededDates[0]} to ${report.schengen.exceededDates[report.schengen.exceededDates.length - 1]}.`,
  );

  // ---- Data quality -------------------------------------------------
  heading("Data quality");
  body(
    "These are the weaknesses in the underlying record. They are listed so the numbers above can be relied on knowingly rather than blindly.",
  );
  if (report.dataQuality.length === 0) {
    body("No gaps, open trips or retrospective entries were found for this period.");
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 33] },
      head: [["Flag", "Detail"]],
      body: report.dataQuality.map((f) => [f.label, f.detail]),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // ---- Regimes -------------------------------------------------------
  if (report.regimes.length > 0) {
    heading("Special regimes that may be relevant");
    body("Factual pointers only. Not a recommendation and not a statement that you qualify — ask your adviser.");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [30, 30, 33] },
      head: [["Country", "Regime", "Headline rate", "Note"]],
      body: report.regimes.map((r) => [r.country, r.name, r.rate, r.note]),
    });
  }

  // ---- Disclaimer on EVERY page --------------------------------------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110);
    const h = doc.internal.pageSize.getHeight();
    const lines = doc.splitTextToSize(REPORT_DISCLAIMER, pageWidth - margin * 2 - 60);
    doc.text(lines, margin, h - 34);
    doc.text(`${i} / ${pages}`, pageWidth - margin, h - 34, { align: "right" });
    doc.setTextColor(0);
  }

  return doc.output("blob");
}

export function pdfFileName(year: number): string {
  return reportFileName(year, "pdf");
}
