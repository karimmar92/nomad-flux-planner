import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { toolResponse } from "../respond";
import { CITIES } from "@/lib/cities";
import { computeArbitrage, monthsToTarget, isSchengenCity } from "@/lib/arbitrage";

export default defineTool({
  name: "compare_cities",
  title: "Compare cities",
  description:
    "Side-by-side geo-arbitrage comparison of two or more Driftly cities for a given monthly income, including annual surplus and months needed to reach a savings target.",
  inputSchema: {
    cityIds: z.array(z.string()).describe("Two or more city ids or names."),
    monthlyIncomeUsd: z.number().describe("Monthly income in USD."),
    savingsTargetUsd: z
      .number()
      .nullable()
      .optional()
      .describe("Optional savings target to compute months-to-target per city."),
    tier: z
      .enum(["lean", "mid"])
      .nullable()
      .optional()
      .describe("Cost basis: 'lean' or 'mid' (default)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ cityIds, monthlyIncomeUsd, savingsTargetUsd, tier }) => {
    const resolved = cityIds.map((raw) => {
      const needle = raw.trim().toLowerCase();
      const city =
        CITIES.find((c) => c.id.toLowerCase() === needle) ??
        CITIES.find((c) => c.city.toLowerCase() === needle) ??
        CITIES.find((c) => c.city.toLowerCase().includes(needle));
      if (!city) throw new ToolError(`No city matched "${raw}".`);
      return city;
    });

    const rows = resolved.map((city) => {
      const arb = computeArbitrage(city, monthlyIncomeUsd, tier ?? "mid");
      return {
        id: city.id,
        city: city.city,
        country: city.country,
        monthlyCostUsd: arb.cost,
        surplusMonthlyUsd: arb.surplusMonthly,
        surplusAnnualUsd: arb.surplusAnnual,
        savingsRatePct: Math.round(arb.savingsRate),
        touristDays: city.visa.touristDays,
        schengen: isSchengenCity(city),
        taxResidencyTriggerDays: city.tax.residencyTriggerDays,
        monthsToTarget:
          savingsTargetUsd != null ? monthsToTarget(arb.surplusMonthly, savingsTargetUsd) : null,
      };
    });

    const best = [...rows].sort((a, b) => b.surplusMonthlyUsd - a.surplusMonthlyUsd)[0];
    const payload = {
      monthlyIncomeUsd,
      tier: tier ?? "mid",
      best: best?.city ?? null,
      cities: rows,
    };

    return {
      ...toolResponse(payload),
    };
  },
});
