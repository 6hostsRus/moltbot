05 — Tickets & Capacity Controls — Local TODO Checklist

Goal: Wire memvid ticket flows, auto-expand guardrails, and monitoring alerts.

Status: IN PROGRESS

Tasks to implement (local tracking):

- [x] Create checklist and scaffolding files (this file)
- [x] Add CLI commands: memvid tickets sync, memvid tickets apply (stubs + implementation)
- [x] Add unit tests for tickets sync/apply (mock memvidClient)
- [x] Add monitoring scripts: scripts/memvid_tickets_monitor.sh and scripts/memvid_tickets_monitor.js
- [x] Add example cron entries and CI-friendly job wrapper (toggleable via config)
- [ ] Implement auto-expand guard logic (85% threshold, exponential backoff)
- [ ] Add unit tests for auto-expand guard (thresholds, backoff, manual-confirm >10GB/day)
- [ ] Add toggleable installer stub: scripts/install_tickets_setup.sh (interactive, does NOT run automatically)
- [ ] Document configuration options in src/utils/config.ts and README
- [ ] Move planning/05-tickets-capacity.md to planning/completed/ after acceptance

Notes / decisions for later:

- Defaults: threshold=85%, manual_confirm_threshold_bytes=10\*1024^3 (10GB), backoff initialDelay=1hr, maxDelay=7days
- Monitoring disabled by default; installer will offer opt-in and interactive guidance
- All automated apply actions are disabled by default; users must opt into auto-expand and confirm high-volume expansion
