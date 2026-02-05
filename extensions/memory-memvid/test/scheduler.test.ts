import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enqueueRetry, runDueJobs, listJobs } from "../src/utils/scheduler";

const STATE =
  process.env.MEMVID_SCHEDULER_STATE ||
  join(process.env.HOME || "/tmp", ".openclaw", "memvid-scheduler.json");

describe("scheduler", () => {
  beforeEach(() => {
    // remove state file if exists
    try {
      if (existsSync(STATE)) unlinkSync(STATE);
    } catch (e) {}
  });
  afterEach(() => {
    try {
      if (existsSync(STATE)) unlinkSync(STATE);
    } catch (e) {}
  });

  it("enqueue and list job", () => {
    const id = enqueueRetry("/tmp/test.mv2", 12345);
    const jobs = listJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs.find((j: any) => j.id === id)).toBeTruthy();
  });

  it("runDueJobs executes and reschedules on failure", async () => {
    // create a memvidClient stub that fails expand to trigger reschedule
    const memvidClient: any = {
      checkCapacity: async (path: string) => ({
        capacityBytes: 1000,
        currentBytes: 900,
        usagePercent: 90,
        shouldExpand: true,
      }),
      tickets: {
        apply: async (opts: any) => {
          throw new Error("no-op");
        },
      },
      expandCapacity: async (path: string, bytes: number) => {
        throw new Error("fail");
      },
    };

    enqueueRetry("/tmp/test.mv2", 12345, {});
    await runDueJobs(memvidClient, {});

    const jobs = listJobs();
    // job should be rescheduled (present) with attempt >=1
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs[0].attempt).toBeGreaterThanOrEqual(1);
  });
});
