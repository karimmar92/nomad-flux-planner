/**
 * Deep links for a leg the traveller has already decided to fly.
 *
 * Plain search URLs, no affiliate tags: this planner ranks routes, and a
 * ranking that earns money on one outcome is not a ranking. See
 * PARTNER_FREE_ZONES in src/config/partners.ts.
 */
import type { Leg } from "./types";

export type LegLink = { label: string; url: string };

export function legLinks(leg: Leg): LegLink[] {
  const { from, to, offer } = leg;
  const d = offer.dateISO;
  return [
    {
      label: "Google Flights",
      url: `https://www.google.com/travel/flights?q=${encodeURIComponent(
        `Flights from ${from.iata} to ${to.iata} on ${d} one way`,
      )}`,
    },
    { label: "Kiwi", url: `https://www.kiwi.com/en/search/results/${from.iata}/${to.iata}/${d}` },
    {
      label: "Skyscanner",
      url: `https://www.skyscanner.net/transport/flights/${from.iata.toLowerCase()}/${to.iata.toLowerCase()}/${d.slice(2, 4)}${d.slice(5, 7)}${d.slice(8, 10)}/`,
    },
  ];
}
