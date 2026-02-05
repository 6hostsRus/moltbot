import { describe, it, expect } from "vitest";
import { compactFrames } from "../src/utils/capture_compaction";

describe("capture compaction advanced rules", () => {
  it("prefers latest SET frame as authoritative", () => {
    const now = Date.now();
    const frames = [
      {
        frameId: "f1",
        content: "state: mode=old",
        timestamp: now - 30000,
        sessionId: "s1",
        tags: ["set"],
      },
      {
        frameId: "f2",
        content: "updated status to new",
        timestamp: now - 20000,
        sessionId: "s1",
        tags: ["update"],
      },
      {
        frameId: "f3",
        content: "set mode=latest",
        timestamp: now - 10000,
        sessionId: "s1",
        tags: ["set"],
      },
    ];

    const compacted = compactFrames(frames, { timeWindowMs: 60000 });
    expect(compacted.length).toBe(1);
    // authoritativeFrame should be the latest set (f3)
    expect(compacted[0].metadata.authoritativeFrame).toBe("f3");
    // content should include f3 content
    expect(compacted[0].content).toContain("set mode=latest");
  });

  it("filters by sensitivity threshold and falls back if all filtered", () => {
    const now = Date.now();
    const frames = [
      {
        frameId: "f1",
        content: "public info",
        timestamp: now - 10000,
        sessionId: "s1",
        sensitivity: "public",
      },
      {
        frameId: "f2",
        content: "private secret",
        timestamp: now - 5000,
        sessionId: "s1",
        sensitivity: "private",
      },
    ];

    // allow only public
    const compacted = compactFrames(frames, {
      timeWindowMs: 20000,
      sensitivityThreshold: ["public"] as any,
    });
    expect(compacted.length).toBe(1);
    // includedCount should be >=1; authoritativeFrame may be null
    expect(compacted[0].metadata.includedCount).toBeGreaterThanOrEqual(1);

    // allow none -> fallback to original group (includedCount will equal originalCount)
    const compactedNone = compactFrames(frames, {
      timeWindowMs: 20000,
      sensitivityThreshold: [] as any,
    });
    expect(compactedNone.length).toBe(1);
    expect(compactedNone[0].metadata.includedCount).toBe(2);
  });
});
