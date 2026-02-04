# About Memvid

## Approach

https://docs.memvid.com/introduction/the-memvid-approach

## Graph Search and Logic Mesh

https://docs.memvid.com/concepts/graph-search

## Entity Extraction

**_Supports ollama / local AI models. Horizon goal._**

https://docs.memvid.com/concepts/entity-extraction

## Session Replay

**_This is how we should be storing session data on lifecycle hooks_**

https://docs.memvid.com/concepts/time-travel-replay

## Enrichment and Memory Cards

**_Prefer Candle_**
Powerful memory association without context bloat

https://docs.memvid.com/concepts/memory-cards

# Media Processing

## PDF Table extraction (low priority integration)

https://docs.memvid.com/concepts/table-extraction

## Audio and Video Processing

**_Prefer Whisper Large_**
https://docs.memvid.com/concepts/audio-video

## Visual Embeddings with Clip

**\*May require the use of the rust library, I have the Memvid project cloned already. It's pure Rust, now, super fast.**

https://docs.memvid.com/concepts/visual-embeddings

# Embeddings

## Embedding Models

https://docs.memvid.com/concepts/embedding-models

## Local Models with Ollama

**_Prefer Qwen 2.5:3b_**

https://docs.memvid.com/concepts/local-models

# Security and Limits

## Encryption

https://docs.memvid.com/concepts/encryption

## PII Masking

https://docs.memvid.com/concepts/pii-masking

## Rate Limits

**_Useful for understanding filter patterns, we don't track with an API key. No limits will apply._**

https://docs.memvid.com/concepts/query-usage

```bash
# Use vector compression for 16x compression
memvid put knowledge.mv2 --input docs/ --vector-compression
```

## Performance Tuning

https://docs.memvid.com/concepts/performance-tuning

# Memvid Cli References`

## Cli Reference

https://docs.memvid.com/cli

## Cli Cheatsheet

https://docs.memvid.com/cli/cheat-sheet

## Create and Ingest

https://docs.memvid.com/cli/create-and-put

## Search and Ask

https://docs.memvid.com/cli/search-and-ask

## Timeline View and Stats

https://docs.memvid.com/cli/timeline-and-view

## Tickets and Capacity

**_Purely for information, we already have a strong implementation_**
https://docs.memvid.com/cli/tickets-and-capacity

## Maintenance and Repair

https://docs.memvid.com/cli/maintenance-and-tickets

## Advanced CLI Commands

https://docs.memvid.com/cli/advanced-commands

```

```
