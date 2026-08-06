import { describe, expect, it } from "vitest";
import { countryCode, email, integer, isoDate, oneOf, requiredText, safeUrl } from "./validate";

describe("safeUrl — input must not become code", () => {
  it("rejects script-executing protocols", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("  javascript:alert(1)  ")).toBeNull();
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });

  it("accepts real links and assumes https for bare hosts", () => {
    expect(safeUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(safeUrl("http://example.com")).toBe("http://example.com/");
    expect(safeUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects junk and unbounded input", () => {
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
    expect(safeUrl(123)).toBeNull();
    expect(safeUrl(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("SQL-ish payloads are stored as plain text", () => {
  it("keeps injection attempts intact rather than rejecting them", () => {
    // supabase-js parameterises, so this is data. Validation must not
    // pretend to 'sanitise' SQL — that would corrupt legitimate names
    // like O'Brien while providing no security benefit.
    expect(requiredText("Robert'); DROP TABLE trips;--", "Name", 120)).toBe(
      "Robert'); DROP TABLE trips;--",
    );
    expect(requiredText("O'Brien & Sons", "Name", 120)).toBe("O'Brien & Sons");
  });
});

describe("runtime type enforcement (TS types are erased)", () => {
  it("integer rejects non-numeric and out-of-range values", () => {
    expect(() => integer("abc", "Seats", 10, 5000)).toThrow();
    expect(() => integer(undefined, "Seats", 10, 5000)).toThrow();
    expect(() => integer(5, "Seats", 10, 5000)).toThrow();
    expect(() => integer(99999, "Seats", 10, 5000)).toThrow();
    expect(integer("42", "Seats", 10, 5000)).toBe(42);
  });

  it("requiredText rejects non-strings, empties and overlong input", () => {
    expect(() => requiredText(undefined, "Name", 10)).toThrow();
    expect(() => requiredText(42, "Name", 10)).toThrow();
    expect(() => requiredText("   ", "Name", 10)).toThrow();
    expect(() => requiredText("a".repeat(11), "Name", 10)).toThrow();
  });

  it("email checks shape and lowercases", () => {
    expect(email("Foo@Example.com")).toBe("foo@example.com");
    expect(() => email("not-an-email")).toThrow();
    expect(() => email(null)).toThrow();
  });

  it("oneOf pins values to an allow-list", () => {
    expect(oneOf("stays", ["community", "stays"] as const, "Feature")).toBe("stays");
    expect(() => oneOf("admin", ["community", "stays"] as const, "Feature")).toThrow();
  });

  it("isoDate and countryCode reject malformed input", () => {
    expect(isoDate("2026-08-06", "Entry")).toBe("2026-08-06");
    expect(() => isoDate("06/08/2026", "Entry")).toThrow();
    expect(() => isoDate("2026-13-45", "Entry")).toThrow();
    expect(countryCode("vn")).toBe("VN");
    expect(() => countryCode("VNM")).toThrow();
  });
});
