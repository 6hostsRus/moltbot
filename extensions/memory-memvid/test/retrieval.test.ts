import { describe, it, expect } from "vitest";
import { filterResults, composePrependContext } from "../src/utils/retrieval";

describe("retrieval (utils)", () => {
  it("filters by recency", () => {
    const now = Date.now();
    const results = [
      { content: "a", metadata: { timestamp: now - 1000 } },
      { content: "b", metadata: { timestamp: now - 1000 * 60 * 60 * 24 * 40 } },
    ];
    const filtered = filterResults(results as any, { recencyMs: 1000 * 60 * 60 * 24 * 30 });
    expect(filtered.length).toBe(1);
  });

  it("composes prepend context with token budget", () => {
    const results = [
      { content: "one two three", metadata: { uri: "u1", frameIndex: 1 }, frameId: "f1" },
      { content: "four five six", metadata: { uri: "u2", frameIndex: 2 }, frameId: "f2" },
    ];
    const composed = composePrependContext(results as any, { limit: 5, tokenBudget: 5 });
    expect(composed.decisions.length).toBeGreaterThan(0);
  });
});
