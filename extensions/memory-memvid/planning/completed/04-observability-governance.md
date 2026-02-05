04 — Observability & Governance

Goal
Add structured logging, audit trails, forget workflows, and PII masking conventions.

Tasks

- Implement structured logs for injection/capture events: runId, agentId, frames, scores, latency, decision reasons.
- Integrate memvid.mask_pii at the presentation layer; default production behavior: mask_pii=True.
- Implement memvid_forget integration with dry-run and audit logging; add CLI/endpoint hooks for manual forget requests.
- Add audit view that lists injections and captures with timestamps and masked previews.
- Add unit/integration tests for forget/repair flows and masking behavior.

Acceptance criteria

- Logs emitted for every injection/capture with required fields.
- UI endpoints return masked outputs by default; raw outputs require elevated permissions.
- memvid_forget dry-run returns affected frames and does not modify data.

Notes

- Always log that masking was applied when returning masked results to users.
- After implementation, move this file to ../completed/ with commit/PR reference.
