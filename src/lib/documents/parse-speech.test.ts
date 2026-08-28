import { describe, expect, it } from "vitest";
import { parseSpokenDocument } from "./parse-speech";

describe("parseSpokenDocument", () => {
  it("reads a type, a full expiry date and a title", () => {
    const result = parseSpokenDocument("this is my passport, expires May 5th 2028");
    expect(result.type).toBe("passport");
    expect(result.expires_on).toBe("2028-05-05");
    expect(result.title).toBe("Passport");
    expect(result.notes).toBe("this is my passport, expires May 5th 2028");
  });

  it("falls back to the last day of the month when no day was spoken", () => {
    const result = parseSpokenDocument("UK passport, expires December 2027");
    expect(result.expires_on).toBe("2027-12-31");
    expect(result.type).toBe("passport");
  });

  it("recognises insurance and onward-ticket phrasing", () => {
    expect(parseSpokenDocument("travel insurance certificate").type).toBe("insurance");
    expect(parseSpokenDocument("my onward flight confirmation").type).toBe("onward_ticket");
  });

  it("always keeps the full transcript in notes, even with no other match", () => {
    const result = parseSpokenDocument("some random unrelated sentence");
    expect(result.type).toBeNull();
    expect(result.expires_on).toBeNull();
    expect(result.notes).toBe("some random unrelated sentence");
  });
});
