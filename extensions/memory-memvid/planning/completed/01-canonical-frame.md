01 — Canonical Frame Schema & Types

Goal
Finalize and implement the canonical frame schema and TypeScript types used across the plugin. Provide examples, validation, and a mapping script for session → frame.

Tasks

- Add canonical-frame.schema.json to the repo (JSON Schema, draft).
- Add types/frame.ts with TypeScript interfaces used by services.
- Create example frames and a sample mapping script (session-jsonl → frames) in examples/.
- Add unit tests that validate frames against the JSON Schema and ensure roundtrip serialization.

Acceptance criteria

- schema file exists and validates example frames.
- TypeScript types compile without errors.
- Mapping script converts a sample session JSONL to distilled frames and a raw session-archive frame.

Notes

- Keep summaries 50–200 tokens for injection efficiency.
- Use `frame.sensitivity` to flag PII/sensitive frames; production UI must mask on presentation even if sensitivity != "pii".
- After implementation, move this file to ../completed/ with a short note referencing the commit/PR.
