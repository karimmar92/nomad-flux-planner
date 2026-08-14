/**
 * WORK-WINDOW ENGINE — what time your working day starts where you're going.
 *
 * The question this answers, in the words of the person who asked it on
 * r/digitalnomad: "I work 09:00–15:00 with colleagues in Germany and the
 * Netherlands. Argentina or Asia?" Sixteen people answered with their own
 * sleep preferences. One answered: "I have been in both, I was going to
 * answer, but the math made my head hurt."
 *
 * That is the whole feature. The arithmetic is not hard, it is just fiddly
 * enough that nobody does it, so people choose where to live on vibes.
 *
 * ── WHY THE DATE IS A REQUIRED ARGUMENT ────────────────────────────────
 *
 * Offsets are not constants. Between January and July, 21 of our 30 cities
 * change their offset relative to Berlin — usually because BERLIN moves, not
 * the city. Most of Asia has no DST at all, so the gap to Europe swings by a
 * full hour twice a year without anything happening locally.
 *
 * The Reddit question was asked in August about WINTER. A tool that computed
 * the answer from today's offset would have been off by an hour — enough to
 * turn "you can make the 09:00 standup" into a missed meeting every day. So
 * every function here takes the date the person is actually asking about, and
 * there is no "current offset" convenience wrapper to reach for by mistake.
 *
 * ── WHY Intl AND NOT A LIBRARY ─────────────────────────────────────────
 *
 * `Intl.DateTimeFormat` carries the IANA database in the runtime. It is
 * already there, it is updated with the browser, it handles half-hour and
 * 45-minute offsets, and it costs nothing to ship. A date library here would
 * be weight for arithmetic the platform already does correctly.
 */

/** Minutes since local midnight. 0 = 00:00, 1439 = 23:59. */
export type MinuteOfDay = number;

export type WorkHours = {
  /** Start of the working day in the TEAM's timezone, minutes since midnight. */
  startMinute: MinuteOfDay;
  /** End of the working day in the TEAM's timezone. May be before start only
   *  if the shift crosses midnight, which we do not currently model. */
  endMinute: MinuteOfDay;
  /** IANA zone the hours are expressed in, e.g. "Europe/Berlin". */
  timezone: string;
};

export type WorkWindow = {
  /** Local start time in the destination city, minutes since midnight. */
  startMinute: MinuteOfDay;
  /** Local end time in the destination city. */
  endMinute: MinuteOfDay;
  /** Whole/partial hours the city is ahead of the team. Negative = behind. */
  offsetHours: number;
  /**
   * Days the local start falls relative to the team's day.
   *  0 = same day, +1 = you start the next calendar day, -1 = previous.
   * Matters for "your Monday standup happens on your Monday evening".
   */
  startDayShift: number;
  /** Same, for the end of the working day. */
  endDayShift: number;
};

export const DEFAULT_WORK_HOURS: WorkHours = {
  startMinute: 9 * 60,
  endMinute: 17 * 60,
  timezone: "Europe/Berlin",
};

/**
 * Offset of a zone from UTC, in minutes, AT A GIVEN INSTANT.
 *
 * `longOffset` gives "GMT+05:30" / "GMT-03:00" / "GMT" and is supported
 * everywhere we run. Parsing a formatted string is inelegant, but it is the
 * only way to ask the runtime for a zone's offset without pulling in the whole
 * IANA database ourselves.
 */
export function zoneOffsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  }).formatToParts(at);

  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Plain "GMT" means exactly UTC and carries no numeric part.
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/**
 * True if the runtime knows this zone. Guards against a typo in the dataset
 * silently becoming "UTC" — which would produce a confident, wrong answer
 * rather than an obvious failure.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The instant at which a given wall-clock time occurs in a given zone.
 *
 * Converting "09:00 in Europe/Berlin on 2026-12-15" to a UTC instant is
 * circular: you need the offset to find the instant, and the instant to find
 * the offset. Resolved by guessing with the offset at UTC-noon on that date,
 * then correcting once. One correction is sufficient because DST jumps are at
 * most an hour or two and never near enough to noon to need a second pass.
 */
function instantForLocalTime(timezone: string, isoDate: string, minuteOfDay: MinuteOfDay): Date {
  const [y, mo, d] = isoDate.split("-").map(Number) as [number, number, number];
  const naive = Date.UTC(y, mo - 1, d, 0, minuteOfDay);

  const guessOffset = zoneOffsetMinutes(timezone, new Date(Date.UTC(y, mo - 1, d, 12)));
  const firstPass = new Date(naive - guessOffset * 60_000);

  const trueOffset = zoneOffsetMinutes(timezone, firstPass);
  return new Date(naive - trueOffset * 60_000);
}

