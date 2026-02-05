import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { genRunId, structuredLog, getAuditLogPath } from "./logging";
import { evaluateAutoExpand, GuardConfig, defaultConfig } from "./tickets_guard";

// Simple file-backed scheduler for exponential backoff retries.
// - Jobs are stored under ~/.openclaw/memvid-scheduler.json by default (configurable via MEMVID_SCHEDULER_STATE)
// - Scheduler exposes enqueueRetry(job) which records job state and nextAttempt timestamp
// - runDueJobs(memvidClient) runs due jobs synchronously (for CI/cron invocation); it does not background itself

type Job = {
  id: string;
  archivePath: string;
  recommendedBytes: number;
  attempt: number;
  nextAttemptMs: number;
  backoffMs: number;
  maxAttempts: number;
  createdAt: number;
};

const DEFAULT_STATE = join(process.env.HOME || "/tmp", ".openclaw", "memvid-scheduler.json");
const STATE_PATH = process.env.MEMVID_SCHEDULER_STATE || DEFAULT_STATE;

function ensureStateDir() {
  const dir = require("node:path").dirname(STATE_PATH);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function loadState(): { jobs: Job[] } {
  ensureStateDir();
  if (!existsSync(STATE_PATH)) return { jobs: [] };
  try {
    const raw = readFileSync(STATE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    structuredLog({
      timestamp: Date.now(),
      level: "warn",
      event: "scheduler-load-failed",
      details: { error: String(e) } as any,
    });
    return { jobs: [] };
  }
}

function saveState(state: { jobs: Job[] }) {
  ensureStateDir();
  try {
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { flag: "w" });
  } catch (e) {
    structuredLog({
      timestamp: Date.now(),
      level: "error",
      event: "scheduler-save-failed",
      details: { error: String(e) } as any,
    });
  }
}

export function enqueueRetry(
  archivePath: string,
  recommendedBytes: number,
  cfg?: Partial<GuardConfig>,
) {
  const state = loadState();
  const id = genRunId();
  const cfgFull = { ...defaultConfig(), ...(cfg || {}) };
  const job: Job = {
    id,
    archivePath,
    recommendedBytes,
    attempt: 0,
    nextAttemptMs: Date.now(),
    backoffMs: cfgFull.initialBackoffMs || 60 * 60 * 1000,
    maxAttempts: cfgFull.maxRetries || 8,
    createdAt: Date.now(),
  };
  state.jobs.push(job);
  saveState(state);
  structuredLog({
    timestamp: Date.now(),
    level: "info",
    event: "scheduler-enqueue",
    details: { id, archivePath, recommendedBytes },
  });
  return job.id;
}

export async function runDueJobs(memvidClient: any, cfg?: Partial<GuardConfig>) {
  const state = loadState();
  const now = Date.now();
  const due = state.jobs.filter((j) => j.nextAttemptMs <= now);
  const remaining: Job[] = state.jobs.filter((j) => j.nextAttemptMs > now);

  for (const job of due) {
    const runId = genRunId();
    structuredLog({
      timestamp: Date.now(),
      level: "info",
      event: "scheduler-run-job",
      runId,
      details: { jobId: job.id, archivePath: job.archivePath, attempt: job.attempt },
    });
    try {
      const usage = await memvidClient.checkCapacity(job.archivePath);
      // use evaluateAutoExpand but tell it to autoExpand=true so it attempts apply; dryRun=false
      const res = await evaluateAutoExpand(
        memvidClient,
        {
          usagePercent: usage.usagePercent,
          usedBytes: usage.currentBytes,
          capacityBytes: usage.capacityBytes,
        },
        cfg,
        { dryRun: false, autoExpand: true },
      );

      if (res.action === "applied" || res.action === "applied" || res.action === "none") {
        structuredLog({
          timestamp: Date.now(),
          level: "audit",
          event: "scheduler-job-completed",
          runId,
          details: { jobId: job.id, result: res },
        });
        // job done
        continue;
      }

      // if failed or needs manual, schedule retry with backoff
      job.attempt += 1;
      if (job.attempt >= job.maxAttempts) {
        structuredLog({
          timestamp: Date.now(),
          level: "error",
          event: "scheduler-job-exhausted",
          runId,
          details: { jobId: job.id },
        });
        continue;
      }

      // compute next attempt
      job.backoffMs = Math.min(
        job.backoffMs * 2,
        cfg?.maxBackoffMs || defaultConfig().maxBackoffMs!,
      );
      job.nextAttemptMs = Date.now() + job.backoffMs;
      remaining.push(job);
      structuredLog({
        timestamp: Date.now(),
        level: "warn",
        event: "scheduler-job-rescheduled",
        runId,
        details: { jobId: job.id, nextAttemptMs: job.nextAttemptMs },
      });
    } catch (e) {
      // On unexpected error, reschedule
      job.attempt += 1;
      if (job.attempt >= job.maxAttempts) {
        structuredLog({
          timestamp: Date.now(),
          level: "error",
          event: "scheduler-job-error-exhausted",
          details: { jobId: job.id, error: String(e) },
        });
        continue;
      }
      job.backoffMs = Math.min(
        job.backoffMs * 2,
        cfg?.maxBackoffMs || defaultConfig().maxBackoffMs!,
      );
      job.nextAttemptMs = Date.now() + job.backoffMs;
      remaining.push(job);
      structuredLog({
        timestamp: Date.now(),
        level: "warn",
        event: "scheduler-job-error-rescheduled",
        details: { jobId: job.id, error: String(e), nextAttemptMs: job.nextAttemptMs },
      });
    }
  }

  // save remaining jobs
  saveState({ jobs: remaining });
}

export function listJobs() {
  const state = loadState();
  return state.jobs;
}

export function deleteJob(jobId: string) {
  const state = loadState();
  const remaining = state.jobs.filter((j) => j.id !== jobId);
  saveState({ jobs: remaining });
}
