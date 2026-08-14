/**
 * The cases here are the ones that make this feature worth having. A naive
 * implementation — take today's offset, subtract — passes none of the DST
 * tests and produces answers that are wrong by exactly one hour, which is the
 * most dangerous size of error: large enough to miss a standup, small enough
 * that nobody checks.
 *
 * Run under two host timezones like the Schengen suite (`bun run test:tz`).
 * Nothing here may depend on the machine's local zone.
 */
import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import {
  DEFAULT_WORK_HOURS,
  FIT_NOTE,
  formatMinute,
  formatOffset,
  isValidTimezone,
  scheduleFit,
  workWindowIn,
  zoneOffsetMinutes,
  type WorkHours,
} from "./timezone";

/** The hours from the thread: 09:00–15:00, colleagues in Germany. */
const REDDIT_HOURS: WorkHours = {
  startMinute: 9 * 60,
  endMinute: 15 * 60,
  timezone: "Europe/Berlin",
};

const WINTER = "2026-12-15";
const SUMMER = "2026-07-15";

describe("dataset", () => {
  it("gives every city a timezone the runtime recognises", () => {
    for (const c of CITIES) {
      expect(c.timezone, `${c.city} has no timezone`).toBeTruthy();
      expect(isValidTimezone(c.timezone), `${c.city}: ${c.timezone}`).toBe(true);
    }
  });

  it("does not silently fall back to UTC for a bad zone", () => {
    expect(isValidTimezone("Europe/Atlantis")).toBe(false);
  });

  /**
   * These three are the reason the zone is stored rather than derived from
   * lat/lng. Each would be wrong under a naive geographic lookup.
   */
  it("keeps the political exceptions right", () => {
    const byId = (id: string) => CITIES.find((c) => c.id === id)!;
    // Spain, but an hour behind the mainland.
    expect(byId("las-palmas-es").timezone).toBe("Atlantic/Canary");
    // Mexico, but an hour AHEAD of Mexico City.
    expect(byId("playa-del-carmen-mx").timezone).toBe("America/Cancun");
    expect(byId("mexico-city-mx").timezone).toBe("America/Mexico_City");
    // The far west of China still runs on Beijing time.
    expect(byId("kunming-cn").timezone).toBe("Asia/Shanghai");
  });
});

describe("the Reddit question", () => {
  // This is the case that moved the very_early boundary from 05:00 to 06:00 —
  // see the note on scheduleFit. A 05:00 start classified as merely "early"
  // was the classifier disagreeing with the person who asked the question.
  it("Buenos Aires in winter: a 05:00 start", () => {
    const w = workWindowIn(REDDIT_HOURS, "America/Argentina/Buenos_Aires", WINTER);
    expect(formatMinute(w.startMinute)).toBe("05:00");
    expect(formatMinute(w.endMinute)).toBe("11:00");
    expect(w.offsetHours).toBe(-4);
    expect(scheduleFit(w)).toBe("very_early");
  });

  it("Seoul in winter: a 17:00–23:00 day", () => {
    const w = workWindowIn(REDDIT_HOURS, "Asia/Seoul", WINTER);
    expect(formatMinute(w.startMinute)).toBe("17:00");
    expect(formatMinute(w.endMinute)).toBe("23:00");
    expect(w.offsetHours).toBe(8);
    expect(scheduleFit(w)).toBe("very_late");
  });

  it("Bali in winter sits between the two", () => {
    const w = workWindowIn(REDDIT_HOURS, "Asia/Makassar", WINTER);
    expect(formatMinute(w.startMinute)).toBe("16:00");
    expect(formatMinute(w.endMinute)).toBe("22:00");
  });

  /**
   * The option the thread missed. One commenter asked "why not Georgia,
   * Greece, or Mauritius?" and got no reply — but the arithmetic says he was
   * right, and this is the answer a ranked view would surface immediately.
   */
  it("surfaces the middle band the thread overlooked", () => {
    for (const zone of ["Asia/Tbilisi", "Europe/Athens", "Indian/Mauritius"]) {
      const w = workWindowIn(REDDIT_HOURS, zone, WINTER);
      expect(scheduleFit(w), zone).toBe("aligned");
    }
  });
});

