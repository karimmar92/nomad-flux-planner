/**
 * MULTI-AIRPORT CITY REGISTRY
 *
 * The single non-negotiable rule of this module: a city is not an airport.
 * Bangkok is BKK *and* DMK, and a passenger who lands at one and departs from
 * the other loses an hour of taxi and a chunk of money that no flight search
 * shows them. Every airport is a separate node here, always. Nothing in the
 * planner is allowed to collapse a city to one code.
 *
 * Extending this is deliberately boring: add an entry to CITIES_WITH_AIRPORTS,
 * optionally add explicit ground-transfer facts, done. No other file changes.
 */

export type AirportKind = "main" | "secondary" | "lowcost";

export type Airport = {
  iata: string;
  name: string;
  kind: AirportKind;
  lat: number;
  lng: number;
  /** Key of the owning city. Always set — an airport never floats free. */
  cityKey: string;
  cityName: string;
  countryCode: string;
};

export type CrossAirportTransfer = {
  /** Minutes of door-to-door ground transfer between the two airports. */
  minutes: number;
  /** Realistic method a traveller would actually use, in plain words. */
  method: string;
  /** Typical one-way cost in USD. */
  costUsd: number;
};

type CityDef = {
  key: string;
  name: string;
  countryCode: string;
  /** Matching id in the seed city dataset, where one exists. Drives
   *  "Add to timeline" so the trip lands on a real Driftly city. */
  cityId?: string;
  airports: Array<{
    iata: string;
    name: string;
    kind: AirportKind;
    lat: number;
    lng: number;
  }>;
  /** Explicit, checked ground transfers keyed "AAA-BBB" (order-insensitive).
   *  Anything not listed falls back to a distance estimate. */
  transfers?: Record<string, CrossAirportTransfer>;
};

