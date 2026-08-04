import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CITIES } from "@/lib/cities";
import { computeArbitrage, costLines, taxYearLabel, taxYearWarning } from "@/lib/arbitrage";

export default defineTool({
  name: "get_city",
  title: "Get city detail",
  description:
    "Full Driftly profile for one city: itemised costs, quality-of-life scores, visa rules, nomad visa requirements and tax residency triggers.",
  inputSchema: {
    cityId: z
      .string()
      .describe("City id (e.g. 'lisbon-pt') or a city name such as 'Lisbon'."),
    monthlyIncomeUsd: z
      .number()
      .nullable()
      .optional()
      .describe("Monthly income in USD to personalise surplus and savings rate."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ cityId, monthlyIncomeUsd }) => {
    const needle = cityId.trim().toLowerCase();
    const city =
      CITIES.find((c) => c.id.toLowerCase() === needle) ??
      CITIES.find((c) => c.city.toLowerCase() === needle) ??
      CITIES.find((c) => c.city.toLowerCase().includes(needle));
    if (!city) throw new ToolError(`No city matched "${cityId}".`);

    const arb = computeArbitrage(city, monthlyIncomeUsd ?? null);
    const payload = {
      id: city.id,
      city: city.city,
      country: city.country,
      countryCode: city.country_code,
      region: city.region,
      localCurrency: city.local_currency,
      lastVerified: city.last_verified,
      confidence: city.confidence,
      arbitrageNote: city.arbitrage_note,
      monthlyCostUsd: arb.cost,
      surplusMonthlyUsd: monthlyIncomeUsd == null ? null : arb.surplusMonthly,
      savingsRatePct: monthlyIncomeUsd == null ? null : Math.round(arb.savingsRate),
      costLines: costLines(city),
      scores: city.scores,
      visa: city.visa,
      tax: {
        ...city.tax,
        taxYearLabel: taxYearLabel(city),
        taxYearWarning: taxYearWarning(city),
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
