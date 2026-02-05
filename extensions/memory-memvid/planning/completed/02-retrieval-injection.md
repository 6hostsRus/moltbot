02 — Retrieval & Injection Strategy

Goal
Implement hybrid retrieval + injection with token budgeting, filters, and decision logging.

Tasks

- Implement hybrid search (lexical + vector) retrieval module.
- Apply filters: recency window, sensitivity filter, minimum score threshold.
- Enforce token budget per injection (default 3000 tokens) and provide configurable override.
- Build `prependContext` composer: selected frame summaries + provenance (uri/frameIndex/score).
- Add structured decision logs (why each frame included: score, recency, sensitivity).
- Unit tests for filter logic, budget enforcement, and composer behavior.

Acceptance criteria

- Retrieval returns top-N frames with scores and metadata.
- Injection composer respects the token budget and logs inclusion reasons.
- Tests cover edge cases: no frames, all sensitive frames, budget overflow.

Notes

- Default top-N: 3–5 (configurable).
- Provide a runtime flag to choose strict vs permissive thresholds for dev/testing.
- After implementation, move this file to ../completed/ with commit/PR reference.
