import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enqueueRetry, runDueJobs, listJobs } from "../src/utils/scheduler";

const STATE =
  process.env.MEMVID_SCHEDULER_STATE ||
  join(process.env.HOME || "/tmp", ".openclaw", "memvid-scheduler.json");

describe("scheduler integration", () => {
  beforeEach(() => {
    try {
      if (existsSync(STATE)) unlinkSync(STATE);
    } catch (e) {}
  });
  afterEach(() => {
    try {
      if (existsSync(STATE)) unlinkSync(STATE);
    } catch (e) {}
  });

  it("completes job when memvidClient expands successfully", async () => {
    const memvidClient: any = {
      checkCapacity: async (path: string) => ({
        capacityBytes: 1000,
        currentBytes: 900,
        usagePercent: 90,
        shouldExpand: true,
      }),
      tickets: { apply: async (opts: any) => ({ ok: true }) },
      expandCapacity: async (path: string, bytes: number) => ({ ok: true }),
    };

    enqueueRetry("/tmp/test.mv2", 12345, {});
    await runDueJobs(memvidClient, {});

    const jobs = listJobs();
    // job should be removed on success
    expect(jobs.length).toBe(0);
  });
});
