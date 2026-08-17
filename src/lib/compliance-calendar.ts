import { countDistinctDays, type DayRange } from "@/lib/day-union";
import { CITIES } from "@/lib/cities";
import { expiryState, warningThresholds, type VaultDocument } from "@/lib/documents/vault";
import { basisFor, periodFor } from "@/lib/reports/tax-report";
import { fromDayIndex, SCHENGEN_COUNTRIES, toDayIndex } from "@/lib/schengen";
import { todayIso, toEngineTrips } from "@/lib/trip-dates";
import { schengenDaysUsed } from "@/lib/schengen";
import type { Trip } from "@/lib/types";

/**
 * Unified upcoming obligations, drawn from trips, documents and visas.
 *
 * This is the surface that keeps mattering after someone stops moving every
 * month: a passport still expires, a permit still renews. Everything here is
 * derived locally from cached data — no network required.
 */

export type ObligationKind =
  | "visa_expiry"
  | "visa_renewal"
  | "passport_validity"
  | "document_expiry"
  | "tax_filing"
  | "schengen_reentry";

export type Obligation = {
  id: string;
  kind: ObligationKind;
  date: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  daysAway: number;
};

const KIND_LABELS: Record<ObligationKind, string> = {
  visa_expiry: "Visa",
  visa_renewal: "Renewal window",
  passport_validity: "Passport",
  document_expiry: "Document",
  tax_filing: "Tax filing",
  schengen_reentry: "Schengen",
};

export function kindLabel(kind: ObligationKind): string {
  return KIND_LABELS[kind];
}

/**
 * Typical annual filing deadlines for the countries in the dataset. Dates are
 * the ordinary personal-income deadline and are pointers, not advice: filing
 * obligations and extensions vary by circumstance.
 */
const FILING_DEADLINES: Record<string, { monthIndex: number; day: number; note: string }> = {
  PT: { monthIndex: 5, day: 30, note: "Portuguese IRS filing usually runs 1 April – 30 June." },
  ES: { monthIndex: 5, day: 30, note: "Spanish Renta campaign usually closes at the end of June." },
  GR: { monthIndex: 6, day: 15, note: "Greek returns are usually due by mid-July." },
  HU: { monthIndex: 4, day: 20, note: "Hungarian returns are usually due by 20 May." },
  PL: { monthIndex: 3, day: 30, note: "Polish PIT is usually due by 30 April." },
  CZ: { monthIndex: 3, day: 1, note: "Czech paper returns are usually due by 1 April." },
  EE: { monthIndex: 3, day: 30, note: "Estonian returns are usually due by 30 April." },
  TH: { monthIndex: 2, day: 31, note: "Thai PND 90/91 is usually due by 31 March." },
  MX: { monthIndex: 3, day: 30, note: "Mexican annual declaration is usually due in April." },
  CO: { monthIndex: 7, day: 15, note: "Colombian deadlines fall Aug–Oct by NIT digits." },
  AR: { monthIndex: 5, day: 15, note: "Argentine deadlines fall in June by CUIT digits." },
  ID: { monthIndex: 2, day: 31, note: "Indonesian SPT is usually due by 31 March." },
  GE: { monthIndex: 2, day: 31, note: "Georgian annual returns are usually due by 1 April." },
  RS: { monthIndex: 4, day: 15, note: "Serbian annual returns are usually due by mid-May." },
  TR: { monthIndex: 2, day: 31, note: "Turkish returns are usually filed in March." },
  MY: { monthIndex: 3, day: 30, note: "Malaysian BE forms are usually due by 30 April." },
  VN: { monthIndex: 3, day: 30, note: "Vietnamese finalisation is usually due by 30 April." },
  TW: { monthIndex: 4, day: 31, note: "Taiwanese returns are usually filed in May." },
  KR: { monthIndex: 4, day: 31, note: "Korean returns are usually due by 31 May." },
  ZA: { monthIndex: 9, day: 23, note: "South African filing season usually runs Jul–Oct." },
  MU: {
    monthIndex: 8,
    day: 30,
    note: "Mauritian returns are usually due by the end of September.",
  },
  AL: { monthIndex: 5, day: 30, note: "Albanian returns are usually due by 30 June." },
  AE: { monthIndex: 0, day: 1, note: "The UAE has no personal income tax filing for individuals." },
};

function isoFromParts(year: number, monthIndex: number, day: number): string {
  return fromDayIndex(Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000));
}

function severityFor(daysAway: number, criticalWithin: number, warnWithin: number) {
  if (daysAway <= criticalWithin) return "critical" as const;
  if (daysAway <= warnWithin) return "warning" as const;
  return "info" as const;
}

