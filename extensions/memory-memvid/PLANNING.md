# Memvid as OpenClaw Long‑Term Memory — Planning Notes

This document captures design considerations, schema proposals, implementation roadmap, risk matrix, and short-term tasks for using Memvid as the canonical long-term memory and context manager for OpenClaw.

## Goals
- Replace scattered RAG/session memory with a single, queryable, versioned memory store (Memvid).
- Enable reliable auto-recall (inject relevant long-term context), auto-capture (store useful conversation fragments), and session archival.
- Support long-running tasks and coordinated workflows across agents (molties) with robust capacity, governance, and observability.

## High‑level considerations
- Single source of truth simplifies recall and deduplication but requires careful mapping from ephemeral session turns to durable frames.
- Memvid provides lexical + vector indexing, timeline semantics, tickets/capacity, and CLI tooling — these features should be leveraged for lifecycle automation and governance.
- Performance: calls to Memvid must be fast and predictable in the agent hot path; prefer local copies, caching, or async prefetching for startup-critical flows.
- Safety & governance: PII detection/erasure, forget workflows, and explicit audit trails are mandatory for production usage.

## Canonical frame schema (proposal)
A canonical frame standard helps consistent search, injection, and governance.

- frame.title: string (human-friendly short title)
- frame.content: string (primary payload; may be empty for media)
- frame.search_text: string (indexable summary/extract used for fulltext search)
- frame.uri: mv2://... (canonical URI)
- frame.source: enum ["session-auto-capture","session-archive","manual","system","external"]
- frame.session_key: optional string (originating session id if applicable)
- frame.role: enum ["user","assistant","system","event","task"]
- frame.timestamp: unix seconds (ms optional)
- frame.metadata: object (structured metadata: tags, labels, provenance, content type, size)
- frame.summary: optional short summary for injection (50–200 tokens)
- frame.embeddings: optional (engine metadata — usually created by enrich)
- frame.sensitivity: optional enum ["public","private","pii","sensitive"]
- frame.retention: optional policy object { tier: "hot"|"warm"|"cold", expiryTs?: timestamp }

Notes:
- Prefer storing small, dense frames (short messages or distilled summaries) rather than raw full sessions to avoid token explosion.
- Keep both `content` (canonical payload when present) and `search_text` (indexable) to adapt to CLI shapes.

## Retrieval & injection strategy
- Before agent start (auto-recall):
  - Query memvid with a hybrid strategy: lexical + vector (Memvid supports "hybrid").
  - Retrieve top-N candidates (configurable, default 3–5) with scores and metadata.
  - Apply filters: recency window, sensitivity, minimum score threshold, and max combined token budget.
  - Produce a compact `prependContext` containing selected summaries + provenance (archive + frameIndex + uri + score).
  - Log decision reasons (why each frame was included) and latency.

- During agent run (dynamic recall):
  - Expose tools for on-demand search/ask/timeline for agents to query memory.
  - For long-running tasks, async background enrichers can keep embeddings fresh and compact older context.

## Capture & compaction strategy
- Auto-capture hook (agent_end): filter messages by heuristics (length, novelty, presence of entities, utility) using `shouldCapture()`.
- For captured turns, produce a distilled summary and store a frame with `source=session-auto-capture` and `summary` and `search_text` populated.
- Periodic compaction job: distill multiple frames into a summarized frame (e.g., weekly or when archive crosses thresholds) and mark originals as superseded.

## Capacity & ticketing
- Use Memvid tickets to manage capacity. Implement safe auto-expand logic with guardrails:
  - Policy: auto-expand only when usage >= threshold (e.g., 85%) and with exponential backoff and alerting.
  - Dry-run and notification mode – require operator confirmation for >X growth in 24h.

## Consistency & concurrency
- Use memvid tickets + `who/nudge` for write coordination when multiple agents may write the same archive.
- For agents that must write concurrently, consider per-agent archive shards and periodic merge/sync.

## Observability & diagnostics
- Log every injection and capture with structured metadata: runId, agentId, query, selected frames (archive/frameIndex/uri), scores, and duration.
- Provide tools: `memvid_raw`, `memvid_forget`, `memvid_stats`, and an `audit` view showing injection history.
- Track metrics: recall precision (human or automatic labels), latency, capacity growth, enrich job durations.

## Governance & privacy
- Implement `memvid_forget` reachable from UI/CLI that deletes frames by uri/frame_id and supports audit trails.
- Provide PII detectors at capture time (redact or mark sensitive frames) and automated tests for forget correctness.

## Migration & fallback
- Migration tool: import existing session jsonl into memvid frames with mapping rules (session turn → frame with metadata).
- Fallback path: if memvid is unavailable, use legacy session-based memory so agents remain operational.

## Risk matrix (quick)
- Retrieval errors: incorrect frames injected → medium risk. Mitigation: conservative thresholds, provenance, logging, human review.
- Over-injection (token budget blowup): high risk. Mitigation: token budgeting, compaction, rate limits.
- Data loss (buggy delete or ticket misuse): high risk. Mitigation: backups, dry-run delete, confirmations, audit logs.
- Concurrency corruption: medium risk. Mitigation: tickets, per-agent shards, nudge/lock diagnostics.
- Cost growth (storage/enrichment): medium risk. Mitigation: monitoring, budget caps, alerting.

## Short‑term implementation plan (concrete tasks)
1. Finalize canonical frame schema (this doc is the draft). Merge with plugin schema and config.
2. Add preferredId (done) and ensure all tools return both numeric frameIndex and uri (done).
3. Improve `memvid_view` to accept uri/frame-index and return full parsed JSON in details (done).
4. Add memvid_raw diag tool (done).
5. Implement injection policies: token-budgeting, score thresholds, recency filters.
6. Add instrumentation: structured logs for injection/capture + metrics.
7. Migration tool: session -> memvid import script.
8. CI/Unit tests for forget/repair/enrich flows, and end-to-end smoke tests.

## Longer‑term roadmap
- Distillation/enrichment pipeline: scheduled jobs to create compressed summaries and embeddings.
- Hierarchical memory: short-term buffer (session), medium-term distilled frames, long-term archives.
- Multi-agent coordination: per-agent shards, shared archives, and job orchestration for long-running workflows.
- UI integrations: surfacing provenance and confidence, manual forget, and editorial overrides.

## Open questions
- What token budget should we default to for injected context? (e.g., 2–4k tokens)
- What are safe default thresholds for auto-expansion and auto-capture frequency?
- Do we want per-agent archives by default, or a single shared archive with tags? Tradeoffs exist.

---

If you reset the session, I’ll pick up where we left off when you return. I can also split this plan into multiple tracked issues/PRs if you want a work plan for CI and review.
