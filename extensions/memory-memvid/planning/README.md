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

If you need to change the order, create a new planning file with the next sequence number and link back to this README.
