07 — Enrichment & Distillation Pipeline

Goal
Design and implement asynchronous enrichment (embeddings, memory-cards) and scheduled compaction/distillation jobs.

Tasks

- Build an async enrichment worker that:
  - Generates embeddings (prefer Candle / Ollama Qwen 2.5:3b) and stores engine metadata in frame.embeddings.
  - Produces memory-cards (Candle) and vector-compressed representations where applicable.
- Schedule periodic re-enrichment jobs to refresh embeddings for hot frames.
- Implement compaction pipeline (see 03) to produce distilled frames from multiple related frames.
- Add metrics and alerts for enrichment job durations and failures.

Acceptance criteria

- Enricher can process frames from a queue and write back embeddings metadata.
- Compaction pipeline reduces storage footprint and produces provenance links.

Notes

- Use vector compression for long-lived archives to reduce storage costs.
- After implementation, move this file to ../completed/ with commit/PR reference.
