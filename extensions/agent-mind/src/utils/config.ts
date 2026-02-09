export type AgentMindConfig = {
  defaultMemorySubPath?: string;
  autoCapture?: boolean;
  // consider toggles for auto-capture, auto-recall,
  // condense / compact, and embeddings

  // TODO: implement custom memory categories and overrides
  // customMemoryCategories?: boolean;
  // memoryCategoriesOverrides?: string[];
};

const defaultConfig: AgentMindConfig = {
  defaultMemorySubPath: "memory",
  autoCapture: true,
};

/** Observation captured from tool use */
export interface Observation {
  id: string;
  timestamp: number;
  type: ObservationType;
  tool?: string;
  summary: string;
  content: string;
  metadata?: ObservationMetadata;
}

/** Types of observations */
export type ObservationType = (typeof OBSERVATION_TYPES)[number];
/** Core types for memory persistence. Built from Claude Code Core Observation types. */
export const OBSERVATION_TYPES = [
  "discovery",
  "decision",
  "problem",
  "solution",
  "pattern",
  "warning",
  "success",
  "refactor",
  "bugfix",
  "feature",
] as const;

/** Metadata attached to observations */
export interface ObservationMetadata {
  files?: string[];
  functions?: string[];
  error?: string;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  [key: string]: unknown; // Allow additional properties
}

const isValidKey = (key: string): key is keyof AgentMindConfig => {
  return key === Object.keys(defaultConfig).find((k) => k === key);
};

function assertAllowedKeys(value: Record<string, unknown>) {
  Object.keys(value).forEach((key) => {
    if (!isValidKey(key)) {
      throw new Error(`memory config has unknown key: ${key}`);
    }
  });
}

const parse = (value: unknown): AgentMindConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    value = defaultConfig;
  }
  const cfg = value as Record<string, unknown>;
  assertAllowedKeys(cfg);

  return cfg as AgentMindConfig;
};

const uiHints = {
  defaultMemorySubPath: {
    label: "Default Memory Sub-Path",
    description:
      "The default sub-path within the agent's workspace where memories will be stored. This allows for better organization and separation of different types of data.",
  },
  autoCapture: {
    label: "Auto-Capture Observations",
    description:
      "Enable or disable automatic capture of observations from tool use. When enabled, the plugin will automatically create observations based on the agent's interactions with tools, which can then be stored in memory for later retrieval and reasoning.",
  },
};

const agentMindSchema = {
  parse,
  uiHints,
};

export default agentMindSchema;
