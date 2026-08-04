import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CITIES } from "@/lib/cities";
import { computeArbitrage, monthlyCost, isSchengenCity } from "@/lib/arbitrage";

export default defineTool({
  name: "list_cities",
  title: "List cities",
  description:
    "List Driftly's cities with monthly cost of living, and — when a monthly income is given — the surplus and savings rate you'd have there. Supports region, budget and visa filters.",
  inputSchema: {
    monthlyIncomeUsd: z
      .number()
      .nullable()
      .optional()
      .describe("Your monthly income in USD, used to compute surplus and savings rate."),
    region: z.string().optional().describe("Filter by region, e.g. 'Europe' or 'Asia'."),
    maxMonthlyCostUsd: z.number().optional().describe("Only cities at or under this monthly cost."),
    nomadVisaOnly: z.boolean().optional().describe("Only cities with a digital nomad visa."),
    excludeSchengen: z
      .boolean()
      .optional()
      .describe("Exclude cities that burn the shared Schengen 90/180 allowance."),
    limit: z.number().optional().describe("Maximum number of cities to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ monthlyIncomeUsd, region, maxMonthlyCostUsd, nomadVisaOnly, excludeSchengen, limit }) => {
    const income = monthlyIncomeUsd ?? null;
    const rows = CITIES.filter((city) => {
      if (region && city.region.toLowerCase() !== region.toLowerCase()) return false;
      if (maxMonthlyCostUsd != null && monthlyCost(city) > maxMonthlyCostUsd) return false;
      if (nomadVisaOnly && !city.visa.nomadVisa.exists) return false;
      if (excludeSchengen && isSchengenCity(city)) return false;
      return true;
    })
      .map((city) => {
        const arb = computeArbitrage(city, income);
        return {
          id: city.id,
          city: city.city,
          country: city.country,
          region: city.region,
          monthlyCostUsd: arb.cost,
          surplusMonthlyUsd: income == null ? null : arb.surplusMonthly,
          savingsRatePct: income == null ? null : Math.round(arb.savingsRate),
          touristDays: city.visa.touristDays,
          schengen: isSchengenCity(city),
          nomadVisa: city.visa.nomadVisa.exists,
        };
      })
      .sort((a, b) =>
        income == null
          ? a.monthlyCostUsd - b.monthlyCostUsd
          : (b.surplusMonthlyUsd ?? 0) - (a.surplusMonthlyUsd ?? 0),
      )
      .slice(0, Math.max(1, Math.min(limit ?? 25, 100)));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, cities: rows },
    };
  },
});
