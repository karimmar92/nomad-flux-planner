import { describe, expect, it } from "vitest";
import { evaluate, type FormationAnswers } from "./eligibility";
import { DISQUALIFYING_OUTCOMES } from "@/config/partners";

/**
 * The point of this suite is the negative case. If a change ever makes a
 * CFC-country resident see a formation partner, these tests fail — that is the
 * regression that matters, not the happy path.
 */

const base: FormationAnswers = {
  citizenship: "DE",
  taxResidency: "GE",
  formallyExited: true,
  clients: ["other"],
  revenueBand: "75k_150k",
  usClients: false,
  usPresence: false,
};

const a = (over: Partial<FormationAnswers>): FormationAnswers => ({ ...base, ...over });

describe("formation eligibility", () => {
  it("tells a UK tax resident an LLC will likely be looked through, with no link", () => {
    const v = evaluate(a({ citizenship: "GB", taxResidency: "GB" }));
    expect(v.kind).toBe("cfc_lookthrough");
    expect(v.showPartners).toBe(false);
    expect(v.headline).toContain("United Kingdom");
  });

  it.each(["GB", "DE", "AU", "ES", "FR", "IT", "ZA", "CA", "PT", "IN"])(
    "shows no formation partner for a %s tax resident",
    (code) => {
      expect(evaluate(a({ taxResidency: code })).showPartners).toBe(false);
    },
  );

  it("shows partners for a Georgian tax resident with no US presence", () => {
    const v = evaluate(a({ taxResidency: "GE" }));
    expect(v.kind).toBe("territorial");
    expect(v.showPartners).toBe(true);
    expect(v.showObligations).toBe(true);
  });

  it("names Form 5472 and the penalty on the qualifying outcome", () => {
    const v = evaluate(a({ taxResidency: "PA" }));
    const text = v.summary + v.sections.map((s) => s.body).join(" ");
    expect(text).toContain("5472");
    expect(text).toContain("$25,000");
  });

  it("refuses to qualify someone with no settled residency, and offers Georgia", () => {
    const v = evaluate(a({ taxResidency: "none", formallyExited: false }));
    expect(v.kind).toBe("no_residency");
    expect(v.showPartners).toBe(false);
    expect(v.showGeorgiaAlternative).toBe(true);
  });

  it("treats 'unsure' the same as no residency", () => {
    expect(evaluate(a({ taxResidency: "unsure" })).kind).toBe("no_residency");
  });

  it("blocks US citizens regardless of where they live", () => {
    const v = evaluate(a({ citizenship: "US", taxResidency: "GE" }));
    expect(v.kind).toBe("us_person");
    expect(v.showPartners).toBe(false);
  });

  it("US physical presence overrides an otherwise qualifying answer", () => {
    const v = evaluate(a({ taxResidency: "GE", usPresence: true }));
    expect(v.kind).toBe("us_presence");
    expect(v.showPartners).toBe(false);
  });

  it("does not guess for a country with no documented rule", () => {
    const v = evaluate(a({ taxResidency: "XX" }));
    expect(v.kind).toBe("unclear");
    expect(v.showPartners).toBe(false);
  });

  it("every disqualifying outcome listed in the partner config really hides links", () => {
    const cases: Array<[string, Partial<FormationAnswers>]> = [
      ["cfc_lookthrough", { taxResidency: "GB" }],
      ["no_residency", { taxResidency: "none" }],
      ["us_person", { citizenship: "US" }],
      ["us_presence", { taxResidency: "GE", usPresence: true }],
      ["unclear", { taxResidency: "ZZ" }],
    ];
    for (const [kind, over] of cases) {
      const v = evaluate(a(over));
      expect(v.kind).toBe(kind);
      expect(DISQUALIFYING_OUTCOMES).toContain(v.kind);
      expect(v.showPartners).toBe(false);
      expect(v.noPartnersReason).toBeTruthy();
    }
  });

  it("never states a projected saving anywhere in a verdict", () => {
    for (const residency of ["GB", "GE", "none", "PA", "DE"]) {
      const v = evaluate(a({ taxResidency: residency }));
      const text = [v.headline, v.summary, ...v.reasons, ...v.sections.map((s) => s.body)].join(" ");
      expect(text).not.toMatch(/you (should|must) form/i);
      expect(text).not.toMatch(/save (you )?\$?\d/i);
      expect(text).not.toMatch(/\bwe recommend\b/i);
    }
  });

  it("always carries the adviser line", () => {
    for (const residency of ["GB", "GE", "none", "XX"]) {
      expect(evaluate(a({ taxResidency: residency })).adviserLine).toContain(
        "qualified adviser",
      );
    }
  });
});
