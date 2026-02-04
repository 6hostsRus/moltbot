export type Sensitivity = "public" | "private" | "pii" | "sensitive";
export type Source = "session-auto-capture" | "session-archive" | "manual" | "system" | "external";
export type Role = "user" | "assistant" | "system" | "event" | "task";

export interface FrameEmbeddings {
  engine?: string;
  vectorId?: string;
  [k: string]: any;
}

export interface FrameRetention {
  tier: "hot" | "warm" | "cold";
  expiryTs?: number | null;
}

export interface MemvidFrame {
  "frame.title": string;
  "frame.content"?: string | null;
  "frame.search_text"?: string | null;
  "frame.uri": string;
  "frame.source": Source;
  "frame.session_key"?: string | null;
  "frame.role": Role;
  "frame.timestamp": number;
  "frame.metadata"?: Record<string, any>;
  "frame.summary"?: string | null;
  "frame.embeddings"?: FrameEmbeddings;
  "frame.sensitivity"?: Sensitivity;
  "frame.retention"?: FrameRetention;
  "frame.precedence"?: string;
}
