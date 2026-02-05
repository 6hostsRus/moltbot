import { describe, it, expect } from "vitest";
import { compactFrames, summarizeText } from "../src/utils/capture_compaction";

describe("capture compaction (utils)", () => {
  it("summarizeText truncates long text", () => {
    const text = Array(100).fill("word").join(" ");
    const s = summarizeText(text, 10);
    expect(s.split(/\s+/).length).toBeGreaterThanOrEqual(1);
    expect(s.endsWith("...")).toBe(true);
  });

  it("compacts nearby frames in same session", () => {
    const now = Date.now();
    const frames = [
      { frameId: "f1", content: "alpha", timestamp: now - 10000, sessionId: "s1" },
      { frameId: "f2", content: "beta", timestamp: now - 5000, sessionId: "s1" },
      { frameId: "f3", content: "gamma", timestamp: now - 1000, sessionId: "s1" },
    ];

    const compacted = compactFrames(frames, { timeWindowMs: 20000 });
    expect(compacted.length).toBe(1);
    expect(compacted[0].constituents).toEqual(["f1", "f2", "f3"]);
  });

  it("does not merge frames across sessions", () => {
    const now = Date.now();
    const frames = [
      { frameId: "f1", content: "alpha", timestamp: now - 10000, sessionId: "s1" },
      { frameId: "f2", content: "beta", timestamp: now - 5000, sessionId: "s2" },
    ];

    const compacted = compactFrames(frames, { timeWindowMs: 20000 });
    expect(compacted.length).toBe(2);
  });

  it("groups distant frames separately", () => {
    const now = Date.now();
    const frames = [
      { frameId: "f1", content: "alpha", timestamp: now - 1000000, sessionId: "s1" },
      { frameId: "f2", content: "beta", timestamp: now - 5000, sessionId: "s1" },
    ];

    const compacted = compactFrames(frames, { timeWindowMs: 20000 });
    expect(compacted.length).toBe(2);
  });
});
