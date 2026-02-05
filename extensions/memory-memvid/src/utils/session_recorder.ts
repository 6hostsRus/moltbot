import fs from "fs";
import path from "path";

export interface SessionFrame {
  type: "ask" | "response" | "info" | "decision" | "tool-start" | "tool-end";
  timestamp: number;
  id: string;
  model?: string;
  prompt?: string;
  response?: string;
  tokens?: { prompt: number; completion: number; total: number };
  metadata?: Record<string, unknown>;
}

export interface SessionStart {
  runId: string;
  startedAt: number;
  metadata?: Record<string, unknown>;
}

export class SessionRecorder {
  private outPath: string;
  private stream: fs.WriteStream;

  constructor(outPath: string) {
    this.outPath = outPath;
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.stream = fs.createWriteStream(outPath, { flags: "a" });
  }

  start(start: SessionStart) {
    this.write({
      type: "info",
      timestamp: Date.now(),
      id: `start-${start.runId}`,
      metadata: start,
    });
  }

  frame(frame: SessionFrame) {
    this.write(frame);
  }

  end(runId: string) {
    this.write({ type: "info", timestamp: Date.now(), id: `end-${runId}`, metadata: { runId } });
    this.stream.end();
  }

  private write(obj: unknown) {
    this.stream.write(JSON.stringify(obj) + "\n");
  }
}
