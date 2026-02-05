memory-memvid — src/ README

Purpose

This README summarizes the source layout for the memory-memvid plugin and documents the public API surface of the MemvidClient class so new maintainers can onboard quickly.

Directory layout

- src/
  - MemvidClient.ts — Core CLI wrapper client. Primary integration point for invoking the memvid binary and performing archive operations.
  - cli/ — CLI command registration that exposes memvid operations via OpenClaw's CLI integration (commands defined in cli.ts).
  - tools/ — Tool adapters that register small runtime tools with OpenClaw (archive_session, memvid_search, memvid_ask, memvid_store, memvid_timeline, memvid_view, memvid_enrich, memvid_stats, memvid_forget, memvid_repair, capacity_check, capacity_expand, memvid_raw).
  - schema/ — JSON/TypeBox schema artifacts used for config validation and any schema-driven data structures.
  - types/ — TypeScript types and interfaces shared across the plugin (ArchiveInfo, SearchResult, Stats, etc.).
  - utils/ — Helper utilities (config merging, environment variable resolution, simple capture heuristics, etc.).

High-level responsibilities

- MemvidClient.ts is a thin but opinionated wrapper around the memvid CLI. It spawns subprocesses, streams/logs output, parses JSON results when provided by the CLI, and offers higher-level functions used by the plugin and tools.
- cli/ converts plugin API + client methods into user-facing CLI commands (memvid create|search|ask|store|timeline|view|stats|enrich|repair|vacuum|capacity|tickets...).
- tools/ expose programmatic operations to OpenClaw runtime as tools (used by other agents or flows).
- utils/ contains mergeConfig, shouldCapture, and other helpers used by the plugin entrypoint (index.ts) and MemvidClient.

MemvidClient — public API

Constructing

- new MemvidClient(memvidPath: string, archivesDir: string, apiKey: string, capacityThreshold: number, logger?: OpenClawPluginApi['logger'])

Key methods (async unless noted)

- getArchivesDir(): string
- getCliPath(): string
- validateArchiveDir(archive: string): string
- createArchive(name: string): Promise<string>
- listArchives(): Promise<ArchiveInfo[]>
- ensureArchive(name: string): Promise<string>
- put(archivePath: string, content: string, metadata?: Record<string, unknown>): Promise<string>
  - Streams content to memvid put via stdin; returns frame id.
- search(query: string, archivePath?: string, limit?: number): Promise<SearchResult[]>
- ask(question: string, archivePath?: string): Promise<string>
- timeline(archivePath: string, options?: TimelineOptions): Promise<TimelineEntry[]>
- view(archivePath: string, idOrUri: string): Promise<Entry>
- stats(archivePath: string): Promise<Stats>
- enrich(archivePath: string, engine?: string): Promise<void>
- delete(archivePath: string, frameId: string): Promise<void>
- repair(archivePath: string): Promise<void>
- vacuum(archivePath: string): Promise<void>
- issueTicket(archivePath: string, options: IssueTicketOptions): Promise<void>
- listTickets(archivePath: string): Promise<TicketInfo>
- revokeTicket(archivePath: string): Promise<void>
- checkCapacity(archivePath: string): Promise<CapacityInfo>
- expandCapacity(archivePath: string, newSizeBytes: number): Promise<void>

Configuration & scheduler notes

The plugin exposes configuration keys (see src/types/types.ts and CONFIG.md) including capacity and scheduler tuning options:

- capacityThresholdPercent (default 85) — percent usage that triggers expansion logic
- manualConfirmBytes (default 10GB) — if recommended expansion exceeds this many bytes, operator confirmation is required
- schedulerInitialBackoffMs (default 3600000 ms) — initial backoff used by scheduler
- schedulerMaxBackoffMs (default 604800000 ms) — maximum backoff
- schedulerMaxRetries (default 8) — maximum retry attempts

See CONFIG.md at the repo root for a short summary and planning/05-tickets-cron-examples.md for scheduler invocation examples.

Internal helpers (not intended for external callers)

- exec(args: string[], archivePath?: string): Promise<string> — low-level spawning with streaming/logging
- checkAndExpandCapacity(archivePath: string): Promise<void> — checks ticket usage and auto-expands if threshold exceeded

Behavioral notes and assumptions

- The client assumes a memvid binary is available at memvidPath and that the CLI outputs JSON for commands where --json is used. It is defensive about parsing and logs raw output when parsing fails.
- put() and exec() stream child process stdout/stderr to the injected logger. This makes testability easier when memvidPath is an echo or similar shim.
- Capacity management relies on the memvid ticket APIs; the client auto-issues an expanded ticket when usage crosses the configured threshold — automatic expansion is allowed by default but can be tuned via config.
- Many media and extraction features in memvid are CLI-first; MemvidClient intentionally embraces invoking the CLI rather than re-implementing ingestion logic.

Testing tips

- Tests can safely use a benign command (e.g., echo) as memvidPath to validate command construction and basic flows.
- For behavior that depends on parsed JSON, provide mocked stdout JSON or run the real memvid CLI in an integration environment.
- Unit tests should mock spawn for error cases (non-zero exit, stderr output) to ensure client logs and errors behave correctly.

Contributing notes

- Consider moving CLI/tool registration into MemvidClient to reduce global wiring in index.ts and make unit testing simpler.
- Add more unit tests around exec(), put(), and checkAndExpandCapacity.
- Keep CLI-first features invoked through the client to preserve single responsibility and consistent logging.
