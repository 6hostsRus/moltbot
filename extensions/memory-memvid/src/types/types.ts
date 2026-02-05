import { Type, type Static } from "@sinclair/typebox";

/**
 * Configuration schema for memory-memvid plugin
 */
export const MemvidConfigSchema = Type.Object(
  {
    memvidPath: Type.Optional(Type.String()),
    archivesDir: Type.Optional(Type.String()),
    apiKey: Type.Optional(Type.String()),
    enrichmentEngine: Type.Optional(
      Type.Union([Type.Literal("basic"), Type.Literal("candle"), Type.Literal("cloud")]),
    ),
    autoCapture: Type.Optional(Type.Boolean()),
    autoRecall: Type.Optional(Type.Boolean()),
    autoArchiveSessions: Type.Optional(Type.Boolean()),
    sessionArchiveThresholdMB: Type.Optional(Type.Number()),
    ticketSource: Type.Optional(Type.Union([Type.Literal("self-hosted"), Type.Literal("cloud")])),
    ticketIssuer: Type.Optional(Type.String()),
    autoExpandCapacity: Type.Optional(Type.Boolean()),
    capacityThresholdPercent: Type.Optional(Type.Number()),
    // Manual confirmation threshold in bytes (e.g. 10GB)
    manualConfirmBytes: Type.Optional(Type.Number()),
    // Scheduler/backoff tuning
    schedulerInitialBackoffMs: Type.Optional(Type.Number()),
    schedulerMaxBackoffMs: Type.Optional(Type.Number()),
    schedulerMaxRetries: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

export type MemvidConfig = Static<typeof MemvidConfigSchema>;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<MemvidConfig> & {
  manualConfirmBytes: number;
  schedulerInitialBackoffMs: number;
  schedulerMaxBackoffMs: number;
  schedulerMaxRetries: number;
} = {
  memvidPath: "memvid",
  archivesDir: "~/.openclaw/memory/archives",
  apiKey: "",
  enrichmentEngine: "basic",
  autoCapture: true,
  autoRecall: true,
  autoArchiveSessions: true,
  sessionArchiveThresholdMB: 10,
  ticketSource: "self-hosted",
  ticketIssuer: "openclaw.local",
  autoExpandCapacity: true,
  capacityThresholdPercent: 85,
  // defaults for guard/manual confirmation and scheduler
  manualConfirmBytes: 10 * 1024 * 1024 * 1024, // 10GB
  schedulerInitialBackoffMs: 60 * 60 * 1000, // 1 hour
  schedulerMaxBackoffMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  schedulerMaxRetries: 8,
};

/**
 * Resolve environment variables in config values
 */
export function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || "";
  });
}

export interface ArchiveInfo {
  name: string;
  path: string;
  sizeBytes?: number;
}

