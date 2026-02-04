08 — Migration & UI Integrations

Goal
Provide migration tooling from legacy session jsonl into memvid frames and add UI endpoints for inspect/forget/manually promote frames to shared archive.

Tasks

- Implement migration script with dry-run mode to map session JSONL -> frames (distilled + raw session-archive).
- Add CLI and small HTTP endpoints for:
  - Inspect frame provenance (masked preview + metadata).
  - Request memvid_forget (dry-run and execute) with audit logging.
  - Promote frame(s) from per-agent archive to shared archive (with deduplication checks).
- Add documentation pages for operators: how to run migration, review promotions, and run forgets.

Acceptance criteria

- Migration script converts sample session exports and includes a dry-run report listing frames and estimated capacity.
- UI endpoints return masked previews by default; raw view requires elevated permissions.

Notes

- Promotion to shared archive should require review or automated filters (score/flag) to avoid pollution.
- After implementation, move this file to ../completed/ with commit/PR reference.
