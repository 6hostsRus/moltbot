Memory-Memvid Integration — Reference

This document consolidates the Memvid docs linked from the project root README and groups the implementation-relevant information by target: CLI (primary), Python SDK, and Node.js / TypeScript SDK. Use this as the single source of truth for implementation details, flags, and recommended defaults.

Summary (high level)

- Memvid is a local-first memory system built around .mv2 files containing multi-index frames (lexical BM25, vector embeddings, SimHash, logic mesh, time index).
- Preferred local components: BGE-small (embeddings), Whisper (audio transcription), Candle (local LLM for enrichment), MobileCLIP for visual embeddings; Ollama for running local LLMs (Qwen recommended).
- Key features: Logic Mesh (entity/relationship graphs), Memory Cards (enriched facts), Session Replay (frozen context + audit), PII masking, Encryption (.mv2e), table extraction, audio/video processing, visual embeddings.

Recommended defaults for this project

- Primary interface: memvid CLI (fastest, most stable for media, table extraction, and some features that are CLI-only).
- Embeddings: local BGE-small by default, with easy opt-in for OpenAI/NVIDIA via flags.
- Enrichment: use groq or candle for production; rules for quick dev tests. Prefer Candle for local runs where feasible.
- Session recording: use session start/end and audit replay for reproducible tests.
- Security: use memvid lock/unlock for encrypted capsules; enable mask_pii=True for user-facing UIs.

Organized reference — CLI (primary)

- Install / basic operations
  - Install: npm install -g memvid-cli or cargo/Homebrew as documented on memvid site.
  - Create a memory file: memvid create my-memory.mv2
  - Put/ingest files: memvid put my-memory.mv2 --input ./docs/ [--embedding] [--tables] [--extract-frames] [--clip-embeddings] [--whisper-model <model>]
  - Seal and stats: memvid seal <file>; memvid stats <file>

- Embeddings & vector index
  - Enable embeddings: memvid put <file> --embedding [-m <provider|model>] [--vector-compression]
  - Default local embedder: bge-small; to use OpenAI: -m openai (requires OPENAI_API_KEY).
  - Vector compression: memvid put ... --vector-compression (PQ based, ~16x compression).

- Logic Mesh / Graph
  - Enable during ingestion: memvid put memory.mv2 --input docs/ --logic-mesh
  - Enrich existing memory: memvid enrich memory.mv2 --engine groq
  - Traversal and graph queries: memvid follow traverse <file> --start "Entity" --link "relation" --hops N
  - Export graph: memvid export <file> --format ntriples|json|csv

- Memory Cards / Enrichment
  - Enrich: memvid enrich memory.mv2 --engine <rules|candle|groq|openai|claude|gemini>
  - List memory cards: memvid memories memory.mv2 [--json]
  - Get current state for an entity: memvid state memory.mv2 --entity "Name"
  - Schema management: memvid schema infer|list|set

- Sessions & Replay
  - Record: memvid session start <file> --name "..." ... memvid session end <file>
  - View/list: memvid session list <file>; memvid session view <file> --session <id>
  - Replay: memvid session replay <file> --session <id> [--audit|--adaptive|--use-model <model>|--diff]
  - Useful flags: --audit (frozen frames), --diff (compare models), --skip-asks/--skip-finds

- Audio/Video & Tables (CLI-only features)
  - Audio/video ingestion with transcription: memvid put <file> --language <lang> --whisper-model <model>
  - Frame extraction & CLIP: memvid put <file> --extract-frames --clip-embeddings --frame-interval <s>
  - Table extraction from PDFs: memvid tables import|list|view|export with --mode {conservative|balanced|aggressive}, --min-quality, --embed-rows
  - Table SDK support: currently CLI-only (use subprocess/child_process as workaround)

- Security & PII
  - Encryption: memvid lock <file> --out <file.mv2e> and memvid unlock <file.mv2e> --out <file>
  - PII masking on output: memvid ask ... --mask-pii or mem.find ... --mask-pii

- Rate limits & query usage
  - If using API keys, plan-based monthly quotas and per-minute rate limits apply; local/no-key use skips tracking.
  - Check plan: memvid plan show; sync: memvid plan sync

- Maintenance & doctoring
  - Rebuild indexes: memvid doctor <file> --rebuild-vec-index or --rebuild-logic-mesh
  - Repair/maintenance: memvid doctor/maintenance commands as needed

Organized reference — Python SDK

- Install and basic use
  - from memvid_sdk import create or from memvid import use
  - mem = create('my.mv2', enable_vec=True, enable_lex=True) or mem = use('basic', 'my.mv2')
  - mem.put(...), mem.put_many(...), mem.find(...), mem.ask(...), mem.enrich(...), mem.session_start/ end/ replay