const CITY_DEFS: CityDef[] = [
  {
    key: "bangkok",
    name: "Bangkok",
    countryCode: "TH",
    cityId: "bangkok-th",
    airports: [
      { iata: "BKK", name: "Suvarnabhumi", kind: "main", lat: 13.69, lng: 100.75 },
      { iata: "DMK", name: "Don Mueang", kind: "lowcost", lat: 13.91, lng: 100.61 },
    ],
    transfers: {
      "BKK-DMK": { minutes: 90, method: "Free inter-airport shuttle or taxi, heavy traffic risk", costUsd: 18 },
    },
  },
  {
    key: "london",
    name: "London",
    countryCode: "GB",
    airports: [
      { iata: "LHR", name: "Heathrow", kind: "main", lat: 51.47, lng: -0.45 },
      { iata: "LGW", name: "Gatwick", kind: "secondary", lat: 51.15, lng: -0.19 },
      { iata: "STN", name: "Stansted", kind: "lowcost", lat: 51.89, lng: 0.24 },
      { iata: "LTN", name: "Luton", kind: "lowcost", lat: 51.87, lng: -0.37 },
    ],
    transfers: {
      "LHR-LGW": { minutes: 105, method: "National Express coach, or Tube + Gatwick Express", costUsd: 35 },
      "LHR-STN": { minutes: 135, method: "Tube to Liverpool St + Stansted Express", costUsd: 40 },
      "LHR-LTN": { minutes: 110, method: "Coach, or Tube + Thameslink from St Pancras", costUsd: 32 },
      "LGW-STN": { minutes: 150, method: "Thameslink cross-London + Stansted Express", costUsd: 45 },
      "LGW-LTN": { minutes: 120, method: "Thameslink direct (Gatwick–Luton Airport Pkwy)", costUsd: 30 },
      "STN-LTN": { minutes: 135, method: "Coach via central London", costUsd: 34 },
    },
  },
  {
    key: "tokyo",
    name: "Tokyo",
    countryCode: "JP",
    airports: [
      { iata: "HND", name: "Haneda", kind: "main", lat: 35.55, lng: 139.78 },
      { iata: "NRT", name: "Narita", kind: "main", lat: 35.77, lng: 140.39 },
    ],
    transfers: {
      "HND-NRT": { minutes: 120, method: "Keikyu + Keisei Access Express, or limousine bus", costUsd: 25 },
    },
  },
  {
    key: "osaka",
    name: "Osaka",
    countryCode: "JP",
    airports: [
      { iata: "KIX", name: "Kansai", kind: "main", lat: 34.43, lng: 135.24 },
      { iata: "ITM", name: "Itami", kind: "secondary", lat: 34.79, lng: 135.44 },
    ],
    transfers: { "KIX-ITM": { minutes: 80, method: "Airport limousine bus", costUsd: 20 } },
  },
  {
    key: "paris",
    name: "Paris",
    countryCode: "FR",
    airports: [
      { iata: "CDG", name: "Charles de Gaulle", kind: "main", lat: 49.01, lng: 2.55 },
      { iata: "ORY", name: "Orly", kind: "secondary", lat: 48.73, lng: 2.37 },
      { iata: "BVA", name: "Beauvais", kind: "lowcost", lat: 49.45, lng: 2.11 },
    ],
    transfers: {
      "CDG-ORY": { minutes: 90, method: "RER B + Orlyval, or direct Le Bus Direct coach", costUsd: 25 },
      "CDG-BVA": { minutes: 150, method: "Shuttle via Porte Maillot", costUsd: 30 },
      "ORY-BVA": { minutes: 165, method: "Cross-Paris transfer + Beauvais shuttle", costUsd: 35 },
    },
  },
  {
    key: "new-york",
    name: "New York",
    countryCode: "US",
    airports: [
      { iata: "JFK", name: "John F. Kennedy", kind: "main", lat: 40.64, lng: -73.78 },
      { iata: "EWR", name: "Newark", kind: "main", lat: 40.69, lng: -74.17 },
      { iata: "LGA", name: "LaGuardia", kind: "secondary", lat: 40.78, lng: -73.87 },
    ],
    transfers: {
      "JFK-EWR": { minutes: 120, method: "AirTrain + NJ Transit via Penn Station", costUsd: 30 },
      "JFK-LGA": { minutes: 75, method: "Q70 bus + subway, or taxi", costUsd: 45 },
      "EWR-LGA": { minutes: 110, method: "NJ Transit + subway + Q70", costUsd: 35 },
    },
  },
  {
    key: "istanbul",
    name: "Istanbul",
    countryCode: "TR",
    cityId: "istanbul-tr",
    airports: [
      { iata: "IST", name: "Istanbul Airport", kind: "main", lat: 41.26, lng: 28.74 },
      { iata: "SAW", name: "Sabiha Gökçen", kind: "lowcost", lat: 40.9, lng: 29.31 },
    ],
    transfers: {
      "IST-SAW": { minutes: 150, method: "Havaist coach across the Bosphorus — allow for traffic", costUsd: 22 },
    },
  },
  {
    key: "milan",
    name: "Milan",
    countryCode: "IT",
    airports: [
      { iata: "MXP", name: "Malpensa", kind: "main", lat: 45.63, lng: 8.72 },
      { iata: "LIN", name: "Linate", kind: "secondary", lat: 45.45, lng: 9.28 },
      { iata: "BGY", name: "Bergamo Orio al Serio", kind: "lowcost", lat: 45.67, lng: 9.7 },
    ],
    transfers: {
      "MXP-LIN": { minutes: 90, method: "Direct airport shuttle bus", costUsd: 15 },
      "MXP-BGY": { minutes: 105, method: "Coach via Milano Centrale", costUsd: 20 },
      "LIN-BGY": { minutes: 80, method: "Coach via Milano Centrale", costUsd: 15 },
    },
  },
  {
    key: "rome",
    name: "Rome",
    countryCode: "IT",
    airports: [
      { iata: "FCO", name: "Fiumicino", kind: "main", lat: 41.8, lng: 12.25 },
      { iata: "CIA", name: "Ciampino", kind: "lowcost", lat: 41.8, lng: 12.6 },
    ],
    transfers: { "FCO-CIA": { minutes: 75, method: "Direct Terravision shuttle", costUsd: 14 } },
  },
  {
    key: "moscow",
    name: "Moscow",
    countryCode: "RU",
    airports: [
      { iata: "SVO", name: "Sheremetyevo", kind: "main", lat: 55.97, lng: 37.41 },
      { iata: "DME", name: "Domodedovo", kind: "main", lat: 55.41, lng: 37.9 },
      { iata: "VKO", name: "Vnukovo", kind: "secondary", lat: 55.6, lng: 37.27 },
    ],
    transfers: {
      "SVO-DME": { minutes: 135, method: "Aeroexpress in + Aeroexpress out via central Moscow", costUsd: 25 },
      "SVO-VKO": { minutes: 120, method: "Aeroexpress via Belorussky + Kievsky", costUsd: 22 },
      "DME-VKO": { minutes: 110, method: "Aeroexpress via Paveletsky + Kievsky", costUsd: 22 },
    },
  },
  {
    key: "seoul",
    name: "Seoul",
    countryCode: "KR",
    cityId: "seoul-kr",
    airports: [
      { iata: "ICN", name: "Incheon", kind: "main", lat: 37.46, lng: 126.44 },
      { iata: "GMP", name: "Gimpo", kind: "secondary", lat: 37.56, lng: 126.8 },
    ],
    transfers: { "ICN-GMP": { minutes: 45, method: "AREX all-stop train", costUsd: 5 } },
  },
  {
    key: "taipei",
    name: "Taipei",
    countryCode: "TW",
    cityId: "taipei-tw",
    airports: [
      { iata: "TPE", name: "Taoyuan", kind: "main", lat: 25.08, lng: 121.23 },
      { iata: "TSA", name: "Songshan", kind: "secondary", lat: 25.07, lng: 121.55 },
    ],
    transfers: { "TPE-TSA": { minutes: 60, method: "Airport MRT + Wenhu line", costUsd: 6 } },
  },
  {
    key: "shanghai",
    name: "Shanghai",
    countryCode: "CN",
    cityId: "shanghai-cn",
    airports: [
      { iata: "PVG", name: "Pudong", kind: "main", lat: 31.14, lng: 121.81 },
      { iata: "SHA", name: "Hongqiao", kind: "secondary", lat: 31.2, lng: 121.34 },
    ],
    transfers: { "PVG-SHA": { minutes: 75, method: "Metro line 2 (change at Guanglan Rd) or Maglev + metro", costUsd: 4 } },
  },
  {
    key: "buenos-aires",
    name: "Buenos Aires",
    countryCode: "AR",
    cityId: "buenos-aires-ar",
    airports: [
      { iata: "EZE", name: "Ezeiza", kind: "main", lat: -34.82, lng: -58.54 },
      { iata: "AEP", name: "Aeroparque", kind: "secondary", lat: -34.56, lng: -58.42 },
    ],
    transfers: { "EZE-AEP": { minutes: 90, method: "Tienda León shuttle via downtown", costUsd: 20 } },
  },
  {
    key: "mexico-city",
    name: "Mexico City",
    countryCode: "MX",
    cityId: "mexico-city-mx",
    airports: [
      { iata: "MEX", name: "Benito Juárez", kind: "main", lat: 19.44, lng: -99.07 },
      { iata: "NLU", name: "Felipe Ángeles", kind: "secondary", lat: 19.76, lng: -99.02 },
    ],
    transfers: { "MEX-NLU": { minutes: 105, method: "Direct inter-airport coach", costUsd: 18 } },
  },
  {
    key: "dubai",
    name: "Dubai",
    countryCode: "AE",
    cityId: "dubai-ae",
    airports: [
      { iata: "DXB", name: "Dubai International", kind: "main", lat: 25.25, lng: 55.36 },
      { iata: "DWC", name: "Al Maktoum", kind: "lowcost", lat: 24.9, lng: 55.16 },
    ],
    transfers: { "DXB-DWC": { minutes: 70, method: "Taxi via Sheikh Zayed Rd", costUsd: 35 } },
  },
  {
    key: "warsaw",
    name: "Warsaw",
    countryCode: "PL",
    cityId: "warsaw-pl",
    airports: [
      { iata: "WAW", name: "Chopin", kind: "main", lat: 52.17, lng: 20.97 },
      { iata: "WMI", name: "Modlin", kind: "lowcost", lat: 52.45, lng: 20.65 },
    ],
    transfers: { "WAW-WMI": { minutes: 100, method: "Train via Warszawa Centralna + Modlin bus", costUsd: 12 } },
  },
  {
    key: "chengdu",
    name: "Chengdu",
    countryCode: "CN",
    cityId: "chengdu-cn",
    airports: [
      { iata: "TFU", name: "Tianfu", kind: "main", lat: 30.31, lng: 104.44 },
      { iata: "CTU", name: "Shuangliu", kind: "secondary", lat: 30.58, lng: 103.95 },
    ],
    transfers: { "TFU-CTU": { minutes: 80, method: "Metro line 18 + line 10", costUsd: 4 } },
  },
  // ---- single-airport cities -------------------------------------------
  single("lisbon", "Lisbon", "PT", "lisbon-pt", "LIS", "Humberto Delgado", 38.77, -9.13),
  single("chiang-mai", "Chiang Mai", "TH", "chiang-mai-th", "CNX", "Chiang Mai Intl", 18.77, 98.96),
  single("medellin", "Medellín", "CO", "medellin-co", "MDE", "José María Córdova", 6.16, -75.42),
  single("bali", "Canggu / Bali", "ID", "bali-id", "DPS", "Ngurah Rai", -8.75, 115.17),
  single("tbilisi", "Tbilisi", "GE", "tbilisi-ge", "TBS", "Tbilisi Intl", 41.67, 44.95),
  single("budapest", "Budapest", "HU", "budapest-hu", "BUD", "Ferenc Liszt", 47.44, 19.26),
  single("belgrade", "Belgrade", "RS", "belgrade-rs", "BEG", "Nikola Tesla", 44.82, 20.29),
  single("prague", "Prague", "CZ", "prague-cz", "PRG", "Václav Havel", 50.1, 14.26),
  single("las-palmas", "Las Palmas", "ES", "las-palmas-es", "LPA", "Gran Canaria", 27.93, -15.39),
  single("athens", "Athens", "GR", "athens-gr", "ATH", "Eleftherios Venizelos", 37.94, 23.95),
  single("tallinn", "Tallinn", "EE", "tallinn-ee", "TLL", "Lennart Meri", 59.41, 24.83),
  single("kuala-lumpur", "Kuala Lumpur", "MY", "kuala-lumpur-my", "KUL", "KLIA", 2.75, 101.71),
  single("ho-chi-minh", "Ho Chi Minh City", "VN", "ho-chi-minh-vn", "SGN", "Tan Son Nhat", 10.82, 106.66),
  single("cape-town", "Cape Town", "ZA", "cape-town-za", "CPT", "Cape Town Intl", -33.97, 18.6),
  single("mauritius", "Mauritius", "MU", "mauritius-mu", "MRU", "Sir S. Ramgoolam", -20.43, 57.68),
  single("tirana", "Tirana", "AL", "tirana-al", "TIA", "Nënë Tereza", 41.41, 19.72),
  single("playa-del-carmen", "Playa del Carmen", "MX", "playa-del-carmen-mx", "CUN", "Cancún Intl", 21.04, -86.87),
  single("kunming", "Kunming", "CN", "kunming-cn", "KMG", "Changshui", 25.1, 102.93),
  single("dali", "Dali", "CN", "dali-cn", "DLU", "Dali Fengyi", 25.65, 100.32),
  single("shenzhen", "Shenzhen", "CN", "shenzhen-cn", "SZX", "Bao'an", 22.64, 113.81),
  single("singapore", "Singapore", "SG", undefined, "SIN", "Changi", 1.36, 103.99),
  single("hong-kong", "Hong Kong", "HK", undefined, "HKG", "Hong Kong Intl", 22.31, 113.91),
  single("barcelona", "Barcelona", "ES", undefined, "BCN", "El Prat", 41.3, 2.08),
  single("madrid", "Madrid", "ES", undefined, "MAD", "Barajas", 40.47, -3.56),
  single("berlin", "Berlin", "DE", undefined, "BER", "Brandenburg", 52.36, 13.5),
  single("amsterdam", "Amsterdam", "NL", undefined, "AMS", "Schiphol", 52.31, 4.76),
  single("vienna", "Vienna", "AT", undefined, "VIE", "Schwechat", 48.11, 16.57),
  single("zagreb", "Zagreb", "HR", undefined, "ZAG", "Franjo Tuđman", 45.74, 16.07),
  single("sofia", "Sofia", "BG", undefined, "SOF", "Sofia Airport", 42.69, 23.41),
  single("bucharest", "Bucharest", "RO", undefined, "OTP", "Henri Coandă", 44.57, 26.09),
  single("phuket", "Phuket", "TH", undefined, "HKT", "Phuket Intl", 8.11, 98.31),
  single("hanoi", "Hanoi", "VN", undefined, "HAN", "Noi Bai", 21.22, 105.81),
  single("da-nang", "Da Nang", "VN", undefined, "DAD", "Da Nang Intl", 16.04, 108.2),
  single("penang", "Penang", "MY", undefined, "PEN", "Penang Intl", 5.3, 100.28),
  single("manila", "Manila", "PH", undefined, "MNL", "Ninoy Aquino", 14.51, 121.02),
  single("colombo", "Colombo", "LK", undefined, "CMB", "Bandaranaike", 7.18, 79.88),
  single("dubai-free", "Abu Dhabi", "AE", undefined, "AUH", "Zayed Intl", 24.44, 54.65),
  single("cairo", "Cairo", "EG", undefined, "CAI", "Cairo Intl", 30.11, 31.4),
  single("nairobi", "Nairobi", "KE", undefined, "NBO", "Jomo Kenyatta", -1.32, 36.93),
  single("bogota", "Bogotá", "CO", undefined, "BOG", "El Dorado", 4.7, -74.15),
  single("lima", "Lima", "PE", undefined, "LIM", "Jorge Chávez", -12.02, -77.11),
  single("santiago", "Santiago", "CL", undefined, "SCL", "Arturo Merino Benítez", -33.39, -70.79),
  single("sao-paulo", "São Paulo", "BR", undefined, "GRU", "Guarulhos", -23.43, -46.47),
  single("tokyo-alt", "Fukuoka", "JP", undefined, "FUK", "Fukuoka Airport", 33.59, 130.45),
];