/** Wraps a minute count into 0..1439 and reports how many days it moved. */
function wrapDay(minutes: number): { minute: MinuteOfDay; dayShift: number } {
  const DAY = 24 * 60;
  const dayShift = Math.floor(minutes / DAY);
  return { minute: minutes - dayShift * DAY, dayShift };
}

/**
 * The working day, expressed in the destination city's local clock.
 *
 * @param work    hours as they exist for the team
 * @param cityTimezone  IANA zone of the destination
 * @param onDate  the day being planned for, "YYYY-MM-DD". REQUIRED — see the
 *                note at the top of this file about winter offsets.
 */
export function workWindowIn(work: WorkHours, cityTimezone: string, onDate: string): WorkWindow {
  const startInstant = instantForLocalTime(work.timezone, onDate, work.startMinute);
  const endInstant = instantForLocalTime(work.timezone, onDate, work.endMinute);

  // Each end is measured separately: a working day can straddle a DST
  // transition, in which case it is genuinely an hour longer or shorter on
  // the local clock, and that is the true answer rather than an error.
  const startDelta =
    zoneOffsetMinutes(cityTimezone, startInstant) - zoneOffsetMinutes(work.timezone, startInstant);
  const endDelta =
    zoneOffsetMinutes(cityTimezone, endInstant) - zoneOffsetMinutes(work.timezone, endInstant);

  const start = wrapDay(work.startMinute + startDelta);
  const end = wrapDay(work.endMinute + endDelta);

  return {
    startMinute: start.minute,
    endMinute: end.minute,
    offsetHours: startDelta / 60,
    startDayShift: start.dayShift,
    endDayShift: end.dayShift,
  };
}

/** "05:00" */
export function formatMinute(minute: MinuteOfDay): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "+7h", "-4h30", "same time" */
export function formatOffset(offsetHours: number): string {
  if (offsetHours === 0) return "same time";
  const sign = offsetHours > 0 ? "+" : "−";
  const abs = Math.abs(offsetHours);
  const whole = Math.floor(abs);
  const mins = Math.round((abs - whole) * 60);
  return mins ? `${sign}${whole}h${mins}` : `${sign}${whole}h`;
}

/**
 * How liveable the resulting schedule is.
 *
 * The thresholds encode what the r/digitalnomad thread actually argued about,
 * and deliberately do NOT pick a winner: the top comments split evenly between
 * "Argentina, finish by noon, just be disciplined about bed" and "Asia, the
 * mornings are yours, nightlife is for weekends". Both are right for different
 * people. So this classifies the COST and lets the reader decide.
 */
export type ScheduleFit =
  | "aligned" // ordinary working day, nothing to manage
  | "early" // start between 06:00 and 07:00 local
  | "very_early" // start before 06:00 local — the "zombie on Monday" zone
  | "late" // finish after 21:00 local
  | "very_late" // finish at or after 23:00 local
  | "overnight"; // the working day crosses local midnight

/**
 * The 06:00 boundary was moved up from 05:00 after testing against the case
 * that prompted this: Berlin 09:00–15:00 lands on exactly 05:00 in Buenos
 * Aires in December, and a strict `< 05:00` test classified the thread's own
 * example as merely "early". A boundary that excludes the motivating case is
 * the wrong boundary. Before 06:00 you are getting up in the dark to work;
 * 06:00–07:00 is early but ordinary.
 */
export function scheduleFit(window: WorkWindow): ScheduleFit {
  if (window.endDayShift !== window.startDayShift) return "overnight";
  if (window.startMinute < 6 * 60) return "very_early";
  if (window.endMinute >= 23 * 60) return "very_late";
  if (window.startMinute < 7 * 60) return "early";
  if (window.endMinute > 21 * 60) return "late";
  return "aligned";
}

/**
 * One honest sentence about what the schedule costs.
 *
 * Written from the thread rather than invented: the early-start camp gives up
 * weekday evenings and cannot go out late without wrecking Monday; the
 * late-finish camp gets the whole morning ("feels like 2 days in 1") and
 * sleeps properly, but loses weekday evenings entirely.
 */
export const FIT_NOTE: Record<ScheduleFit, string> = {
  aligned: "Ordinary working hours here. Nothing to arrange around.",
  early:
    "An early start, and you are finished with most of the day ahead of you. The cost is weekday evenings: a late night wrecks the next morning.",
  very_early:
    "You would be starting before 05:00. Doable — people do it — but it means going to bed when the city is going out, and it does not survive a late Sunday.",
  late: "A late finish. Mornings are entirely yours, which many people prefer, but weekday evenings are gone.",
  very_late:
    "You would be working until 23:00 or later. The whole morning and afternoon are free, and most people report sleeping better on this pattern — but weekday social life happens without you.",
  overnight:
    "The working day crosses local midnight here. Workable only if your hours are flexible.",
};
