import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { toolResponse } from "../respond";
import { maxStayFrom, schengenStatus, type Trip } from "@/lib/schengen";
import { todayIso } from "@/lib/trip-dates";

export default defineTool({
  name: "schengen_check",
  title: "Check Schengen 90/180",
  description:
    "Run Driftly's Schengen 90/180 engine over a list of trips: days used and remaining in the rolling 180-day window, compliance status, the next date a full 90-day stay is possible, and the longest legal stay from a planned entry date.",
  inputSchema: {
    trips: z
      .array(
        z.object({
          countryCode: z.string().describe("ISO-2 country code, e.g. 'PT'."),
          entryDate: z.string().describe("Entry date, YYYY-MM-DD. The entry day counts."),
          exitDate: z
            .string()
            .nullable()
            .describe("Exit date YYYY-MM-DD, or null if still there. The exit day counts."),
          purpose: z
            .enum(["tourist", "nomad_visa", "residence"])
            .nullable()
            .describe("'residence' trips do not consume the short-stay allowance."),
        }),
      )
      .describe("All trips to consider, Schengen and non-Schengen."),
    referenceDate: z
      .string()
      .nullable()
      .optional()
      .describe("Date to evaluate against, YYYY-MM-DD. Defaults to today (UTC)."),
    plannedEntryDate: z
      .string()
      .nullable()
      .optional()
      .describe("Optional future entry date to test the longest legal consecutive stay."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ trips, referenceDate, plannedEntryDate }) => {
    const engineTrips: Trip[] = trips.map((t) => ({
      countryCode: t.countryCode.toUpperCase(),
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      ...(t.purpose ? { purpose: t.purpose } : {}),
    }));

    const refDate = referenceDate ?? todayIso();
    const status = schengenStatus(engineTrips, refDate);
    const payload = {
      referenceDate: refDate,
      daysUsed: status.used,
      daysRemaining: status.remaining,
      status: status.status,
      nextFullNinetyDayStart: status.nextFullNinety,
      maxStayFromPlannedEntry: plannedEntryDate
        ? { entryDate: plannedEntryDate, days: maxStayFrom(engineTrips, plannedEntryDate) }
        : null,
      disclaimer:
        "Estimate based on the entries provided. Always confirm with official immigration authorities.",
    };

    return {
      ...toolResponse(payload),
    };
  },
});
