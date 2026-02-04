05 — Tickets & Capacity Controls

Goal
Wire memvid ticket flows, auto-expand guardrails, and monitoring alerts.

Tasks

- Implement ticket sync/apply flows using memvid CLI or SDK (memvid tickets sync/apply).
- Implement auto-expand guard: trigger when usage >= 85%; auto-issue only with exponential backoff and operator alerting.
- Require explicit manual confirmation for auto-expansion above 10 GB/day (configurable).
- Add monitoring scripts that call memvid tickets list and alert when usagePercent > threshold.
- Add tests for capacity-exceeded behavior and safe fallback (create new memory file or purge strategies).

Acceptance criteria

- Tickets can be applied/synced programmatically.
- Auto-expand guard triggers alerts and respects manual confirmation rules.
- Monitoring scripts run in CI/cron and emit alerts to the ops channel.

Notes

- Defaults: 85% threshold, 10 GB/day manual-confirm threshold.
- After implementation, move this file to ../completed/ with commit/PR reference.
