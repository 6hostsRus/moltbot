06 — Session Recording & Replay CI

Goal
Hook memvid session recording APIs and add CI smoke tests that replay sessions in audit mode to ensure reproducibility.

Tasks

- Instrument agent lifecycle to call memvid session start/end around recorded operations.
- Record token counts, grounding, and model metadata for each ask operation.
- Add CI smoke test that:
  - Starts a memvid session, performs a controlled set of asks/finds, ends session.
  - Replays the session in audit mode and asserts that frozen frames match expected frames.
- Add test harness for model A/B comparisons (optional, gated behind a flag).

Acceptance criteria

- CI job can record and replay a session in audit mode and assert expected outputs (or flag diffs).
- Token/cost tracking is captured in session metadata.

Notes

- Keep CI acoustic/simple: use a small local memory file and deterministic queries.
- After implementation, move this file to ../completed/ with commit/PR reference.
