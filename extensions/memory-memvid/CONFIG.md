Memvid Plugin Configuration (summary)

This file summarizes important configuration keys and environment variables used by the memory-memvid plugin.

Config keys (in plugin config / MemvidConfig):

- memvidPath (string) — path to the memvid CLI binary. Default: "memvid".
- archivesDir (string) — directory for .mv2 archives. Default: "~/.openclaw/memory/archives".
- apiKey (string) — API key for cloud enrichment (optional). Default: "".
- enrichmentEngine (string) — one of: basic, candle, cloud. Default: basic.
- autoCapture (boolean) — capture automatically. Default: true.
- autoRecall (boolean) — inject memories automatically. Default: true.
- autoArchiveSessions (boolean) — auto archive sessions. Default: true.
- sessionArchiveThresholdMB (number) — threshold in MB for auto-archiving. Default: 10.
- ticketSource (string) — 'self-hosted' or 'cloud'. Default: 'self-hosted'.
- ticketIssuer (string) — issuer name for self-hosted tickets. Default: 'openclaw.local'.
- autoExpandCapacity (boolean) — allow automatic expansion. Default: true.
- capacityThresholdPercent (number) — trigger threshold for capacity (usage percent). Default: 85.
- manualConfirmBytes (number) — if recommended expansion > this many bytes, require manual confirmation. Default: 10GB.
- schedulerInitialBackoffMs (number) — initial backoff interval for scheduler retries (ms). Default: 1 hour.
- schedulerMaxBackoffMs (number) — maximum backoff interval (ms). Default: 7 days.
- schedulerMaxRetries (number) — maximum retry attempts. Default: 8.

Environment variables (overrides / runtime flags):

- MEMVID_API_KEY — can be referenced in apiKey with ${MEMVID_API_KEY}.
- MEMVID_AUDIT_LOG — path to JSON-lines audit log (default: ~/.openclaw/memvid-audit.log).
- MEMVID_SCHEDULER_STATE — override default scheduler state file path (default: ~/.openclaw/memvid-scheduler.json).
- MEMVID_ELEVATED — set to '1' to allow elevated CLI scheduler actions without --elevated flag.
- MEMVID_STREAM_OUTPUT — set to '0' to disable streaming subprocess output to stdout/stderr.

Notes

- Defaults are defined in src/types/types.ts DEFAULT_CONFIG.
- You can reference environment variables inside string config values using ${VAR_NAME} (resolved by resolveEnvVars()).
- The scheduler and guard use the config defaults; you can override thresholds and backoff timing via plugin config or environment as appropriate.

Operational guidance

- By default automatic expansion is allowed; the guard will recommend sizes and require manual confirmation when the recommended expansion exceeds manualConfirmBytes.
- Scheduler state is stored on disk; schedule runDueJobs periodically (cron or systemd timer). See planning/05-tickets-cron-examples.md for examples.
