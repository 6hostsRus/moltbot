Memvid Integration — Planning Documents

This directory contains the ordered planning documents for integrating Memvid as OpenClaw's long-term memory. Files are numbered to indicate the recommended sequence of work. When the actions in a planning file have been completed, move that file to the `completed/` subdirectory and mark the PR/commit that implements the changes.

Structure (work in order):

1.  01-canonical-frame.md
2.  02-retrieval-injection.md
3.  03-capture-compaction.md
4.  04-observability-governance.md
5.  05-tickets-capacity.md
6.  06-session-replay-ci.md
7.  07-enrichment-pipeline.md
8.  08-migration-ui.md

Instructions to self (agent):

- Follow the numbered sequence above.
- For each file: implement the tasks listed, add commits/PRs in your fork, run tests.
- Once the actions in a file are successfully completed, move the file to `completed/` and leave a short NOTE at the top indicating the commit/PR reference and date.
- If a document depends on external docs or decisions, add the links and tag @owner for review.
- check to see if a file exists before generating it.

Defaults & agreed decisions (as of 2026-02-04):

- Injection token budget default: 3000 tokens.
- Hybrid architecture: per-agent session memory + shared team archive.
- Auto-expand guard: trigger at 85% usage; require manual confirmation for >10 GB/day growth.
- Production UIs: default to mask_pii=True for user-facing outputs; retain raw frames for internal/ops use and replay.

Implementation note:

- Double-check memory-memvid/readme.md for consolidated implementation instructions, CLI flags, and SDK notes before starting any coding or infra changes.

Project overview (current state)

- Entry point: index.ts exports the OpenClaw plugin. It parses plugin config, constructs a MemvidClient, registers tools and a CLI, and installs lifecycle hooks (auto-recall, auto-capture, and session archiving).

- Core client: src/MemvidClient.ts is a robust CLI wrapper around the memvid binary. Key responsibilities:
  - Exec wrapper that spawns memvid subprocesses, streams stdout/stderr to the injected logger, and optionally streams to process stdout/stderr when running locally.
  - High-level operations: createArchive, ensureArchive, put (streams content via stdin), find/search, ask, view, timeline, stats, enrich, delete, repair, vacuum, tickets management, and capacity checking/auto-expansion.
  - Capacity management: reads ticket info and will attempt to auto-issue a new ticket (double capacity) when usage exceeds the configured threshold.

- Project layout (src/)
  - src/cli: CLI command registration (plugin CLI integration).
  - src/tools: registered OpenClaw tools that expose memvid operations to the runtime.
  - src/types: TypeScript types and interfaces used across the plugin.
  - src/utils: helper utilities (config merging, shouldCapture, etc.).
  - src/schema: config/schema artifacts.

- Current behavior implemented in plugin
  - Auto-recall: on before_agent_start, runs a memvid search with the incoming prompt and prepends relevant memories into agent context when results exist.
  - Auto-capture: on agent_end, extracts user/assistant text blocks (handles block arrays), filters with shouldCapture, and writes up to 3 frames to default-memory.mv2.
  - Session archiving: on agent_end when autoArchiveSessions enabled, reads the session JSONL file (if large enough), converts turns to frames and archives them into default-sessions.mv2.
  - Service registration: plugin registers a long-running service that verifies memvid CLI availability, creates archives dir, and logs discovered archives on start.

- Notable implementation details / assumptions
  - Memvid CLI is required on PATH or configured memvidPath; MemvidClient spawns the binary directly.
  - put() streams content via child_process stdin to memvid put. exec() builds commands carefully and parses JSON outputs from CLI where available.
  - Many features assume CLI stability and JSON output formats (there is defensive parsing to handle alternate formats).
  - Some SDK-level features in the memvid docs (tables, media ingestion) are CLI-first; this client embraces that pattern.

- Tests and extras
  - index.test.ts exists at repo root and contains tests (review to run locally). There are no GitHub issue workflows expected — planning and coordination are done inside this fork.

- TODOs and recommended next tasks (short-term)
  1. Add a short README in src/ describing each subdirectory and public API of MemvidClient to help new maintainers.
  2. Move tool/CLI registration into MemvidClient (considered in code TODO) for clearer separation and easier testability.
  3. Add unit tests for MemvidClient.exec and put to simulate subprocess outputs (use child_process spawn mocks).
  4. Harden error handling around parsing memvid JSON outputs (more defensive checks and test vectors).
  5. Add integration/example scripts that show: creating an archive, ingesting a small text blob, running enrich, and performing a find/ask. These are useful CI smoke tests.
  6. Document expected memvid binary version or add a --version check with clearer error messaging and upgrade guidance.

If you need to change the order, create a new planning file with the next sequence number and link back to this README.
