/**
 * Right to work and social security: the shape of the data and the rules for
 * using it honestly.
 *
 * This is the page an HR lead or a nomad reads before deciding whether someone
 * may work from a country at all, so it follows the same discipline as the tax
 * pages: EVIDENCE, NEVER A CONCLUSION. It reports what an official source says,
 * links the source and shows when it was checked. It never says someone IS or
 * IS NOT allowed to work, because that turns on facts this app cannot see (their
 * visa, their contract, their nationality, a treaty) and on law that changes.
 *
 * Three rules are enforced by tests rather than by good intentions:
 *  - Any claim other than "unclear" needs at least one official https source.
 *  - Every entry carries the date it was verified.
 *  - A stale entry is flagged to the reader instead of being presented as current.
 */

export type VisitorWorkStatus = "not_permitted" | "grey_area" | "conditional" | "unclear";

export type Source = { label: string; url: string };

export type WorkRightsEntry = {
  countryCode: string;
  country: string;
  /** Whether a visa-free visitor may do remote work for a foreign employer or client. */
  visitorWork: {
    status: VisitorWorkStatus;
    summary: string;
    sources: Source[];
  };
  /** The lawful route for remote workers, where the country has one. */
  remoteRoute: {
    name: string | null;
    conditions: string | null;
    sources: Source[];
  };
  socialSecurity: {
    /** In the EU/EEA social security coordination, so an A1 certificate can apply. */
    euCoordination: boolean | null;
    /** A US totalization agreement is in force with this country. */
    usTotalization: boolean | null;
    usTotalizationYear: number | null;
    note: string;
    sources: Source[];
  };
  confidence: "high" | "medium" | "low";
  /** What could not be verified. Shown to the reader, not hidden. */
  openQuestions: string[];
  /** ISO date the sources were last checked. */
  verifiedOn: string;
};

/** After this many days an entry is shown with a warning that it may be out of date. */
export const STALE_AFTER_DAYS = 365;

/**
 * Labels say exactly what the sources say, no more. "not_permitted" means an
 * official source states that visitor status carries no right to work; it does
 * NOT mean remote work for a foreign employer was ruled on, and most pages say
 * in their own summary that it was not. "grey_area" is the common case: the law
 * bars work "in the country" or by defined activities and is silent on remote
 * work paid from abroad.
 */
export const STATUS_LABEL: Record<VisitorWorkStatus, string> = {
  not_permitted: "Official sources: visitor status gives no right to work",
  grey_area: "Law does not say clearly for remote work",
  conditional: "Permitted on conditions",
  unclear: "Not established",
};

/** Short label for a pill. */
export const STATUS_SHORT: Record<VisitorWorkStatus, string> = {
  not_permitted: "No work rights",
  grey_area: "Unclear",
  conditional: "Conditional",
  unclear: "Not established",
};

export function daysSince(iso: string, todayIso: string): number {
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000);
}

export function isStale(entry: Pick<WorkRightsEntry, "verifiedOn">, todayIso: string): boolean {
  return daysSince(entry.verifiedOn, todayIso) > STALE_AFTER_DAYS;
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** Problems that make an entry unfit to publish. Empty means it passes. */
export function validateEntry(entry: WorkRightsEntry): string[] {
  const problems: string[] = [];
  const where = entry.countryCode;

  if (!/^[A-Z]{2}$/.test(entry.countryCode)) problems.push(`${where}: bad country code`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.verifiedOn))
    problems.push(`${where}: verifiedOn is not an ISO date`);
  if (entry.visitorWork.summary.trim().length === 0)
    problems.push(`${where}: empty visitor summary`);

  const claimsAnything = entry.visitorWork.status !== "unclear";
  if (claimsAnything && entry.visitorWork.sources.length === 0) {
    problems.push(`${where}: a position on visitor work needs a source`);
  }
  if (entry.remoteRoute.name !== null && entry.remoteRoute.sources.length === 0) {
    problems.push(`${where}: a named remote route needs a source`);
  }
  const ss = entry.socialSecurity;
  if ((ss.euCoordination !== null || ss.usTotalization !== null) && ss.sources.length === 0) {
    problems.push(`${where}: a social security claim needs a source`);
  }
  if (ss.usTotalization === true && ss.usTotalizationYear === null) {
    problems.push(`${where}: totalization in force needs its year`);
  }
  if (ss.usTotalization !== true && ss.usTotalizationYear !== null) {
    problems.push(`${where}: a totalization year without an agreement`);
  }

  const all = [
    ...entry.visitorWork.sources,
    ...entry.remoteRoute.sources,
    ...entry.socialSecurity.sources,
  ];
  for (const s of all) {
    if (!isHttpsUrl(s.url)) problems.push(`${where}: source is not an https URL: ${s.url}`);
    if (s.label.trim().length === 0) problems.push(`${where}: source with no label`);
  }

  // A low-confidence entry must say what is missing, or it is just a shrug.
  if (entry.confidence === "low" && entry.openQuestions.length === 0) {
    problems.push(`${where}: low confidence needs its open questions listed`);
  }
  return problems;
}
