import { describe, expect, it } from "vitest";
import { parseSpokenTrip } from "./parse-speech";

describe("parseSpokenTrip", () => {
  it("reads a country and a date range sharing one spoken year", () => {
    const result = parseSpokenTrip("Portugal, January 10th to March 15th 2026");
    expect(result).toMatchObject({
      country_code: "PT",
      entry_date: "2026-01-10",
      exit_date: "2026-03-15",
      purpose: "tourist",
    });
  });

  it("reads a single open-ended date as still there", () => {
    const result = parseSpokenTrip("I'm in Spain from May 1st 2026");
    expect(result).toMatchObject({
      country_code: "ES",
      entry_date: "2026-05-01",
      exit_date: null,
    });
  });

  it("picks up a residence-purpose keyword", () => {
    const result = parseSpokenTrip("Thailand, March 3rd 2026, moved there for work");
    expect(result).toMatchObject({
      country_code: "TH",
      entry_date: "2026-03-03",
      purpose: "residence",
    });
  });

  it("does not mistake a country code word for a match — only full names count", () => {
    // "in" is India's ISO code; this sentence must not resolve to India.
    const result = parseSpokenTrip("I was in March");
    expect(result?.country_code ?? null).not.toBe("IN");
  });

  it("returns null when nothing recognisable was said", () => {
    expect(parseSpokenTrip("hello can you hear me")).toBeNull();
  });
});