describe("DST — the whole reason the date is required", () => {
  /**
   * Nothing happens in Seoul: Korea has had no DST since 1988. The gap moves
   * because Berlin springs forward. A tool using "the current offset" in
   * August to answer a question about December is wrong by exactly this hour.
   */
  it("Seoul's gap to Berlin changes by an hour between summer and winter", () => {
    const summer = workWindowIn(REDDIT_HOURS, "Asia/Seoul", SUMMER);
    const winter = workWindowIn(REDDIT_HOURS, "Asia/Seoul", WINTER);
    expect(summer.offsetHours).toBe(7);
    expect(winter.offsetHours).toBe(8);
    expect(formatMinute(summer.startMinute)).toBe("16:00");
    expect(formatMinute(winter.startMinute)).toBe("17:00");
  });

  it("southern hemisphere: Cape Town has no DST, so its gap also swings", () => {
    expect(workWindowIn(REDDIT_HOURS, "Africa/Johannesburg", SUMMER).offsetHours).toBe(0);
    expect(workWindowIn(REDDIT_HOURS, "Africa/Johannesburg", WINTER).offsetHours).toBe(1);
  });

  it("both zones observing DST together keeps the gap constant", () => {
    expect(workWindowIn(REDDIT_HOURS, "Europe/Athens", SUMMER).offsetHours).toBe(1);
    expect(workWindowIn(REDDIT_HOURS, "Europe/Athens", WINTER).offsetHours).toBe(1);
  });

  it("Mexico abolished DST in 2022 — no summer shift on its own clock", () => {
    const mx = "America/Mexico_City";
    expect(zoneOffsetMinutes(mx, new Date("2026-01-15T12:00:00Z"))).toBe(-360);
    expect(zoneOffsetMinutes(mx, new Date("2026-07-15T12:00:00Z"))).toBe(-360);
  });

  it("Playa del Carmen is genuinely an hour off Mexico City", () => {
    const pdc = workWindowIn(REDDIT_HOURS, "America/Cancun", WINTER);
    const cdmx = workWindowIn(REDDIT_HOURS, "America/Mexico_City", WINTER);
    expect(pdc.offsetHours - cdmx.offsetHours).toBe(1);
  });
});

describe("offsets that are not whole hours", () => {
  it("handles the half-hour zones", () => {
    const w = workWindowIn(REDDIT_HOURS, "Asia/Kolkata", WINTER);
    expect(w.offsetHours).toBe(4.5);
    expect(formatMinute(w.startMinute)).toBe("13:30");
    expect(formatOffset(w.offsetHours)).toBe("+4h30");
  });

  it("handles the 45-minute zone", () => {
    const w = workWindowIn(REDDIT_HOURS, "Asia/Kathmandu", WINTER);
    expect(w.offsetHours).toBe(4.75);
    expect(formatMinute(w.startMinute)).toBe("13:45");
  });
});

describe("day boundaries", () => {
  it("reports the day shift when the local start runs into tomorrow", () => {
    const lateShift: WorkHours = {
      startMinute: 17 * 60,
      endMinute: 23 * 60,
      timezone: "Europe/Berlin",
    };
    const w = workWindowIn(lateShift, "Asia/Seoul", WINTER);
    expect(w.startDayShift).toBe(1);
    expect(formatMinute(w.startMinute)).toBe("01:00");
  });

  it("flags a day that crosses local midnight as overnight", () => {
    const w = workWindowIn(
      { startMinute: 14 * 60, endMinute: 20 * 60, timezone: "Europe/Berlin" },
      "Asia/Seoul",
      WINTER,
    );
    expect(w.startDayShift).not.toBe(w.endDayShift);
    expect(scheduleFit(w)).toBe("overnight");
  });

  it("reports a negative shift when the local start is the previous day", () => {
    const earlyShift: WorkHours = {
      startMinute: 2 * 60,
      endMinute: 8 * 60,
      timezone: "Europe/Berlin",
    };
    const w = workWindowIn(earlyShift, "America/Argentina/Buenos_Aires", WINTER);
    expect(w.startDayShift).toBe(-1);
    expect(formatMinute(w.startMinute)).toBe("22:00");
  });
});

describe("formatting and classification", () => {
  it("formats offsets readably", () => {
    expect(formatOffset(0)).toBe("same time");
    expect(formatOffset(8)).toBe("+8h");
    expect(formatOffset(-4)).toBe("−4h");
  });

  it("a same-zone move is aligned and changes nothing", () => {
    const w = workWindowIn(DEFAULT_WORK_HOURS, "Europe/Berlin", WINTER);
    expect(w.offsetHours).toBe(0);
    expect(formatMinute(w.startMinute)).toBe("09:00");
    expect(scheduleFit(w)).toBe("aligned");
  });

  it("has a note for every fit it can return", () => {
    const seen = new Set(
      CITIES.map((c) => scheduleFit(workWindowIn(REDDIT_HOURS, c.timezone, WINTER))),
    );
    for (const fit of seen) expect(FIT_NOTE[fit]).toBeTruthy();
  });
});

describe("no city produces a nonsense window", () => {
  it("keeps every start and end inside a real clock", () => {
    for (const date of [WINTER, SUMMER]) {
      for (const c of CITIES) {
        const w = workWindowIn(REDDIT_HOURS, c.timezone, date);
        expect(w.startMinute, `${c.city} ${date}`).toBeGreaterThanOrEqual(0);
        expect(w.startMinute).toBeLessThan(1440);
        expect(w.endMinute).toBeGreaterThanOrEqual(0);
        expect(w.endMinute).toBeLessThan(1440);
        expect(Math.abs(w.offsetHours)).toBeLessThanOrEqual(14);
      }
    }
  });
});
