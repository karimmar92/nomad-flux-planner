/**
 * Two behaviour changes that alter numbers people act on, so both get tests.
 *
 * 1. A free-movement passport has no Schengen 90/180 limit. The app showed one
 *    to everybody, which teaches an EU citizen a constraint they do not have.
 * 2. Days on a national long-stay visa do not consume the short-stay
 *    allowance. The engine counted `nomad_visa` as tourism, contradicting both
 *    its own doc comment and the published FAQ.
 *
 * The second is the one worth being nervous about. Excluding days that should
 * have counted produces an overstay, and under EES an overstay is flagged
 * automatically and retained for five years. So the exclusion is asserted
 * narrowly: it applies to the two long-stay purposes and to nothing else.
 */
import { describe, expect, it } from "vitest";
import { applicableRules } from "./index";
import { schengenDaysUsed, type Trip as EngineTrip } from "@/lib/schengen";
import { hasSchengenLimit } from "@/config/passports";

describe("hasSchengenLimit", () => {
  it("exempts EU, EEA and Swiss passports", () => {
    for (const code of ["DE", "IE", "FR", "IS", "NO", "LI", "CH"]) {
      expect(hasSchengenLimit(code)).toBe(false);
    }
  });

  it("applies to third-country passports", () => {
    for (const code of ["US", "GB", "CA", "AU", "ZA", "IN"]) {
      expect(hasSchengenLimit(code)).toBe(true);
    }
  });

  it("treats Ireland and Cyprus as free movement even though they are outside Schengen", () => {
    // The two lists genuinely differ. Conflating them is the obvious bug here.
    expect(hasSchengenLimit("IE")).toBe(false);
    expect(hasSchengenLimit("CY")).toBe(false);
  });

  it("assumes a limit when the passport is unknown", () => {
    // Fails toward showing a limit. Hiding one from somebody who has it is a
    // ban at the border; showing a spare one is a wasted card.
    expect(hasSchengenLimit(null)).toBe(true);
    expect(hasSchengenLimit(undefined)).toBe(true);
    expect(hasSchengenLimit("")).toBe(true);
  });

  it("is case insensitive", () => {
    expect(hasSchengenLimit("de")).toBe(false);
  });
});

describe("applicableRules", () => {
  it("drops the Schengen counter for a free-movement passport", () => {
    expect(applicableRules("DE")).not.toContain("schengen");
  });

  it("keeps every other rule, because those are not passport-dependent", () => {
    const rules = applicableRules("DE");
    expect(rules).toContain("tax_183");
    expect(rules).toContain("feie");
    expect(rules).toContain("uk_srt");
  });

  it("keeps Schengen for a third-country passport", () => {
    expect(applicableRules("US")).toContain("schengen");
  });
});

describe("schengenDaysUsed and trip purpose", () => {
  // NonNullable, because EngineTrip.purpose is optional and the project runs
  // exactOptionalPropertyTypes: `purpose: undefined` is not assignable to an
  // optional property, only absence is.
  const trip = (purpose: NonNullable<EngineTrip["purpose"]>): EngineTrip[] => [
    { countryCode: "PT", entryDate: "2026-01-01", exitDate: "2026-01-10", purpose },
  ];

  // 1 to 10 January inclusive: entry and exit days both count in full.
  const TEN_DAYS = 10;

  it("counts visitor days in full, including entry and exit", () => {
    expect(schengenDaysUsed(trip("tourist"), "2026-01-15")).toBe(TEN_DAYS);
  });

  it("excludes days on a national long-stay visa", () => {
    expect(schengenDaysUsed(trip("nomad_visa"), "2026-01-15")).toBe(0);
  });

  it("excludes days on a residence permit", () => {
    expect(schengenDaysUsed(trip("residence"), "2026-01-15")).toBe(0);
  });

  it("ignores non-Schengen countries whatever the purpose", () => {
    expect(
      schengenDaysUsed(
        [
          {
            countryCode: "TH",
            entryDate: "2026-01-01",
            exitDate: "2026-01-10",
            purpose: "tourist",
          },
        ],
        "2026-01-15",
      ),
    ).toBe(0);
  });

  it("counts a visitor stay that sits alongside a long-stay one", () => {
    // The mixed case is the one that matters: someone on a D8 in Portugal who
    // also takes a visitor trip to Italy still burns days for the Italy leg.
    const trips: EngineTrip[] = [
      { countryCode: "PT", entryDate: "2026-01-01", exitDate: "2026-01-10", purpose: "nomad_visa" },
      { countryCode: "IT", entryDate: "2026-02-01", exitDate: "2026-02-05", purpose: "tourist" },
    ];
    expect(schengenDaysUsed(trips, "2026-02-10")).toBe(5);
  });
});
