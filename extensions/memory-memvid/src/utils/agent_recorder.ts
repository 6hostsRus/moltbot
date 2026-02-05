import { v4 as uuidv4 } from "uuid";
import type { MemvidClient } from "../MemvidClient";
import { SessionRecorder, SessionFrame } from "./session_recorder";

export interface AgentRecorderOptions {
  // When true, write a JSONL local export in addition to memvid storage
  writeLocalJsonl?: boolean;
  // Masking hook: return a masked copy of the object. If undefined, no masking is applied.
  maskHook?: (obj: any) => any;
  // If true, allow raw (unmasked) content to be written when explicitly requested
  allowRaw?: boolean;
  // Archive path to store session in (memvid archive .mv2)
  archivePath: string;
  // Optional session name
  sessionName?: string;
}

/**
 * AgentRecorder records high-level agent lifecycle events. By default it records
 * into Memvid via the provided MemvidClient. Optionally it can also write a
 * local JSONL recorder (useful for CI tuning). Masking hooks are supported
 * and raw output can be requested via method flags.
 */
export class AgentRecorder {
  private memvid: MemvidClient;
  private recorder?: SessionRecorder; // optional local JSONL writer
  private opts: AgentRecorderOptions;
  private runId: string;
  private sessionName?: string;

  constructor(memvidClient: MemvidClient, opts: AgentRecorderOptions) {
    this.memvid = memvidClient;
    this.opts = opts;
    this.recorder = opts.writeLocalJsonl
      ? new SessionRecorder(opts.archivePath + ".session.jsonl")
      : undefined;
    this.runId = `agent-${Date.now()}-${uuidv4().slice(0, 6)}`;
    this.sessionName = opts.sessionName;
  }

  // Utility to apply masking depending on allowRaw/requestRaw flag
  private maybeMask(obj: any, rawRequested = false) {
    if (rawRequested && this.opts.allowRaw) return obj;
    if (this.opts.maskHook) return this.opts.maskHook(obj);
    return obj;
  }

  async start(metadata: Record<string, unknown> = {}) {
    const startedAt = Date.now();
    const md = Object.assign({ runId: this.runId, startedAt }, metadata);

    // start memvid session (primary sink)
    try {
      await this.memvid.sessionStart(this.opts.archivePath, this.sessionName || this.runId, md);
    } catch (e) {
      // memvid session start failed: fall back to local recorder if present
      // but do not throw here to avoid breaking agent
      // eslint-disable-next-line no-console
      console.warn("memvid sessionStart failed, falling back to local JSONL", e);
    }

    // write local start frame if configured
    if (this.recorder) {
      this.recorder.start({ runId: this.runId, startedAt, metadata: this.maybeMask(md) });
    }
  }

  /**
   * Record an ask. Returns an agentFrameId to correlate later events.
   */
  async recordAsk(prompt: string, modelInfo: any = {}, raw = false): Promise<string> {
    const agentFrameId = `agent-${uuidv4()}`;
    const ts = Date.now();
    const masked = this.maybeMask({ prompt, modelInfo }, raw);

    // Write memvid frame: put the prompt as a frame and include agentFrameId in metadata
    try {
      const metadata = { type: "ask", agentFrameId, modelInfo, _agent_runId: this.runId };
      // store the (possibly masked) prompt; if raw requested and allowed, store raw
      const content = raw && this.opts.allowRaw ? prompt : masked.prompt || prompt;
      const frameId = await this.memvid.put(this.opts.archivePath, content, metadata);

      // local recorder
      if (this.recorder) {
        this.recorder.frame({
          type: "ask",
          timestamp: ts,
          id: agentFrameId,
          model: modelInfo?.name || "",
          prompt: masked.prompt || "",
          metadata,
        });
      }

      // Also return agentFrameId for correlation; callers should use agentFrameId when invoking model
      return agentFrameId;
    } catch (e) {
      // failed to write to memvid; still record locally if possible
      if (this.recorder) {
        this.recorder.frame({
          type: "ask",
          timestamp: ts,
          id: agentFrameId,
          model: modelInfo?.name || "",
          prompt: masked.prompt || "",
          metadata: { err: String(e) },
        });
      }
      return agentFrameId;
    }
  }

  async recordDecision(
    agentFrameId: string,
    decision: { reason?: string; chosen?: string; score?: number },
  ) {
    const ts = Date.now();
    const masked = this.maybeMask(decision);

    // record into memvid as an info frame via put with metadata linking to agentFrameId
    try {
      const metadata = { type: "decision", agentFrameId, decision };
      await this.memvid.put(this.opts.archivePath, JSON.stringify(masked), metadata);
    } catch (e) {
      // ignore memvid errors; write local fallback
      if (this.recorder)
        this.recorder.frame({
          type: "info",
          timestamp: ts,
          id: `decision-${agentFrameId}`,
          metadata: masked,
        });
    }

    if (this.recorder)
      this.recorder.frame({
        type: "decision",
        timestamp: ts,
        id: `decision-${agentFrameId}`,
        metadata: masked,
      });
  }

  async recordToolCallStart(agentFrameId: string, toolName: string, args: any) {
    const ts = Date.now();
    const maskedArgs = this.maybeMask(args);
    if (this.recorder)
      this.recorder.frame({
        type: "tool-start",
        timestamp: ts,
        id: `tool-start-${agentFrameId}`,
        metadata: { toolName, args: maskedArgs },
      });
  }

  async recordToolCallEnd(
    agentFrameId: string,
    toolName: string,
    result: any,
    success = true,
    raw = false,
  ) {
    const ts = Date.now();
    const maskedResult = this.maybeMask(result, raw);

    // write to memvid as a frame linking to agentFrameId
    try {
      const metadata = { type: "tool-result", agentFrameId, toolName, success };
      await this.memvid.put(
        this.opts.archivePath,
        typeof maskedResult === "string" ? maskedResult : JSON.stringify(maskedResult),
        metadata,
      );
    } catch (e) {
      if (this.recorder)
        this.recorder.frame({
          type: "tool-end",
          timestamp: ts,
          id: `tool-end-${agentFrameId}`,
          metadata: { toolName, success, result: maskedResult, err: String(e) },
        });
      return;
    }

    if (this.recorder)
      this.recorder.frame({
        type: "tool-end",
        timestamp: ts,
        id: `tool-end-${agentFrameId}`,
        metadata: { toolName, success, result: maskedResult },
      });
  }

  async recordResponse(
    agentFrameId: string,
    response: string,
    tokens?: { prompt: number; completion: number; total: number },
    raw = false,
  ) {
    const ts = Date.now();
    const masked = this.maybeMask({ response, tokens }, raw);

    try {
      const metadata = { type: "response", agentFrameId, tokens };
      const content = raw && this.opts.allowRaw ? response : masked.response || response;
      await this.memvid.put(this.opts.archivePath, content, metadata);
    } catch (e) {
      if (this.recorder)
        this.recorder.frame({
          type: "response",
          timestamp: ts,
          id: `resp-${agentFrameId}`,
          response: masked.response || response,
          tokens,
          metadata: { err: String(e) },
        });
      return;
    }

    if (this.recorder)
      this.recorder.frame({
        type: "response",
        timestamp: ts,
        id: `resp-${agentFrameId}`,
        response: masked.response || response,
        tokens,
      });
  }

  async end() {
    const ts = Date.now();
    try {
      await this.memvid.sessionEnd(this.opts.archivePath, this.sessionName || this.runId);
    } catch (e) {
      // ignore
    }

    if (this.recorder) {
      this.recorder.end(this.runId);
    }
  }
}
