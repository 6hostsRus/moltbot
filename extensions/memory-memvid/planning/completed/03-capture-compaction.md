03 — Capture & Compaction Pipeline

Goal
Implement heuristics for auto-capture, distilled summaries, and periodic compaction.

Tasks

- Implement shouldCapture() heuristics (novelty, entity density, presence of actions/tasks, length thresholds).
- On agent_end, auto-capture relevant turns and store distilled frames in per-agent memory with `source=session-auto-capture`.
- Keep raw session frames (source=session-archive) for replay and auditing; mark sensitivity appropriately.
- Implement a compaction job that consolidates multiple frames into a distilled summary frame and marks originals as superseded.
- Unit and integration tests validating capture decisions and compaction correctness.

Acceptance criteria

- shouldCapture() has test coverage and tunable thresholds.
- Auto-capture creates small summary frames suitable for injection.
- Compaction reduces token footprint and preserves provenance links.

Notes

- Compaction schedule: weekly by default; adjustable per archive.
- Superseded frames should be retained for audit until retention expiry but excluded from injection unless requested.
- After implementation, move this file to ../completed/ with commit/PR reference.