function single(
  key: string,
  name: string,
  countryCode: string,
  cityId: string | undefined,
  iata: string,
  airportName: string,
  lat: number,
  lng: number,
): CityDef {
  return {
    key,
    name,
    countryCode,
    ...(cityId ? { cityId } : {}),
    airports: [{ iata, name: airportName, kind: "main", lat, lng }],
  };
}

export type HopCity = {
  key: string;
  name: string;
  countryCode: string;
  cityId?: string;
  airports: Airport[];
  transfers: Record<string, CrossAirportTransfer>;
};

export const HOP_CITIES: HopCity[] = CITY_DEFS.map((def) => ({
  key: def.key,
  name: def.name,
  countryCode: def.countryCode,
  ...(def.cityId ? { cityId: def.cityId } : {}),
  transfers: def.transfers ?? {},
  airports: def.airports.map((a) => ({
    ...a,
    cityKey: def.key,
    cityName: def.name,
    countryCode: def.countryCode,
  })),
})).sort((a, b) => a.name.localeCompare(b.name));

export const AIRPORTS: Airport[] = HOP_CITIES.flatMap((c) => c.airports);

const CITY_BY_KEY = new Map(HOP_CITIES.map((c) => [c.key, c]));
const AIRPORT_BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

export function getHopCity(key: string): HopCity | undefined {
  return CITY_BY_KEY.get(key);
}

