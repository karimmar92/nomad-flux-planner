import { describe, expect, it } from "vitest";
import { PHRASEBOOKS, phrasebookFor } from "./data";
import {
  SITUATIONS,
  situationsWithContent,
  usablePhrases,
  verificationOf,
} from "./types";

describe("verification honesty — the feature's whole argument", () => {
  it("a locale is verified only when a named person and a date are recorded", () => {
    for (const locale of PHRASEBOOKS) {
      const status = verificationOf(locale);
      if (status === "verified") {
        expect(locale.verifiedBy, locale.country).toBeTruthy();
        expect(locale.verifiedOn, locale.country).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        // Half-filled verification is the dangerous state: it reads as checked
        // to a careless reader while nobody actually checked it.
        expect(Boolean(locale.verifiedBy) && Boolean(locale.verifiedOn)).toBe(false);
      }
    }
  });

  it("everything currently ships as UNVERIFIED, pending native-speaker review", () => {
    // This test is expected to be updated — deliberately — at the moment a real
    // person signs off a locale. It exists so that flipping the claim is a
    // conscious act rather than a stray commit.
    for (const locale of PHRASEBOOKS) {
      expect(verificationOf(locale), `${locale.country} claims verification`).toBe("unverified");
    }
  });
});

describe("dataset integrity", () => {
  it("has no duplicate phrase ids across locales", () => {
    const ids = PHRASEBOOKS.flatMap((l) => l.phrases.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every phrase has English source text and a known situation", () => {
    const known = new Set(SITUATIONS.map((s) => s.id));
    for (const locale of PHRASEBOOKS) {
      for (const p of locale.phrases) {
        expect(p.en.trim().length, p.id).toBeGreaterThan(0);
        expect(known.has(p.situation), `${p.id} has unknown situation`).toBe(true);
      }
    }
  });

  it("hides phrases with no translation rather than showing an empty line", () => {
    const withHole = {
      ...PHRASEBOOKS[0]!,
      phrases: [
        { id: "x", situation: "immigration" as const, en: "Untranslated", target: "" },
        { id: "y", situation: "immigration" as const, en: "Fine", target: "Xin chào" },
      ],
    };
    expect(usablePhrases(withHole)).toHaveLength(1);
    expect(usablePhrases(withHole)[0]!.id).toBe("y");
  });

  it("only offers situations that actually have content", () => {
    for (const locale of PHRASEBOOKS) {
      const offered = situationsWithContent(locale).map((s) => s.id);
      for (const id of offered) {
        expect(usablePhrases(locale, id).length, `${locale.country}/${id}`).toBeGreaterThan(0);
      }
    }
  });

  it("carries a speech language tag for every locale", () => {
    for (const locale of PHRASEBOOKS) {
      expect(locale.bcp47, locale.country).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it("covers the situations where being wrong is expensive", () => {
    // Immigration and emergency are the two that justify the feature existing.
    for (const locale of PHRASEBOOKS) {
      const ids = new Set(usablePhrases(locale).map((p) => p.situation));
      expect(ids.has("immigration"), `${locale.country} lacks immigration phrases`).toBe(true);
      expect(ids.has("emergency") || ids.has("police"), locale.country).toBe(true);
    }
  });

  it("looks up by country code, case-insensitively", () => {
    expect(phrasebookFor("vn")?.country).toBe("Vietnam");
    expect(phrasebookFor("PT")?.country).toBe("Portugal");
    expect(phrasebookFor("XX")).toBeUndefined();
  });
});
