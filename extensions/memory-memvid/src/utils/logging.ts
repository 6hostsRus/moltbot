import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import masking from "./masking";

function getAuditLogPath() {
  return process.env.MEMVID_AUDIT_LOG || `${process.env.HOME || "/tmp"}/.openclaw/memvid-audit.log`;
}

export function genRunId() {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type LogEntry = {
  timestamp: number;
  level: "info" | "warn" | "error" | "audit";
  event: string;
  runId?: string;
  agentId?: string;
  frames?: string[];
  scores?: Record<string, number>;
  latencyMs?: number;
  reason?: string;
  details?: Record<string, any>;
};

export function structuredLog(entry: LogEntry) {
  // If details.preview exists, mask it to avoid sensitive data in logs
  if (entry.details && typeof entry.details.preview === "string") {
    entry.details.preview = masking.applyMaskToFrameContent(
      entry.details.preview.substring(0, 1024),
    );
    entry.reason = entry.reason ? `${entry.reason};preview-masked` : "preview-masked";
  }

  const line = JSON.stringify(entry);
  console.log(line);
  // for audit-level entries, append to audit log file
  if (entry.level === "audit") {
    try {
      const fs = require("node:fs");
      const auditPath = getAuditLogPath();
      const dir = dirname(auditPath);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        // ignore
      }
      try {
        fs.appendFileSync(auditPath, line + "\n");
      } catch (e) {
        console.error(`Failed to write audit log: ${e}`);
      }
    } catch (e) {
      console.error(`Failed to write audit log: ${e}`);
    }
  }
}

export default { genRunId, structuredLog, getAuditLogPath };