export interface SearchResult {
  archiveName: string;
  content: string;
  score?: number;
  frameId?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEntry {
  frameId: string;
  timestamp: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Entry {
  frameId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface Stats {
  totalEntries: number;
  sizeBytes: number;
  capacityBytes?: number;
  usagePercent?: number;
}

export interface IssueTicketOptions {
  issuer: string;
  seq: number;
  expiresIn?: number;
  capacity: number;
}

export interface TicketInfo {
  ticket?: {
    seq_no: number;
    capacity_bytes: number;
    issuer: string;
    expires_at?: number;
  };
  usage?: {
    usage_bytes: number;
    usage_percent: number;
  };
}

export interface CapacityInfo {
  currentBytes: number;
  capacityBytes: number;
  usagePercent: number;
  shouldExpand: boolean;
}

export interface TimelineOptions {
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Helper to validate allowed keys in config
 */
function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) {
    return;
  }
  throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

/**
 * Config schema with parse function (similar to memory-lancedb pattern)
 */
export const memvidConfigSchema = {
  parse(value: unknown): MemvidConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "memvidPath",
        "archivesDir",
        "apiKey",
        "enrichmentEngine",
        "autoCapture",
        "autoRecall",
        "autoArchiveSessions",
        "sessionArchiveThresholdMB",
        "ticketSource",
        "ticketIssuer",
        "autoExpandCapacity",
        "capacityThresholdPercent",
        "manualConfirmBytes",
        "schedulerInitialBackoffMs",
        "schedulerMaxBackoffMs",
        "schedulerMaxRetries",
      ],
      "memvid config",
    );

    return {
      memvidPath: typeof cfg.memvidPath === "string" ? cfg.memvidPath : undefined,
      archivesDir: typeof cfg.archivesDir === "string" ? cfg.archivesDir : undefined,
      apiKey: typeof cfg.apiKey === "string" ? cfg.apiKey : undefined,
      enrichmentEngine:
        cfg.enrichmentEngine === "basic" ||
        cfg.enrichmentEngine === "candle" ||
        cfg.enrichmentEngine === "cloud"
          ? cfg.enrichmentEngine
          : undefined,
      autoCapture: typeof cfg.autoCapture === "boolean" ? cfg.autoCapture : undefined,
      autoRecall: typeof cfg.autoRecall === "boolean" ? cfg.autoRecall : undefined,
      autoArchiveSessions:
        typeof cfg.autoArchiveSessions === "boolean" ? cfg.autoArchiveSessions : undefined,
      sessionArchiveThresholdMB:
        typeof cfg.sessionArchiveThresholdMB === "number"
          ? cfg.sessionArchiveThresholdMB
          : undefined,
      ticketSource:
        cfg.ticketSource === "self-hosted" || cfg.ticketSource === "cloud"
          ? cfg.ticketSource
          : undefined,
      ticketIssuer: typeof cfg.ticketIssuer === "string" ? cfg.ticketIssuer : undefined,
      autoExpandCapacity:
        typeof cfg.autoExpandCapacity === "boolean" ? cfg.autoExpandCapacity : undefined,
      capacityThresholdPercent:
        typeof cfg.capacityThresholdPercent === "number" ? cfg.capacityThresholdPercent : undefined,
      manualConfirmBytes:
        typeof cfg.manualConfirmBytes === "number" ? cfg.manualConfirmBytes : undefined,
      schedulerInitialBackoffMs:
        typeof cfg.schedulerInitialBackoffMs === "number"
          ? cfg.schedulerInitialBackoffMs
          : undefined,
      schedulerMaxBackoffMs:
        typeof cfg.schedulerMaxBackoffMs === "number" ? cfg.schedulerMaxBackoffMs : undefined,
      schedulerMaxRetries:
        typeof cfg.schedulerMaxRetries === "number" ? cfg.schedulerMaxRetries : undefined,
    };
  },
  uiHints: {
    memvidPath: {
      label: "Memvid CLI Path",
      placeholder: "memvid",
      help: "Path to the memvid CLI binary",
      advanced: true,
    },
    archivesDir: {
      label: "Archives Directory",
      placeholder: "~/.openclaw/memory/archives",
      help: "Directory to store .mv2 archive files",
    },
    apiKey: {
      label: "Memvid API Key",
      sensitive: true,
      placeholder: "your-api-key",
      help: "API key for cloud enrichment (optional, use ${MEMVID_API_KEY})",
      advanced: true,
    },
    enrichmentEngine: {
      label: "Enrichment Engine",
      placeholder: "basic",
      help: "Engine for embeddings: basic (offline), candle, or cloud",
      advanced: true,
    },
    autoCapture: {
      label: "Auto-Capture",
      help: "Automatically capture important information from conversations",
    },
    autoRecall: {
      label: "Auto-Recall",
      help: "Automatically inject relevant archived memories into context",
    },
    autoArchiveSessions: {
      label: "Auto-Archive Sessions",
      help: "Automatically archive completed session transcripts",
      advanced: true,
    },
    sessionArchiveThresholdMB: {
      label: "Session Archive Threshold (MB)",
      placeholder: "10",
      help: "Archive sessions when they exceed this size",
      advanced: true,
    },
    ticketSource: {
      label: "Ticket Source",
      placeholder: "self-hosted",
      help: "Use self-hosted or cloud tickets for capacity management",
      advanced: true,
    },
    ticketIssuer: {
      label: "Ticket Issuer",
      placeholder: "openclaw.local",
      help: "Issuer name for self-hosted tickets",
      advanced: true,
    },
    autoExpandCapacity: {
      label: "Auto-Expand Capacity",
      help: "Automatically expand archive capacity when approaching limit",
      advanced: true,
    },
    capacityThresholdPercent: {
      label: "Capacity Threshold (%)",
      placeholder: "85",
      help: "Trigger auto-expansion at this usage percentage",
      advanced: true,
    },
    manualConfirmBytes: {
      label: "Manual Confirm Threshold (bytes)",
      placeholder: "10737418240",
      help: "If recommended expansion exceeds this many bytes, require manual confirmation",
      advanced: true,
    },
    schedulerInitialBackoffMs: {
      label: "Scheduler initial backoff (ms)",
      placeholder: "3600000",
      help: "Initial backoff interval for scheduler retries in milliseconds",
      advanced: true,
    },
    schedulerMaxBackoffMs: {
      label: "Scheduler max backoff (ms)",
      placeholder: "604800000",
      help: "Maximum backoff interval for scheduler retries in milliseconds",
      advanced: true,
    },
    schedulerMaxRetries: {
      label: "Scheduler max retries",
      placeholder: "8",
      help: "Maximum number of retries for scheduled expand attempts",
      advanced: true,
    },
  },
};
