/**
 * Audit export for the employer dashboard.
 *
 * The export carries the same data-quality flags as the personal tax report.
 * An audit trail that overstates its own reliability is a liability for the
 * company, so every file states plainly that the underlying data is
 * self-reported by employees and that gaps are gaps, not absences of travel.
 */
import { jsPDF } from "jspdf";
import type { OrgOverview } from "./presence";
import { PE_BENCHMARK_DAYS, PE_BENCHMARK_LABEL } from "./presence";

export const AUDIT_DISCLAIMER =
  "Self-reported travel data. This record evidences recorded presence only; it is not a determination of tax residency or permanent establishment. Verify against payroll, travel bookings and immigration stamps before relying on it.";

/**
 * Characters that make a spreadsheet treat a cell as a FORMULA rather than
 * text. Employee display names are free text, so an unescaped one could run
 * code on the admin's machine when the audit is opened. Same protection as
 * the personal tax-report exporter.
 */
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

/** Neutralise a user-supplied string for both CSV cells and PDF labels. */
export function neutraliseFormula(value: string): string {
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value;
}

function esc(v: string | number | null): string {
  const raw = String(v ?? "");
  const s = typeof v === "string" ? neutraliseFormula(raw) : raw;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}


export function auditFileName(orgName: string, ext: string): string {
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "organisation"}-presence-audit.${ext}`;
}

export function auditToCsv(
  overview: OrgOverview,
  orgName: string,
  countryFilter: string | null,
): string {
  const lines: string[] = [];
  const countries = countryFilter
    ? overview.countries.filter((c) => c.country_code === countryFilter)
    : overview.countries;

  lines.push(`Organisation,${esc(orgName)}`);
  lines.push(`Period,${overview.windowStart} to ${overview.windowEnd}`);
  lines.push(`Basis,Rolling 12 months`);
  lines.push(`Benchmark,${esc(PE_BENCHMARK_LABEL)} (${PE_BENCHMARK_DAYS} days)`);
  lines.push(`Disclaimer,${esc(AUDIT_DISCLAIMER)}`);
  lines.push("");

  lines.push("Country exposure");
  lines.push(
    "Country,Country code,Employees,Total days,Longest single stay,Residency threshold (days),Policy limit (days),Status",
  );
  for (const c of countries) {
    lines.push(
      [
        esc(c.country),
        c.country_code,
        c.employeeCount,
        c.totalDays,
        c.longestSingleStay,
        c.thresholdDays,
        c.policyMaxDays ?? "",
        c.risk,
      ].join(","),
    );
  }
  lines.push("");

  lines.push("Per employee, per country");
  lines.push(
    "Employee,Country,Country code,Days recorded,Longest stay,Open stay,Residency threshold,Policy limit,Status",
  );
  for (const c of countries) {
    for (const m of c.members) {
      lines.push(
        [
          esc(m.display_name),
          esc(c.country),
          c.country_code,
          m.days,
          m.longestStay,
          m.openStay ? "yes" : "no",
          m.thresholdDays,
          m.policyMaxDays ?? "",
          m.risk,
        ].join(","),
      );
    }
  }
  lines.push("");

  lines.push("Data quality");
  lines.push("Type,Item,Detail");
  if (overview.flags.length === 0) {
    lines.push("none,No flags raised,All recorded stays have entry and exit dates.");
  }
  for (const f of overview.flags) {
    lines.push([f.kind, esc(f.label), esc(f.detail)].join(","));
  }
  return lines.join("\n");
}

export async function auditToPdf(
  overview: OrgOverview,
  orgName: string,
  countryFilter: string | null,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth();
  let y = margin;

  const line = (text: string, size = 10, bold = false, gap = 14) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    for (const part of doc.splitTextToSize(text, width - margin * 2) as string[]) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(part, margin, y);
      y += gap;
    }
  };

  line(`${orgName} — presence audit`, 16, true, 22);
  line(`Rolling 12 months: ${overview.windowStart} to ${overview.windowEnd}`, 10);
  line(`${PE_BENCHMARK_LABEL} (${PE_BENCHMARK_DAYS} days)`, 9);
  y += 6;
  line(AUDIT_DISCLAIMER, 8);
  y += 10;

  const countries = countryFilter
    ? overview.countries.filter((c) => c.country_code === countryFilter)
    : overview.countries;

  line("Country exposure", 12, true, 18);
  for (const c of countries) {
    line(
      `${c.country} (${c.country_code}) — ${c.employeeCount} employee(s), ${c.totalDays} recorded days, longest single stay ${c.longestSingleStay} days. Residency threshold ${c.thresholdDays} days${
        c.policyMaxDays !== null ? `, policy limit ${c.policyMaxDays} days` : ""
      }. Status: ${c.risk}.`,
      9,
    );
    for (const m of c.members) {
      line(
        `   · ${m.display_name}: ${m.days} days${m.openStay ? " (open stay)" : ""} — ${m.risk}`,
        9,
        false,
        12,
      );
    }
    y += 4;
  }

  y += 8;
  line("Data quality", 12, true, 18);
  if (overview.flags.length === 0) {
    line("No flags raised. All recorded stays have entry and exit dates.", 9);
  }
  for (const f of overview.flags) {
    line(`· ${f.label} — ${f.detail}`, 9, false, 12);
  }

  return doc.output("blob");
}
