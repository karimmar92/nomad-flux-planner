import { describe, expect, it } from "vitest";
import { parseFlightEmailText } from "./import-email-parse";

describe("parseFlightEmailText", () => {
  it("reads a one-way flight as an open stay", () => {
    const { rows, failures } = parseFlightEmailText(`
Flight confirmation
LIS → CDG
14 Mar 2026
    `);
    expect(failures).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      country_code: "FR",
      entry_date: "2026-03-14",
      exit_date: null,
    });
  });

  it("reads a round trip as one closed stay, plus the return landing", () => {
    const { rows, failures } = parseFlightEmailText(`
Outbound
LIS → CDG
14 Mar 2026

Return
CDG → LIS
20 Mar 2026
    `);
    expect(failures).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      country_code: "FR",
      entry_date: "2026-03-14",
      exit_date: "2026-03-20",
    });
    // Honest about the return leg: they did land back in Portugal on the
    // 20th, so it is reported too, open-ended, for the user to keep or drop
    // in the preview step rather than silently discarded.
    expect(rows[1]).toMatchObject({
      country_code: "PT",
      entry_date: "2026-03-20",
      exit_date: null,
    });
  });

  it("treats a multi-day layover as a real stop", () => {
    const { rows, failures } = parseFlightEmailText(`
LIS → AMS
14 Mar 2026

AMS → CDG
16 Mar 2026
    `);
    expect(failures).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      country_code: "NL",
      entry_date: "2026-03-14",
      exit_date: "2026-03-16",
    });
    expect(rows[1]).toMatchObject({
      country_code: "FR",
      entry_date: "2026-03-16",
      exit_date: null,
    });
  });

  it("collapses a same-day connection instead of inventing a layover stay", () => {
    const { rows, failures } = parseFlightEmailText(`
LIS → AMS
14 Mar 2026

AMS → CDG
14 Mar 2026
    `);
    expect(failures).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      country_code: "FR",
      entry_date: "2026-03-14",
      exit_date: null,
    });
  });

  it("fails a route with an unrecognised airport instead of guessing", () => {
    const { rows, failures } = parseFlightEmailText(`
LIS → ZZZ
14 Mar 2026
    `);
    expect(rows).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toMatch(/not recognised/);
  });

  it("fails gracefully on text with no flight routes at all", () => {
    const { rows, failures } = parseFlightEmailText("Thank you for your purchase. Order #12345.");
    expect(rows).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0]!.reason).toMatch(/No flight routes found/);
  });
});
