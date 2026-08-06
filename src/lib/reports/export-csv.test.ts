import { describe, expect, it } from "vitest";
import { taxReportToCsv } from "./export-csv";
import { buildTaxReport, COUNTING_METHOD_VERSION } from "./tax-report";
import type { Trip } from "@/lib/types";

const trip = (over: Partial<Trip>): Trip => ({
  id: crypto.randomUUID(),
  country_code: "PT",
  city_id: "lisbon-pt",
  entry_date: "2026-01-10",
  exit_date: "2026-03-15",
  purpose: "tourist",
  notes: "",
  ...over,
});

const report = () => buildTaxReport([trip({})], 2026, "2026-08-06");

describe("CSV formula injection", () => {
  it("neutralises cells that spreadsheets would execute", () => {
    // A country label carrying a formula must arrive as text. Excel and Sheets
    // parse formulas even inside quotes, so quoting alone is not a defence.
    const evil = buildTaxReport(
      [trip({ purpose: '=HYPERLINK("https://evil.example","click")' as Trip["purpose"] })],
      2026,
      "2026-08-06",
    );
    const csv = taxReportToCsv(evil);
    expect(csv).not.toMatch(/(^|,|")=HYPERLINK/);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("covers every formula trigger character", () => {
    for (const prefix of ["=", "+", "-", "@"]) {
      const r = buildTaxReport(
        [trip({ purpose: `${prefix}cmd|' /c calc'!A1` as Trip["purpose"] })],
        2026,
        "2026-08-06",
      );
      const csv = taxReportToCsv(r);
      expect(csv, `prefix ${prefix}`).toContain(`'${prefix}cmd`);
    }
  });

  it("leaves ordinary values untouched", () => {
    const csv = taxReportToCsv(report());
    expect(csv).toContain("Portugal");
    expect(csv).not.toContain("'Portugal");
  });
});

describe("report provenance", () => {
  it("states the counting method version and the rules applied", () => {
    const csv = taxReportToCsv(report());
    expect(csv).toContain(`Counting method version ${COUNTING_METHOD_VERSION}`);
    expect(csv).toContain("HOW THESE DAYS WERE COUNTED");
    expect(csv).toContain("Both the arrival day and the departure day count");
  });

  it("carries the non-determination framing", () => {
    const csv = taxReportToCsv(report());
    expect(csv).toContain("not a determination of your tax status");
  });

  it("exposes the method version on the report object", () => {
    expect(report().methodVersion).toBe(COUNTING_METHOD_VERSION);
    expect(report().methodNotes.length).toBeGreaterThan(0);
  });
});