export function buildComplianceCalendar(
  trips: Trip[],
  documents: VaultDocument[],
  today = todayIso(),
  horizonDays = 550,
): Obligation[] {
  const out: Obligation[] = [];
  const t0 = toDayIndex(today);
  const horizon = t0 + horizonDays;

  const push = (o: Omit<Obligation, "daysAway">) => {
    const daysAway = toDayIndex(o.date) - t0;
    if (daysAway < -30 || toDayIndex(o.date) > horizon) return;
    out.push({ ...o, daysAway });
  };

  /* --- Visa expiry from open trips ------------------------------------ */
  for (const trip of trips) {
    if (trip.exit_date) continue;
    const code = trip.country_code.toUpperCase();
    const city = CITIES.find((c) => c.country_code === code);
    if (!city) continue;

    if (SCHENGEN_COUNTRIES.has(code) && trip.purpose === "tourist") {
      // Schengen expiry is a rolling calculation, handled below.
      continue;
    }
    const allowance =
      trip.purpose === "tourist"
        ? city.visa.touristDays
        : (city.visa.nomadVisa.staysPerEntryDays ??
          (city.visa.nomadVisa.durationMonths ?? 12) * 30);
    const expiry = fromDayIndex(toDayIndex(trip.entry_date) + allowance - 1);
    push({
      id: `visa-${trip.id}`,
      kind: "visa_expiry",
      date: expiry,
      title: `${city.country} — permitted stay ends`,
      detail:
        trip.purpose === "tourist"
          ? `${allowance} days from your entry on ${trip.entry_date}.${
              city.visa.extensionDays
                ? ` An extension of up to ${city.visa.extensionDays} days may be available.`
                : ""
            }`
          : `${city.visa.nomadVisa.name}: this permit period ends on this date.`,
      severity: severityFor(toDayIndex(expiry) - t0, 14, 60),
    });

    if (trip.purpose !== "tourist" && city.visa.nomadVisa.renewable) {
      const renewalOpens = fromDayIndex(toDayIndex(expiry) - 60);
      push({
        id: `renew-${trip.id}`,
        kind: "visa_renewal",
        date: renewalOpens,
        title: `${city.country} — renewal window opens`,
        detail: `${city.visa.nomadVisa.name} is renewable. Most renewals are filed in the final weeks of the current permit; confirm the exact window with the issuing authority.`,
        severity: severityFor(toDayIndex(renewalOpens) - t0, 14, 60),
      });
    }
  }

  /* --- Schengen: next date a fresh 90 days is available ---------------- */
  const engineTrips = toEngineTrips(trips);
  const usedToday = schengenDaysUsed(engineTrips, today);
  if (usedToday > 0) {
    for (let d = t0; d <= t0 + 200; d++) {
      const iso = fromDayIndex(d);
      if (schengenDaysUsed(engineTrips, iso) === 0) {
        push({
          id: "schengen-reentry",
          kind: "schengen_reentry",
          date: iso,
          title: "Schengen — rolling window fully clear",
          detail: `You have ${usedToday} of 90 days used today. On this date your trailing 180-day window contains no recorded Schengen days, so a full fresh allowance is available.`,
          severity: "info",
        });
        break;
      }
    }
  }

  /* --- Documents ------------------------------------------------------- */
  for (const doc of documents) {
    if (!doc.expires_on) continue;
    const state = expiryState(doc, today);
    if (!state) continue;

    if (doc.type === "passport") {
      for (const threshold of warningThresholds("passport")) {
        const date = fromDayIndex(toDayIndex(doc.expires_on) - threshold);
        const months = Math.round(threshold / 30.4);
        push({
          id: `passport-${doc.id}-${threshold}`,
          kind: "passport_validity",
          date,
          title: `Passport — ${months} months of validity left`,
          detail:
            months <= 6
              ? `${doc.title} expires ${doc.expires_on}. Many countries refuse entry with under six months of validity remaining.`
              : `${doc.title} expires ${doc.expires_on}. Renewals can take weeks; this is the comfortable point to start.`,
          severity: months <= 6 ? "critical" : "warning",
        });
      }
      continue;
    }

    push({
      id: `doc-${doc.id}`,
      kind: "document_expiry",
      date: doc.expires_on,
      title: `${doc.title} expires`,
      detail: `${doc.country_code ? `${doc.country_code} · ` : ""}${state.label}.`,
      severity: severityFor(state.daysRemaining, 14, 60),
    });
  }

  /* --- Tax filing where presence exceeded the day-count threshold ------- */
  const thisYear = Number(today.slice(0, 4));
  for (const year of [thisYear, thisYear + 1]) {
    const codes = Array.from(new Set(trips.map((t) => t.country_code.toUpperCase())));
    for (const code of codes) {
      const basis = basisFor(code);
      const deadline = FILING_DEADLINES[code];
      if (!deadline || code === "AE") continue;

      // The filing year covers the tax year that ended before this deadline.
      const { start, end } = periodFor(year - 1, basis.taxYearStartMonth);
      const lo = toDayIndex(start);
      const hi = toDayIndex(end);
      // DISTINCT days. Summing per trip double counts overlapping records and
      // can push the total past a threshold, which here means showing somebody
      // a filing deadline for a country they may have no obligation in.
      const ranges: DayRange[] = [];
      for (const trip of trips) {
        if (trip.country_code.toUpperCase() !== code) continue;
        const entry = toDayIndex(trip.entry_date);
        const exit = trip.exit_date ? toDayIndex(trip.exit_date) : Math.min(t0, hi);
        ranges.push({ from: Math.max(entry, lo), to: Math.min(exit, hi) });
      }
      const days = countDistinctDays(ranges);
      if (days < basis.thresholdDays) continue;

      const date = isoFromParts(year, deadline.monthIndex, deadline.day);
      push({
        id: `filing-${code}-${year}`,
        kind: "tax_filing",
        date,
        title: `${basis.country} — typical filing deadline (${year - 1} tax year)`,
        detail: `Your recorded presence for ${start} to ${end} was ${days} days, above ${basis.country}'s ${basis.thresholdDays}-day threshold. ${deadline.note} Whether you must file is a question for a qualified adviser.`,
        severity: severityFor(toDayIndex(date) - t0, 30, 90),
      });
    }
  }

  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
