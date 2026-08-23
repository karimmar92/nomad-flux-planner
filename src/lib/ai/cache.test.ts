/**
 * The LLM cache, with most of the weight on the way it could leak.
 *
 * A cost optimisation that serves one user's personalised tax answer to another
 * user is not a saving, it is an incident. So the key tests are not "does it
 * cache" but "does it refuse to share an answer across users, models, prompt
 * versions and changed data".
 */
import { describe, expect, it } from "vitest";
import { AiCache, cacheKey, cached, normalizeQuestion, type CacheScope } from "./cache";

const scope = (over: Partial<CacheScope> = {}): CacheScope => ({
  model: "model-a",
  promptVersion: "v1",
  subject: "user-1",
  dataVersion: "trips:3@2026-08-01",
  ...over,
});

describe("normalizeQuestion", () => {
  it("treats case and spacing as the same question", () => {
    expect(normalizeQuestion("How Many Days   Left?")).toBe(
      normalizeQuestion("how many days left"),
    );
  });

  it("ignores trailing punctuation and surrounding whitespace", () => {
    expect(normalizeQuestion("  am I tax resident??  ")).toBe("am i tax resident");
  });

  it("collapses newlines from a textarea", () => {
    expect(normalizeQuestion("how many\n\ndays left")).toBe("how many days left");
  });

  it("keeps genuinely different questions apart", () => {
    expect(normalizeQuestion("days left in portugal")).not.toBe(
      normalizeQuestion("days left in spain"),
    );
  });
});

describe("cacheKey isolation — the leak-prevention properties", () => {
  const q = "am I tax resident in Portugal";

  it("gives different users different keys", () => {
    // THE ONE THAT MATTERS. Same question, different person, different answer.
    expect(cacheKey(q, scope({ subject: "user-1" }))).not.toBe(
      cacheKey(q, scope({ subject: "user-2" })),
    );
  });

  it("does not let an anonymous answer be reused for a known user", () => {
    expect(cacheKey(q, scope({ subject: null }))).not.toBe(
      cacheKey(q, scope({ subject: "user-1" })),
    );
  });

  it("separates models", () => {
    expect(cacheKey(q, scope({ model: "model-a" }))).not.toBe(
      cacheKey(q, scope({ model: "model-b" })),
    );
  });

  it("separates prompt versions, so a prompt change invalidates everything", () => {
    expect(cacheKey(q, scope({ promptVersion: "v1" }))).not.toBe(
      cacheKey(q, scope({ promptVersion: "v2" })),
    );
  });

  it("separates data versions, so changed trips do not reuse an old answer", () => {
    expect(cacheKey(q, scope({ dataVersion: "trips:3@2026-08-01" }))).not.toBe(
      cacheKey(q, scope({ dataVersion: "trips:4@2026-08-02" })),
    );
  });

  it("is stable for identical inputs", () => {
    expect(cacheKey(q, scope())).toBe(cacheKey(q, scope()));
  });

  it("shares a key across trivial rewordings of the same question", () => {
    // This is where the saving comes from.
    expect(cacheKey("How many days left?", scope())).toBe(
      cacheKey("  how many days left  ", scope()),
    );
  });

  it("cannot be confused by field boundaries", () => {
    // ("ab","c") must not collide with ("a","bc").
    expect(cacheKey("q", scope({ model: "ab", promptVersion: "c" }))).not.toBe(
      cacheKey("q", scope({ model: "a", promptVersion: "bc" })),
    );
  });
});

describe("AiCache bounds and expiry", () => {
  it("returns what was stored", () => {
    const c = new AiCache<string>();
    c.set("k", "v");
    expect(c.get("k")).toBe("v");
  });

  it("misses on an unknown key", () => {
    expect(new AiCache<string>().get("nope")).toBeUndefined();
  });

  it("never grows past maxEntries", () => {
    const c = new AiCache<number>({ maxEntries: 3 });
    for (let i = 0; i < 50; i++) c.set(`k${i}`, i);
    expect(c.size).toBe(3);
    expect(c.evictions).toBe(47);
  });

  it("evicts least-recently-USED, not least-recently-added", () => {
    const c = new AiCache<number>({ maxEntries: 3 });
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.get("a"); // 'a' is now the most recent, so 'b' is the eviction candidate.
    c.set("d", 4);
    expect(c.get("a")).toBe(1);
    expect(c.get("b")).toBeUndefined();
  });

  it("expires entries after the TTL", () => {
    let t = 1000;
    const c = new AiCache<string>({ ttlMs: 100, now: () => t });
    c.set("k", "v");
    t = 1050;
    expect(c.get("k")).toBe("v");
    t = 1101;
    expect(c.get("k")).toBeUndefined();
    expect(c.expirations).toBe(1);
  });

  it("counts hits and misses so the hit rate is measurable", () => {
    const c = new AiCache<string>();
    expect(c.hitRate()).toBeNull();
    c.set("k", "v");
    c.get("k");
    c.get("absent");
    expect(c.hits).toBe(1);
    expect(c.misses).toBe(1);
    expect(c.hitRate()).toBe(0.5);
  });
});

describe("cached()", () => {
  it("calls the producer once for repeated identical questions", async () => {
    const c = new AiCache<string>();
    let calls = 0;
    const produce = async () => {
      calls++;
      return "answer";
    };

    const first = await cached(c, "How many days left?", scope(), produce);
    const second = await cached(c, "how many days left", scope(), produce);

    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.value).toBe("answer");
    // The whole point: one paid call, two answers.
    expect(calls).toBe(1);
  });

  it("calls the producer again for a different user", async () => {
    const c = new AiCache<string>();
    let calls = 0;
    const produce = async () => {
      calls++;
      return `answer-${calls}`;
    };

    await cached(c, "same question", scope({ subject: "user-1" }), produce);
    const other = await cached(c, "same question", scope({ subject: "user-2" }), produce);

    expect(other.hit).toBe(false);
    expect(calls).toBe(2);
  });

  it("does not cache a failure", async () => {
    // A transient API error must not be served as the answer for an hour.
    const c = new AiCache<string>();
    let calls = 0;
    const failing = async () => {
      calls++;
      throw new Error("upstream 503");
    };

    await expect(cached(c, "q", scope(), failing)).rejects.toThrow("upstream 503");
    await expect(cached(c, "q", scope(), failing)).rejects.toThrow("upstream 503");
    expect(calls).toBe(2);
    expect(c.size).toBe(0);
  });
});
