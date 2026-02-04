#!/usr/bin/env bash
# Example: create an archive and store a simple text frame
# Requires memvid CLI installed and on PATH
set -euo pipefail

ARCHIVE_NAME="example-memory.mv2"
MEMVID="memvid"

# Create archive
$MEMVID create "$ARCHIVE_NAME"

# Store a short note
printf "%s" "Meeting note: discuss memvid integration" | $MEMVID put "$ARCHIVE_NAME" --metadata '{"source":"example"}'

# List timeline
$MEMVID timeline "$ARCHIVE_NAME"

# Enrich with groq
$MEMVID enrich "$ARCHIVE_NAME" --engine groq

# Search
$MEMVID find "$ARCHIVE_NAME" --query "meeting"
