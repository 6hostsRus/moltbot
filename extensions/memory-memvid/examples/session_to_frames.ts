import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Simple mapping: JSONL session -> frames
// Usage: node examples/session_to_frames.js <session.jsonl> <out-dir>

function mapTurnToFrame(turn: any) {
  const title = turn.role ? `${turn.role} turn` : "turn";
  const content = JSON.stringify(turn, null, 2);
  const search_text = typeof turn.content === "string" ? turn.content.substring(0, 1000) : "";

  return {
    "frame.title": title,
    "frame.content": content,
    "frame.search_text": search_text,
    "frame.uri": `mv2://session/${turn.id || turn.timestamp || Math.floor(Math.random() * 1e6)}`,
    "frame.source": "session-archive",
    "frame.session_key": turn.sessionKey || null,
    "frame.role": turn.role || "event",
    "frame.timestamp": turn.timestamp || Date.now(),
    "frame.metadata": turn.metadata || {},
    "frame.summary": typeof turn.content === "string" ? turn.content.substring(0, 200) : null,
    "frame.sensitivity": "private",
  };
}

if (process.argv.length < 4) {
  console.error("Usage: node examples/session_to_frames.js <session.jsonl> <out-dir>");
  process.exit(2);
}

const sessionPath = process.argv[2];
const outDir = process.argv[3];

const lines = readFileSync(sessionPath, "utf-8").split("\n").filter(Boolean);
const frames = [];
let rawFramesCount = 0;

for (const line of lines) {
  try {
    const turn = JSON.parse(line);
    const frame = mapTurnToFrame(turn);
    frames.push(frame);
    rawFramesCount++;
  } catch (err) {
    // skip
  }
}

writeFileSync(join(outDir, "frames.json"), JSON.stringify(frames, null, 2));
writeFileSync(join(outDir, "raw_session.jsonl"), lines.join("\n"));
console.log(`Wrote ${frames.length} frames and raw_session.jsonl to ${outDir}`);
