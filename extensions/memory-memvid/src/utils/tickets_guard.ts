/**
 * Auto-expand guard logic draft
 * - Triggers when usagePercent >= threshold (default 85)
 * - Uses exponential backoff for automatic retries
 * - Requires manual confirmation for expansions > manualConfirmBytes (default 10GB)
 * - Provides hooks for operator alerting (structuredLog)
 */
import { structuredLog, genRunId } from "./logging";

export type GuardConfig = {
  thresholdPercent?: number; // default 85
  manualConfirmBytes?: number; // default 10GB
  initialBackoffMs?: number; // default 1 hour
  maxBackoffMs?: number; // default 7 days
  maxRetries?: number; // default 8
};

export function defaultConfig(): GuardConfig {
  return {
    thresholdPercent: 85,
    manualConfirmBytes: 10 * 1024 * 1024 * 1024,
    initialBackoffMs: 60 * 60 * 1000,
    maxBackoffMs: 7 * 24 * 60 * 60 * 1000,
    maxRetries: 8,
  };
}

export async function evaluateAutoExpand(
  memvidClient: any,
  usage: { usagePercent: number; usedBytes: number; capacityBytes: number },
  cfg?: GuardConfig,
  opts?: { dryRun?: boolean; autoExpand?: boolean },
) {
  const runId = genRunId();
  cfg = { ...defaultConfig(), ...(cfg || {}) };
  structuredLog({
    timestamp: Date.now(),
    level: "info",
    event: "guard-evaluate",
    runId,
    details: { usage },
  });

  if (usage.usagePercent < cfg.thresholdPercent!) {
    structuredLog({
      timestamp: Date.now(),
      level: "info",
      event: "guard-ok",
      runId,
      details: { usage },
    });
    return { action: "none" };
  }

  // estimate expansion size recommended: grow by 2x usedBytes - capacity, but cap to manualConfirm threshold
  const recommended = Math.max(
    usage.usedBytes * 2 - usage.capacityBytes,
    Math.ceil(cfg.manualConfirmBytes / 2),
  );
  const needsManualConfirm = recommended > (cfg.manualConfirmBytes || 0);

  structuredLog({
    timestamp: Date.now(),
    level: "warn",
    event: "guard-triggered",
    runId,
    details: { usage, recommended, needsManualConfirm },
  });

  if (needsManualConfirm && !opts?.autoExpand) {
    // emit operator alert and require manual confirmation
    structuredLog({
      timestamp: Date.now(),
      level: "audit",
      event: "guard-await-manual-confirm",
      runId,
      details: { recommended },
    });
    return { action: "await_manual", recommended };
  }

  if (opts?.dryRun) {
    structuredLog({
      timestamp: Date.now(),
      level: "audit",
      event: "guard-dry-run",
      runId,
      details: { recommended },
    });
    return { action: "dry-run", recommended };
  }

  // auto-apply with exponential backoff attempts (skeleton, not scheduling)
  let attempt = 0;
  let backoff = cfg.initialBackoffMs!;
  while (attempt < (cfg.maxRetries || 8)) {
    try {
      // call memvidClient.tickets.apply({ bytes: recommended })
      const res = await memvidClient.tickets.apply({ bytes: recommended });
      structuredLog({
        timestamp: Date.now(),
        level: "audit",
        event: "guard-applied",
        runId,
        details: { res },
      });
      return { action: "applied", res };
    } catch (e) {
      structuredLog({
        timestamp: Date.now(),
        level: "error",
        event: "guard-apply-failed",
        runId,
        details: { error: String(e), attempt },
      });
      // wait backoff (note: this function will not actually sleep in tests; caller can implement scheduling)
      attempt += 1;
      backoff = Math.min(backoff * 2, cfg.maxBackoffMs || backoff);
      // in real implementation schedule retry after backoff
    }
  }

  structuredLog({
    timestamp: Date.now(),
    level: "error",
    event: "guard-exhausted",
    runId,
    details: {},
  });
  return { action: "failed" };
}
