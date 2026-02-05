import { describe, it, expect } from "vitest";
import { evaluateAutoExpand, defaultConfig } from "../src/utils/tickets_guard";

describe("tickets guard", () => {
  it("returns none when below threshold", async () => {
    const memvidClient: any = { tickets: { apply: async () => ({ ok: true }) } };
    const usage = { usagePercent: 50, usedBytes: 50, capacityBytes: 100 };
    const res = await evaluateAutoExpand(memvidClient, usage, defaultConfig(), { dryRun: true });
    expect(res.action).toBe("none");
  });

  it("requires manual confirm when recommended > manualConfirmBytes", async () => {
    const memvidClient: any = { tickets: { apply: async () => ({ ok: true }) } };
    const cfg = { ...defaultConfig(), manualConfirmBytes: 10 };
    const usage = { usagePercent: 90, usedBytes: 1000, capacityBytes: 100 };
    const res = await evaluateAutoExpand(memvidClient, usage, cfg, {
      dryRun: true,
      autoExpand: false,
    });
    expect(res.action).toBe("await_manual");
  });
});
