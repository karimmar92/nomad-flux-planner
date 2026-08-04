/**
 * IANA timezone → ISO country code.
 *
 * The primary arrival signal, because it is the only one that works with no
 * internet and no permission: a phone updates its clock from the cellular
 * network on landing, long before any data connection is usable.
 *
 * Where a zone genuinely spans multiple countries the value is a list and the
 * UI asks instead of guessing. Coverage is weighted toward the dataset's
 * countries and the routes around them; anything unmapped falls through to
 * "ask the user", never to a wrong country.
 */

type ZoneEntry = string | string[];

export const TIMEZONE_COUNTRIES: Record<string, ZoneEntry> = {
  // Asia
  "Asia/Bangkok": ["TH", "KH", "LA", "VN"], // shared UTC+7 zone id in some OS builds
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN",
  "Asia/Hanoi": "VN",
  "Asia/Phnom_Penh": "KH",
  "Asia/Vientiane": "LA",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Pontianak": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Kuching": "MY",
  "Asia/Singapore": "SG",
  "Asia/Manila": "PH",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Taipei": "TW",
  "Asia/Hong_Kong": "HK",
  "Asia/Shanghai": "CN",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Dhaka": "BD",
  "Asia/Karachi": "PK",
  "Asia/Tbilisi": "GE",
  "Asia/Yerevan": "AM",
  "Asia/Baku": "AZ",
  "Asia/Almaty": "KZ",
  "Asia/Tashkent": "UZ",
  "Asia/Bishkek": "KG",
  // Middle East
  "Asia/Dubai": ["AE", "OM"],
  "Asia/Qatar": "QA",
  "Asia/Riyadh": ["SA", "KW", "BH"],
  "Asia/Jerusalem": "IL",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  // Europe
  "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT",
  "Atlantic/Azores": "PT",
  "Europe/Madrid": "ES",
  "Atlantic/Canary": "ES",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Zurich": "CH",
  "Europe/Prague": "CZ",
  "Europe/Budapest": "HU",
  "Europe/Warsaw": "PL",
  "Europe/Athens": "GR",
  "Europe/Tallinn": "EE",
  "Europe/Riga": "LV",
  "Europe/Vilnius": "LT",
  "Europe/Helsinki": "FI",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Dublin": "IE",
  "Europe/London": "GB",
  "Europe/Belgrade": "RS",
  "Europe/Tirane": "AL",
  "Europe/Sofia": "BG",
  "Europe/Bucharest": "RO",
  "Europe/Zagreb": "HR",
  "Europe/Ljubljana": "SI",
  "Europe/Sarajevo": "BA",
  "Europe/Skopje": "MK",
  "Europe/Podgorica": "ME",
  "Europe/Chisinau": "MD",
  "Europe/Kyiv": "UA",
  "Europe/Kiev": "UA",
  "Europe/Malta": "MT",
  "Asia/Nicosia": "CY",
  "Europe/Nicosia": "CY",
  // Africa
  "Africa/Johannesburg": ["ZA", "LS", "SZ"],
  "Africa/Cape_Town": "ZA",
  "Africa/Nairobi": ["KE", "TZ", "UG"],
  "Africa/Lagos": "NG",
  "Africa/Accra": "GH",
  "Africa/Cairo": "EG",
  "Africa/Casablanca": "MA",
  "Africa/Tunis": "TN",
  "Indian/Mauritius": "MU",
  "Atlantic/Cape_Verde": "CV",
  // Americas
  "America/Mexico_City": "MX",
  "America/Cancun": "MX",
  "America/Tijuana": "MX",
  "America/Guatemala": "GT",
  "America/Costa_Rica": "CR",
  "America/Panama": "PA",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  "America/Santiago": "CL",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Buenos_Aires": "AR",
  "America/Montevideo": "UY",
  "America/Sao_Paulo": "BR",
  "America/Fortaleza": "BR",
  "America/Manaus": "BR",
  "America/Asuncion": "PY",
  "America/La_Paz": "BO",
  "America/Caracas": "VE",
  "America/Santo_Domingo": "DO",
  "America/Havana": "CU",
  "America/New_York": ["US", "CA"],
  "America/Chicago": ["US", "CA"],
  "America/Denver": ["US", "CA"],
  "America/Los_Angeles": ["US", "CA"],
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  // Oceania
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
  "Pacific/Fiji": "FJ",
  "Atlantic/Reykjavik": "IS",
  UTC: [],
};

export type ZoneResolution =
  | { kind: "single"; countryCode: string }
  | { kind: "ambiguous"; candidates: string[] }
  | { kind: "unknown" };

/** Resolve a timezone to a country, or say honestly that it cannot. */
export function countryForTimezone(timeZone: string): ZoneResolution {
  const entry = TIMEZONE_COUNTRIES[timeZone];
  if (!entry) return { kind: "unknown" };
  if (typeof entry === "string") return { kind: "single", countryCode: entry };
  if (entry.length === 1) return { kind: "single", countryCode: entry[0]! };
  return { kind: "ambiguous", candidates: entry };
}

/** The device's current IANA timezone, or null where unavailable. */
export function currentTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** "UTC+7", "UTC-3:30" — from the device only, no network. */
export function utcOffsetLabel(date = new Date()): string {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}
