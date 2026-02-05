export interface FrameRetention {
  tier: "hot" | "warm" | "cold";
  expiryTs?: number | null;
}

export type Sensitivity = "public" | "private" | "pii" | "sensitive";

export interface Frame {
  "frame.title": string;
  "frame.content"?: string | null;
  "frame.search_text"?: string | null;
  "frame.uri": string; // mv2://...
  "frame.source": "session-auto-capture" | "session-archive" | "manual" | "system" | "external";
  "frame.session_key"?: string | null;
  "frame.role": "user" | "assistant" | "system" | "event" | "task";
  "frame.timestamp": number;
  "frame.metadata"?: Record<string, unknown>;
  "frame.summary"?: string | null;
  "frame.embeddings"?: Record<string, unknown>;
  "frame.sensitivity"?: Sensitivity;
  "frame.retention"?: FrameRetention;
  "frame.precedence"?: string;
}
