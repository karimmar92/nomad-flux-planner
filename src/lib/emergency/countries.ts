/**
 * Emergency numbers by country.
 *
 * SAFETY-CRITICAL DATA. A wrong number here costs minutes in a situation where
 * minutes matter, so the rules for this file are stricter than for cost data:
 *
 *   - Only numbers I hold with high confidence are listed. A missing entry is
 *     recoverable — the UI falls back to 112 and says so. A wrong entry is not.
 *   - `verified` carries a date and is shown in the UI. Treat anything older
 *     than a year as needing a re-check against the country's own civil
 *     protection or police site.
 *   - Where a country has both a local number and 112, BOTH are listed. 112
 *     usually works from any mobile even without a SIM or with no credit, and
 *     most travellers do not know this.
 *
 * DO NOT let an LLM refresh this file unattended. Cost estimates being 15%
 * off is an annoyance; an ambulance number being wrong is not the same class
 * of error.
 */

export type CountryEmergency = {
  countryCode: string;
  /** The single number to call if you only remember one. */
  primary: string;
  police?: string;
  ambulance?: string;
  fire?: string;
  /** Genuinely separate service, not a synonym — Thailand's 1155 is staffed
   *  by English speakers in a way 191 is not. */
  touristPolice?: string;
  /** True where 112 reaches emergency services, typically from any mobile. */
  euro112: boolean;
  /** Practical notes that change what you should do, not trivia. */
  note?: string;
};

export const EMERGENCY_VERIFIED = "2026-08-06";

export const COUNTRY_EMERGENCY: CountryEmergency[] = [
  // ── Europe: 112 is the single emergency number across the EU/EEA ──────────
  { countryCode: "PT", primary: "112", euro112: true },
  { countryCode: "ES", primary: "112", euro112: true },
  { countryCode: "GR", primary: "112", euro112: true },
  { countryCode: "HU", primary: "112", euro112: true },
  { countryCode: "PL", primary: "112", euro112: true },
  { countryCode: "CZ", primary: "112", euro112: true },
  { countryCode: "EE", primary: "112", euro112: true },
  {
    countryCode: "RS",
    primary: "112",
    police: "192",
    ambulance: "194",
    fire: "193",
    euro112: true,
  },
  { countryCode: "AL", primary: "112", euro112: true },
  {
    countryCode: "TR",
    primary: "112",
    euro112: true,
    note: "112 replaced the separate police and ambulance lines and now handles all emergencies.",
  },
  {
    countryCode: "GE",
    primary: "112",
    euro112: true,
    note: "112 covers police, ambulance and fire, and operators generally speak English.",
  },

  // ── Asia ─────────────────────────────────────────────────────────────────
  {
    countryCode: "TH",
    primary: "191",
    police: "191",
    ambulance: "1669",
    fire: "199",
    touristPolice: "1155",
    euro112: false,
    note: "1155 is the tourist police — English-speaking and the better first call for anything non-medical.",
  },
  {
    countryCode: "ID",
    primary: "112",
    police: "110",
    ambulance: "118",
    fire: "113",
    euro112: true,
    note: "112 works in most cities. Outside them, the direct numbers are more reliable.",
  },
  {
    countryCode: "VN",
    primary: "113",
    police: "113",
    ambulance: "115",
    fire: "114",
    euro112: false,
  },
  {
    countryCode: "MY",
    primary: "999",
    euro112: true,
    note: "112 also connects from a mobile, including without a SIM.",
  },
  {
    countryCode: "TW",
    primary: "110",
    police: "110",
    ambulance: "119",
    fire: "119",
    euro112: false,
  },
  {
    countryCode: "KR",
    primary: "112",
    police: "112",
    ambulance: "119",
    fire: "119",
    euro112: false,
    note: "1330 is a 24h multilingual travel helpline — useful for interpretation during an emergency.",
  },
  {
    countryCode: "CN",
    primary: "110",
    police: "110",
    ambulance: "120",
    fire: "119",
    euro112: false,
    note: "English is limited on all lines. Have someone local call if you possibly can.",
  },

  // ── Latin America ────────────────────────────────────────────────────────
  { countryCode: "MX", primary: "911", euro112: false },
  {
    countryCode: "CO",
    primary: "123",
    euro112: false,
    note: "123 is the single national emergency line.",
  },
  {
    countryCode: "AR",
    primary: "911",
    police: "911",
    ambulance: "107",
    fire: "100",
    euro112: false,
  },

  // ── Africa & Middle East ─────────────────────────────────────────────────
  {
    countryCode: "ZA",
    primary: "10111",
    police: "10111",
    ambulance: "10177",
    euro112: true,
    note: "112 works from a mobile and routes to a call centre. 10111 reaches police directly.",
  },
  {
    countryCode: "MU",
    primary: "999",
    police: "999",
    ambulance: "114",
    fire: "115",
    euro112: true,
  },
  {
    countryCode: "AE",
    primary: "999",
    police: "999",
    ambulance: "998",
    fire: "997",
    euro112: true,
  },
];

export function emergencyFor(countryCode: string): CountryEmergency | undefined {
  return COUNTRY_EMERGENCY.find(
    (c) => c.countryCode.toUpperCase() === countryCode.toUpperCase(),
  );
}
