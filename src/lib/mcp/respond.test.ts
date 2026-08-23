/**
 * MCP wire format. The property that matters is that changing the text mode
 * never changes the DATA — only how many bytes it costs to send it.
 *
 * That invariant is what makes it safe to switch to "omit" later and take the
 * remaining 43% saving, once you have tested against the MCP clients you care
 * about. Without it, an egress optimisation would be a silent API change.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_MODE, responseBytes, toolResponse, type McpPayload } from "./respond";

/** Roughly the shape and size of a 25-row list_cities response. */
function sampleRows(n = 25): McpPayload {
  const cities = Array.from({ length: n }, (_, i) => ({
    id: `city-${i}`,
    city: `City ${i}`,
    country: "Portugal",
    region: "Europe",
    monthlyCostUsd: 1200 + i,
    surplusMonthlyUsd: 2800 - i,
    savingsRatePct: 60 + (i % 20),
    touristDays: 90,
    schengen: true,
    nomadVisa: false,
  }));
  return { count: cities.length, cities };
}

describe("toolResponse", () => {
  it("always exposes structuredContent, whatever the text mode", () => {
    // The load-bearing invariant. A client reading structuredContent must be
    // unaffected by an egress optimisation.
    const payload = sampleRows(3);
    for (const mode of ["compact", "pretty", "omit"] as const) {
      expect(toolResponse(payload, mode).structuredContent).toEqual(payload);
    }
  });

  it("carries identical data in the text block, whatever the formatting", () => {
    const payload = sampleRows(3);
    const compact = toolResponse(payload, "compact").content[0]!.text;
    const pretty = toolResponse(payload, "pretty").content[0]!.text;
    // Same object, different whitespace. Nothing is lost by compacting.
    expect(JSON.parse(compact)).toEqual(JSON.parse(pretty));
    expect(JSON.parse(compact)).toEqual(payload);
  });

  it("omits the text block entirely in omit mode", () => {
    expect(toolResponse(sampleRows(3), "omit").content).toEqual([]);
  });

  it("defaults to compact, not pretty", () => {
    // The default is the whole point of the change; pin it so a later edit
    // cannot quietly reintroduce indentation.
    expect(DEFAULT_TEXT_MODE).toBe("compact");
    const d = toolResponse(sampleRows(3));
    expect(d.content[0]!.text).toBe(JSON.stringify(sampleRows(3)));
    expect(d.content[0]!.text).not.toContain("\n");
  });
});

describe("the saving is real and measured, not assumed", () => {
  const payload = sampleRows(25);
  const pretty = responseBytes(toolResponse(payload, "pretty"));
  const compact = responseBytes(toolResponse(payload, "compact"));
  const omit = responseBytes(toolResponse(payload, "omit"));

  it("compact is meaningfully smaller than pretty", () => {
    expect(compact).toBeLessThan(pretty);
    // Indentation was costing well over 10% of the whole response.
    const saved = (pretty - compact) / pretty;
    expect(saved).toBeGreaterThan(0.1);
  });

  it("omit is smaller again, which is the remaining opportunity", () => {
    expect(omit).toBeLessThan(compact);
    // Roughly halves the response, because the payload stops being duplicated.
    expect((compact - omit) / compact).toBeGreaterThan(0.4);
  });

  it("ordering holds: omit < compact < pretty", () => {
    expect(omit).toBeLessThan(compact);
    expect(compact).toBeLessThan(pretty);
  });

  it("reports the numbers so a reader does not have to trust a comment", () => {
    // Not an assertion so much as documentation that stays true: if the shape
    // changes, these bounds fail and the comment gets revisited.
    expect(pretty).toBeGreaterThan(compact);
    expect(responseBytes(toolResponse({ a: 1 }, "compact"))).toBeLessThan(100);
  });
});

describe("edge cases", () => {
  it("handles an empty payload", () => {
    const r = toolResponse({});
    expect(r.structuredContent).toEqual({});
    expect(r.content[0]!.text).toBe("{}");
  });

  it("handles nested structures without losing them", () => {
    const nested: McpPayload = { a: { b: { c: [1, 2, { d: true }] } }, n: null };
    expect(JSON.parse(toolResponse(nested).content[0]!.text)).toEqual(nested);
    expect(toolResponse(nested).structuredContent).toEqual(nested);
  });
});