- Embeddings & providers
  - Use embedder objects: from memvid_sdk.embeddings import OpenAIEmbeddings, CohereEmbeddings, NvidiaEmbeddings, get_embedder
  - Pass embedder to mem.put_many(..., embedder=embedder) and to mem.find(..., embedder=embedder)
  - Local embeddings: built-in BGE-small default; enable vector_compression=True when needed

- Logic Mesh & Entities
  - Entity extractor: from memvid_sdk.entities import get_entity_extractor
  - mem.put(..., logic_mesh=True) or mem.enrich(engine='groq')
  - mem.get_entities(), mem.traverse(...), mem.get_entity_state(entity)

- Memory Cards & Enrichment
  - mem.enrich(engine='groq'|'candle'|'rules'|...) with --force and parallel worker options available via CLI flags or SDK parameters
  - mem.get_facts(entity=...), mem.get_preferences(...), mem.get_memory_timeline(...)

- Sessions & Replay
  - session_id = mem.session_start('name'); result = mem.ask('question', model='openai:gpt-4o-mini'); mem.session_end(); mem.session_replay(session_id, audit=True, use_model='claude:...')

- Audio/Video & Tables
  - Audio/video ingestion is currently CLI-first; transcriptions and frame metadata are available via SDK reads after CLI ingestion. Use subprocess to run CLI ingestion in automation.

Organized reference — Node.js / TypeScript SDK

- Install / basic use
  - import { create, use } from '@memvid/sdk'
  - const mem = await create('my.mv2') or await use('basic', 'my.mv2')
  - await mem.put(...), await mem.find(...), await mem.ask(...), await mem.enrich(...)

- Embeddings
  - Use embedder classes in @memvid/sdk (OpenAIEmbeddings, NvidiaEmbeddings, CohereEmbeddings). Pass embedder in options to putMany/find.

- Logic Mesh & Entities
  - const ner = getEntityExtractor('openai', { entityTypes: [...] }); await mem.put({ content, logicMesh: true }); await mem.getEntities(); await mem.traverse({ start, link, hops })

- Sessions & Replay
  - const sessionId = await mem.sessionStart('name'); const res = await mem.ask('q', { model: 'ollama:qwen2.5:1.5b' }); await mem.sessionEnd(); await mem.sessionReplay(sessionId, { audit: true, useModel: 'gemini:...' })

- Notes on feature parity
  - CLI-first features: table extraction, audio/video ingestion, some media processing and tools are CLI-only or CLI-primary. Plan to use the CLI from code (child_process/subprocess) where necessary until SDK support lands.

Implementation notes & actionables for this repo

- Primary work should implement CLI-driven ingestion and maintenance flows first (tables, media, encryption, enrichment). Use the Node/Python SDK for read/query flows where available.
- Defaults for our codebase:
  - Use local embeddings (bge-small) unless OPENAI_API_KEY is set and explicitly requested.
  - Enrichment pipeline: rules -> groq (balanced) -> claude (high-quality, opt-in via env API keys)
  - Use memvid lock/unlock for storing any sensitive memory files in backups.
  - For session replay + CI: record sessions for critical tests and store session IDs in test artifacts for reproducibility.

References (source links consolidated)

- Introduction & approach: https://docs.memvid.com/introduction/the-memvid-approach
- Graph Search / Logic Mesh: https://docs.memvid.com/concepts/graph-search
- Entity Extraction: https://docs.memvid.com/concepts/entity-extraction
- Session Replay: https://docs.memvid.com/concepts/time-travel-replay
- Memory Cards / Enrichment: https://docs.memvid.com/concepts/memory-cards
- Table extraction: https://docs.memvid.com/concepts/table-extraction
- Audio/Video: https://docs.memvid.com/concepts/audio-video
- Visual embeddings: https://docs.memvid.com/concepts/visual-embeddings
- Embedding models: https://docs.memvid.com/concepts/embedding-models
- Local models (Ollama): https://docs.memvid.com/concepts/local-models
- Encryption: https://docs.memvid.com/concepts/encryption
- PII masking: https://docs.memvid.com/concepts/pii-masking
- Query usage & limits: https://docs.memvid.com/concepts/query-usage

Next steps

1. Review this consolidated reference and confirm any organization-specific deviations (e.g., different default models or limits).
2. Implement CLI ingestion tests (tables, audio/video) and a basic enrichment pipeline using groq/candle.
3. Check planning/README.md for integration steps and move planning files forward as tasks complete.

---

Generated: 2026-02-04 — source: memory-memvid/README.md links (consolidated)