export function getAirport(iata: string): Airport | undefined {
  return AIRPORT_BY_IATA.get(iata);
}

export function isMultiAirportCity(key: string): boolean {
  return (CITY_BY_KEY.get(key)?.airports.length ?? 0) > 1;
}

/** Great-circle distance in km. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Ground transfer between two airports of the SAME city.
 *
 * Explicit facts win. Where we have none we estimate rather than pretend the
 * change is free — an unknown airport change is still an airport change, and
 * silently costing it at zero is exactly the failure this module exists to
 * prevent.
 */
export function crossAirportTransfer(fromIata: string, toIata: string): CrossAirportTransfer | null {
  if (fromIata === toIata) return null;
  const from = AIRPORT_BY_IATA.get(fromIata);
  const to = AIRPORT_BY_IATA.get(toIata);
  if (!from || !to || from.cityKey !== to.cityKey) return null;
  const city = CITY_BY_KEY.get(from.cityKey);
  const explicit =
    city?.transfers[`${fromIata}-${toIata}`] ?? city?.transfers[`${toIata}-${fromIata}`];
  if (explicit) return explicit;
  const km = distanceKm(from, to);
  return {
    minutes: Math.round(35 + km * 1.6),
    method: "Ground transfer across the city — check local options before booking",
    costUsd: Math.round(12 + km * 0.8),
  };
}
