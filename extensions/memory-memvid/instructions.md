# OpenClaw Memory-Memvid Plugin Development Instructions

## Overview

Build a comprehensive OpenClaw plugin that integrates [Memvid](https://docs.memvid.com/), a self-hosted, self-growing memory system that doesn't rely on massive infrastructure. This plugin should expose all Memvid CLI functionality as OpenClaw tools, CLI commands, and provide auto-recall/auto-capture capabilities similar to the memory-lancedb reference plugin.

## Reference Plugin Structure

Study `/Users/Learn/Projects/_local_clones/moltbot/extensions/memory-lancedb/` for patterns:

- **Plugin metadata**: `openclaw.plugin.json` defines plugin ID, kind, UI hints, and config schema
- **Package structure**: `package.json` with dependencies, devDependencies (openclaw as workspace:\*), and openclaw.extensions array
- **Main implementation**: `index.ts` exports default plugin object with register() function
- **Configuration**: Separate `config.ts` for schema validation and defaults
- **Testing**: `index.test.ts` for unit tests

## External References

### Core CLI Documentation

- **Main CLI**: https://docs.memvid.com/cli
- **CLI Cheat Sheet**: https://docs.memvid.com/cli/cheat-sheet
- **Create and Ingest**: https://docs.memvid.com/cli/create-and-put
- **Search and Ask**: https://docs.memvid.com/cli/search-and-ask
- **Timeline, View, Stats**: https://docs.memvid.com/cli/timeline-and-view
- **Tickets and Capacity**: https://docs.memvid.com/cli/tickets-and-capacity (focus on self-hosted tickets)
- **Maintenance and Repair**: https://docs.memvid.com/cli/maintenance-and-tickets
- **Advanced Commands**: https://docs.memvid.com/cli/advanced-commands (especially `enrich` command)

## Key Integration Points with OpenClaw

### Memory-Core Plugin Interaction

The `memory-core` plugin provides session-based memory search via:

- `memory_search` - Search through session transcripts (`.jsonl` files)
- `memory_get` - Retrieve specific memory entries
- CLI commands under `openclaw memory`

**Important**: The memory-memvid plugin should **complement** memory-core by:

1. **Auto-archiving sessions to .mv2**: When sessions complete or reach size thresholds, archive them into Memvid archives
2. **Searching across archived sessions**: Enable semantic search across both active sessions (via memory-core) and archived sessions (via memvid)
3. **Default to archive for explicit saves**: When users explicitly save information (e.g., "remember this"), store in Memvid archives, not just session logs

### Session → Archive Flow

```
User conversation → Session .jsonl → Auto-archive to .mv2 → Searchable via memvid
                                   ↓
                          Ticket created (1GB cap)
                          Auto-expand when approaching limit
```

## Plugin Requirements

### 1. File Structure

Create these files in `/Users/Learn/Projects/_local_clones/moltbot/extensions/memory-memvid/`:

```
memory-memvid/
├── package.json
├── openclaw.plugin.json
├── index.ts
├── config.ts
├── index.test.ts
└── instructions.md (this file)
```

### 2. package.json

```json
{
     "name": "@openclaw/memory-memvid",
     "version": "2026.2.1",
     "description": "OpenClaw Memvid-backed self-hosted memory plugin with auto-recall/capture",
     "type": "module",
     "dependencies": {
          "@sinclair/typebox": "0.34.48"
     },
     "devDependencies": {
          "openclaw": "workspace:*"
     },
     "openclaw": {
          "extensions": ["./index.ts"]
     }
}
```

**Important**: Memvid is a CLI tool, so we'll spawn child processes to execute commands. No direct npm dependency needed.

### 3. openclaw.plugin.json

Define plugin metadata with:

- **id**: `"memory-memvid"`
- **kind**: `"memory"`
- **uiHints**: Configuration UI hints for:
     - `memvidPath`: Path to memvid CLI binary (with placeholder like `/usr/local/bin/memvid`)
     - `archivesDir`: Path to directory containing .mv2 archive files (default `~/.openclaw/memory/archives`)
     - `apiKey`: Optional API key for cloud enrichment (sensitive: true)
     - `enrichmentEngine`: Choice of enrichment engine (basic, candle, cloud) - default: `basic`
     - `autoCapture`: Boolean for auto-capture (default: true)
     - `autoRecall`: Boolean for auto-recall (default: true)
     - `autoArchiveSessions`: Boolean to auto-archive completed sessions (default: true)
     - `sessionArchiveThresholdMB`: Size threshold for auto-archiving sessions (default: 10)
     - `ticketSource`: Choice between cloud/self-hosted tickets - **default: `self-hosted`**
     - `ticketIssuer`: Issuer name for self-hosted tickets (default: `openclaw.local`)
     - `autoExpandCapacity`: Boolean to auto-expand archive capacity when approaching limit (default: true)
     - `capacityThresholdPercent`: Percentage threshold to trigger auto-expand (default: 80)
- **configSchema**: JSON schema with `type: "object"`, `additionalProperties: false`, properties matching uiHints

### 4. config.ts

```typescript
{
CreatarchivesDir?: string;
apiKey?: string;
enrichmentEngine?: 'basic' | 'candle' | 'cloud';
autoCapture?: boolean;
autoRecall?: boolean;
autoArchiveSessions?: boolean;
sessionArchiveThresholdMB?: number;
ticketSource?: 'cloud' | 'self-hosted';
ticketIssuer?: string;
autoExpandCapacity?: boolean;
capacityThresholdPercent?: number;
};

```

- **Schema validator**: `memvidConfigSchema.parse()` function
- **Default values**:
     - `archivesDir`: `~/.openclaw/memory/archives`
     - `enrichmentEngine`: `basic`
     - `autoCapture`: `true`
     - `autoRecall`: `true`
     - `autoArchiveSessions`: `true`
     - `sessionArchiveThresholdMB`: `10`
     - `ticketSource`: `self-hosted`
     - `ticketIssuer`: `openclaw.local`
     - `autoExpandCapacity`: `true`
     - `capacityThresholdPercent`: `80`
- **Environment variable resolution**: Support `${VAR_NAME}` syntax like lancedb plugin
- **Path resolution**: **Use `api.resolvePath()` from OpenClawPluginApi** - do NOT create custom path resolution helper

- **Schema validator**: `memvidConfigSchema.parse()` function
- **Default values**: Use `~/.openclaw/memory/memvid` for dbPath, `basic` for enrichment
- **Environment variable resolution**: Support `${VAR_NAME}` syntax like lancedb plugin
- **Path resolution**: Helper to resolve `~` and relative paths

### 5. index.ts - Main Plugin Implementation

#### 5.1 Core Structure

```typescript
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { stringEnum } from 'openclaw/plugin-sdk';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const memvidPlugin = {
     id: 'memory-memvid',
     name: 'Memory (Memvid)',
     description:
          'Self-hosted Memvid-backed long-term memory with auto-recall/capture',
     kind: 'memory' as const,
     configSchema: memvidConfigSchema,

     register(api: OpenClawPluginApi) {
          // Implementation here
     },
};

export default memvidPlugin;
```

#### 5.2 Memvid CLI Wrapper Class

Create a `MemvidClient` class that wraps CLI operations:

```typescript
class MemvidClient {
     constructor(
          private memvidPath: string,
          private archivesDir: string,
          private apiKey?: string,
          private logger?: OpenClawPluginApi['logger']
     ) {}

     private async exec(args: string[], archivePath?: string): Promise<string> {
          // Build command
          // If archivePath provided, ensure it's in archivesDir
          // Execute and return stdout
          // Handle errors with meaningful messages
     }

     // Archive management
     async createArchive(name: string): Promise<string>;
     async getArchiveInfo(archivePath: string): Promise<ArchiveInfo>;
     async listArchives(): Promise<ArchiveInfo[]>;

     // Core operations
     async put(
          archivePath: string,
          content: string,
          metadata?: Record<string, any>
     ): Promise<string>;
     async search(
          query: string,
          archivePath?: string,
          limit?: number
     ): Promise<SearchResult[]>;
     async ask(question: string, archivePath?: string): Promise<string>;
     async timeline(
          archivePath: string,
          options?: TimelineOptions
     ): Promise<TimelineEntry[]>;
     async view(archivePath: string, frameId: string): Promise<Entry>;
     async stats(archivePath: string): Promise<Stats>;
     async enrich(archivePath: string, engine?: string): Promise<void>;
     async delete(archivePath: string, frameId: string): Promise<void>;
     async repair(archivePath: string): Promise<void>;
     async vacuum(archivePath: string): Promise<void>;

     // Ticket operations (SELF-HOSTED PRIORITY)
     async issueTicket(
          archivePath: string,
          options: IssueTicketOptions
     ): Promise<void>;
     async listTickets(archivePath: string): Promise<TicketInfo>;
     async revokeTicket(archivePath: string): Promise<void>;

     // Archive expansion
     async checkCapacity(archivePath: string): Promise<CapacityInfo>;
     async expandCapacity(
          archivePath: string,
          newSizeBytes: number
     ): Promise<void>;
}

interface IssueTicketOptions {
     issuer: string;
     seq: number;
     expiresIn?: number; // seconds
     capacity: number; // bytes
}

interface CapacityInfo {
     currentBytes: number;
     capacityBytes: number;
     usagePercent: number;
     shouldExpand: boolean; // true when > threshold
}
```

**CRITICAL**: When creating a new archive:

1. Run `memvid create <archive>.mv2` (default cap: 50MB)
2. **Immediately** issue a self-hosted ticket with `--seq 2` to set 1GB cap:
     ```bash
     memvid tickets issue <archive>.mv2 \
       --issuer "openclaw.local" \
       --seq 2 \
       --capacity 1073741824  # 1GB
     ```
3. Store archive path for future operations

**Capacity Monitoring**: Implement auto-expand logic:

- Check capacity after each `put` operation
- If `usagePercent > capacityThresholdPercent` (default 80%), auto-expand
- Expand by issuing new ticket with incremented `--seq` and doubled capacity
- Log expansion events

#### 5.3 OpenClaw Tools Registration

Register tools using `api.registerTool()` for each Memvid operation:

##### Tool: memvid_archive_session

- **Description**: "Archive a session transcript to Memvid for long-term semantic search"
- **Parameters**:
     - `sessionKey` (string, required): Session key to archive
     - `archiveName` (string, optional): Custom archive name (default: auto-generated from agentId)
- **Execute**:
     1.   Read session .jsonl file
     2.   Create or open archive
     3.   Ingest session content via `memvid put`
     4.   Ensure ticket is issued with 1GB cap
     5.   Check capacity and expand if needed
- **Return**: Content with archive path and ingestion details

##### Tool: memvid_search

- **Description**: "Search through Memvid archives using semantic search. Searches across all archived sessions and explicitly saved memories."
- **Parameters**:
     - `query` (string, required): Search query
     - `archiveName` (string, optional): Specific archive to search (default: all archives)
     - `limit` (number, optional): Max results (default 5)
- **Execute**:
     - If archiveName provided: search that archive only
     - Otherwise: search all .mv2 files in archivesDir
     - Format results with source archive info
- **Return**: Content with formatted results and details object

##### Tool: memvid_ask

- **Description**: "Ask natural language questions to Memvid archives"
- **Parameters**:
     - `question` (string, required): Natural language question
     - `archiveName` (string, optional): Specific archive to query
- **Execute**: Call `memvidClient.ask()`, return answer
- **Return**: Content with answer text

##### Tool: memvid_store

- **Description**: "Store important information in Memvid archives for long-term memory. **This is the default for explicit memory saves.**"
- **Parameters**:
     - `content` (string, required): Information to remember
     - `archiveName` (string, optional): Target archive (default: agent's main archive)
     - `metadata` (object, optional): Additional metadata (tags, importance, etc.)
- **Execute**:
     1.   Get or create target archive
     2.   Call `memvidClient.put()` with enrichment
     3.   Check capacity and auto-expand if needed
- **Return**: Content with stored frame ID and archive info

##### Tool: memvid_timeline

- **Description**: "Retrieve archived memories in chronological order"
- **Parameters**:
     - `archiveName` (string, required): Archive to query
     - `startDate` (string, optional): Start date filter
     - `endDate` (string, optional): End date filter
     - `limit` (number, optional): Max results
- **Execute**: Call `memvidClient.timeline()`, format results
- **Return**: Content with timeline entries

##### Tool: memvid_view

- **Description**: "View detailed information about a specific archived memory"
- **Parameters**:
     - `archiveName` (string, required): Archive containing the entry
     - `frameId` (string, required): Frame ID
- **Execute**: Call `memvidClient.view()`, format entry details
- **Return**: Content with full entry data

##### Tool: memvid_stats

- **Description**: "Get statistics about Memvid archives"
- **Parameters**:
     - `archiveName` (string, optional): Specific archive (default: all archives)
- **Execute**:
     - If archiveName: stats for that archive
     - Otherwise: aggregate stats across all archives
- **Return**: Content with stats (total entries, size, capacity usage, etc.)

##### Tool: memvid_forget

- **Description**: "Delete specific memories from archives. GDPR-compliant."
- **Parameters**:
     - `query` (string, optional): Search to find memory
     - `archiveName` (string, optional): Archive to search
     - `frameId` (string, optional): Specific frame ID
- **Execute**:
     - If `frameId` provided: delete directly
     - If `query` provided: search first, then confirm if single result
     - Return candidates if multiple matches
- **Return**: Content with deletion status or candidates

##### Tool: memvid_enrich

- **Description**: "Enrich archived memories with embeddings using specified engine"
- **Parameters**:
     - `archiveName` (string, required): Archive to enrich
     - `engine` (enum: basic|candle|cloud, optional): Enrichment engine (default: basic)
     - `downloadCandle` (boolean, optional): Download candle engine if not present
- **Execute**: Call `memvidClient.enrich()`, handle download if needed
- **Return**: Content with enrichment status

##### Tool: memvid_repair

- **Description**: "Repair and verify archive integrity"
- **Parameters**:
     - `archiveName` (string, required): Archive to repair
- **Execute**: Call `memvidClient.repair()`
- **Return**: Content with repair results

##### Tool: memvid_capacity_check

- **Description**: "Check archive capacity and usage"
- **Parameters**:
     - `archiveName` (string, required): Archive to check
- **Execute**: Call `memvidClient.checkCapacity()`
- **Return**: Content with capacity info (size, limit, usage %, expansion recommendation)

##### Tool: memvid_capacity_expand

- **Description**: "Manually expand archive capacity by issuing new self-hosted ticket"
- **Parameters**:
     - `archiveName` (string, required): Archive to expand
     - `newSizeGB` (number, required): New capacity in GB
- **Execute**:
     1.   Get current ticket info
     2.   Issue new ticket with incremented seq and new capacity
     3.   Verify expansion
- **Return**: Content with expansion confirmation

**REMOVED TOOLS**:

- ~~memvid_tickets_buy~~ - Focus on self-hosted tickets, not cloud purchases

#### 5.4 CLI Commands Registration

Register CLI commands using `api.registerCli()`:

```typescript
api.registerCli(
     ({ program }) => {
          const memvid = program
               .command('memvid')
               .description('Memvid memory archive plugin commands');

          // memvid archives - List all archives
          memvid
               .command('archives')
               .description('List all Memvid archives')
               .option('--json', 'Output as JSON')
               .action(async (opts) => {
                    /* ... */
               });

          // memvid create <name> - Create new archive
          memvid
               .command('create')
               .description('Create new Memvid archive')
               .argument('<name>', 'Archive name')
               .option('--no-ticket', 'Skip initial ticket creation')
               .action(async (name, opts) => {
                    /* ... */
               });

          // memvid archive-session <sessionKey> - Archive a session
          memvid
               .command('archive-session')
               .description('Archive a session transcript')
               .argument('<sessionKey>', 'Session key to archive')
               .option('--archive <name>', 'Target archive name')
               .action(async (sessionKey, opts) => {
                    /* ... */
               });

          // memvid search <query> - Search archives
          memvid
               .command('search')
               .description('Search archives')
               .argument('<query>', 'Search query')
               .option('--archive <name>', 'Specific archive to search')
               .option('--limit <n>', 'Max results', '5')
               .action(async (query, opts) => {
                    /* ... */
               });

          // memvid ask <question> - Ask natural language question
          memvid
               .command('ask')
               .description('Ask a question to archives')
               .argument('<question>', 'Natural language question')
               .option('--archive <name>', 'Specific archive to query')
               .action(async (question, opts) => {
                    /* ... */
               });

          // memvid store <content> - Store memory
          memvid
               .command('store')
               .description('Store information in archive')
               .argument('<content>', 'Content to remember')
               .option('--archive <name>', 'Target archive')
               .option('--metadata <json>', 'Metadata as JSON')
               .action(async (content, opts) => {
                    /* ... */
               });

          // memvid timeline - Show timeline
          memvid
               .command('timeline')
               .description('Show archive timeline')
               .argument('<archive>', 'Archive name')
               .option('--start <date>', 'Start date')
               .option('--end <date>', 'End date')
               .option('--limit <n>', 'Max results')
               .action(async (archive, opts) => {
                    /* ... */
               });

          // memvid view <archive> <frameId> - View frame details
          memvid
               .command('view')
               .description('View archived entry details')
               .argument('<archive>', 'Archive name')
               .argument('<frameId>', 'Frame ID')
               .action(async (archive, frameId) => {
                    /* ... */
               });

          // memvid stats - Show statistics
          memvid
               .command('stats')
               .description('Show archive statistics')
               .option('--archive <name>', 'Specific archive')
               .action(async (opts) => {
                    /* ... */
               });

          // memvid enrich - Enrich archives
          memvid
               .command('enrich')
               .description('Enrich archive with embeddings')
               .argument('<archive>', 'Archive name')
               .option(
                    '--engine <type>',
                    'Enrichment engine (basic|candle|cloud)',
                    'basic'
               )
               .option('--download-candle', 'Download candle engine if needed')
               .action(async (archive, opts) => {
                    /* ... */
               });

          // memvid repair - Repair archive
          memvid
               .command('repair')
               .description('Repair archive integrity')
               .argument('<archive>', 'Archive name')
               .action(async (archive) => {
                    /* ... */
               });

          // memvid vacuum - Vacuum archive
          memvid
               .command('vacuum')
               .description('Optimize archive storage')
               .argument('<archive>', 'Archive name')
               .action(async (archive) => {
                    /* ... */
               });

          // memvid capacity - Check/manage capacity
          const capacity = memvid
               .command('capacity')
               .description('Manage archive capacity');

          capacity
               .command('check')
               .description('Check archive capacity')
               .argument('<archive>', 'Archive name')
               .action(async (archive) => {
                    /* ... */
               });

          capacity
               .command('expand')
               .description('Expand archive capacity')
               .argument('<archive>', 'Archive name')
               .argument('<sizeGB>', 'New size in GB')
               .action(async (archive, sizeGB) => {
                    /* ... */
               });

          // memvid tickets - Manage tickets (self-hosted focus)
          const tickets = memvid
               .command('tickets')
               .description('Manage archive tickets');

          tickets
               .command('list')
               .description('List archive tickets')
               .argument('<archive>', 'Archive name')
               .action(async (archive) => {
                    /* ... */
               });

          tickets
               .command('issue')
               .description('Issue self-hosted ticket')
               .argument('<archive>', 'Archive name')
               .option('--issuer <name>', 'Ticket issuer', 'openclaw.local')
               .option('--seq <n>', 'Sequence number (required)', parseInt)
               .option(
                    '--capacity <bytes>',
                    'Capacity in bytes (required)',
                    parseInt
               )
               .option('--expires-in <seconds>', 'Expiration time', parseInt)
               .action(async (archive, opts) => {
                    /* ... */
               });

          tickets
               .command('revoke')
               .description('Revoke archive ticket')
               .argument('<archive>', 'Archive name')
               .action(async (archive) => {
                    /* ... */
               });
     },
     { commands: ['memvid'] }
);
```

#### 5.5 Lifecycle Hooks (Auto-Recall, Auto-Capture & Auto-Archive)

##### Auto-Recall Hook

```typescript
if (cfg.autoRecall) {
     api.on('before_agent_start', async (event) => {
          if (!event.prompt || event.prompt.length < 5) {
               return;
          }

          try {
               // Search across ALL archives for relevant context
               const results = await memvidClient.search(
                    event.prompt,
                    undefined,
                    3
               );

               if (results.length === 0) {
                    return;
               }

               const memoryContext = results
                    .map((r) => `- [${r.archiveName}] ${r.content}`)
                    .join('\n');

               api.logger.info?.(
                    `memory-memvid: injecting ${results.length} archived memories into context`
               );

               return {
                    prependContext: `<relevant-memories>\nThe following archived memories may be relevant:\n${memoryContext}\n</relevant-memories>`,
               };
          } catch (err) {
               api.logger.warn(`memory-memvid: recall failed: ${String(err)}`);
          }
     });
}
```

##### Auto-Capture Hook

**IMPORTANT**: Default to Memvid archives for explicit saves, not session logs.

```typescript
if (cfg.autoCapture) {
     api.on('agent_end', async (event) => {
          if (
               !event.success ||
               !event.messages ||
               event.messages.length === 0
          ) {
               return;
          }

          try {
               // Extract capturable content (reuse pattern from lancedb plugin)
               const texts: string[] = [];
               for (const msg of event.messages) {
                    if (!msg || typeof msg !== 'object') continue;
                    const msgObj = msg as Record<string, unknown>;
                    const role = msgObj.role;
                    if (role !== 'user' && role !== 'assistant') continue;

                    const content = msgObj.content;
                    if (typeof content === 'string') {
                         texts.push(content);
                    } else if (Array.isArray(content)) {
                         for (const block of content) {
                              if (
                                   block &&
                                   typeof block === 'object' &&
                                   'type' in block &&
                                   block.type === 'text' &&
                                   'text' in block &&
                                   typeof block.text === 'string'
                              ) {
                                   texts.push(block.text);
                              }
                         }
                    }
               }

               const toCapture = texts.filter((text) => shouldCapture(text));
               if (toCapture.length === 0) {
                    return;
               }

               // Get or create agent's main archive
               const archiveName = `${event.agentId || 'default'}-memory.mv2`;
               const archivePath =
                    await memvidClient.ensureArchive(archiveName);

               let stored = 0;
               for (const text of toCapture.slice(0, 3)) {
                    await memvidClient.put(archivePath, text, {
                         source: 'auto-capture',
                         timestamp: Date.now(),
                    });

                    // Check capacity after each put
                    const capacity =
                         await memvidClient.checkCapacity(archivePath);
                    if (capacity.shouldExpand && cfg.autoExpandCapacity) {
                         await memvidClient.expandCapacity(
                              archivePath,
                              capacity.capacityBytes * 2
                         );
                         api.logger.info(
                              `memory-memvid: auto-expanded ${archiveName} to ${(capacity.capacityBytes * 2) / 1024 ** 3} GB`
                         );
                    }

                    stored++;
               }

               if (stored > 0) {
                    api.logger.info(
                         `memory-memvid: auto-captured ${stored} memories to ${archiveName}`
                    );
               }
          } catch (err) {
               api.logger.warn(`memory-memvid: capture failed: ${String(err)}`);
          }
     });
}
```

##### Auto-Archive Sessions Hook

**NEW**: Automatically archive completed or large session transcripts to .mv2 files.

```typescript
if (cfg.autoArchiveSessions) {
     api.on('agent_end', async (event) => {
          if (!event.sessionKey || !event.success) {
               return;
          }

          try {
               // Get session file path
               const sessionPath = resolveSessionPath(event.sessionKey);
               const stat = await fs.stat(sessionPath);
               const sizeMB = stat.size / (1024 * 1024);

               // Check if session should be archived
               const thresholdMB = cfg.sessionArchiveThresholdMB || 10;
               if (sizeMB < thresholdMB) {
                    return; // Session too small to archive yet
               }

               api.logger.info(
                    `memory-memvid: archiving session ${event.sessionKey} (${sizeMB.toFixed(2)} MB)`
               );

               // Create or get archive for this agent's sessions
               const archiveName = `${event.agentId || 'default'}-sessions.mv2`;
               const archivePath =
                    await memvidClient.ensureArchive(archiveName);

               // Read session content
               const sessionContent = await fs.readFile(sessionPath, 'utf-8');
               const lines = sessionContent.split('\n').filter(Boolean);

               // Ingest each turn as a frame
               let archived = 0;
               for (const line of lines) {
                    try {
                         const turn = JSON.parse(line);
                         const frameContent = JSON.stringify(turn, null, 2);
                         await memvidClient.put(archivePath, frameContent, {
                              source: 'session-archive',
                              sessionKey: event.sessionKey,
                              timestamp: turn.timestamp || Date.now(),
                              role: turn.role,
                         });
                         archived++;
                    } catch (parseErr) {
                         api.logger.warn(
                              `memory-memvid: failed to parse session line: ${parseErr}`
                         );
                    }
               }

               // Check and expand capacity if needed
               const capacity = await memvidClient.checkCapacity(archivePath);
               if (capacity.shouldExpand && cfg.autoExpandCapacity) {
                    await memvidClient.expandCapacity(
                         archivePath,
                         capacity.capacityBytes * 2
                    );
                    api.logger.info(
                         `memory-memvid: auto-expanded ${archiveName} to ${(capacity.capacityBytes * 2) / 1024 ** 3} GB`
                    );
               }

               api.logger.info(
                    `memory-memvid: archived ${archived} turns from session ${event.sessionKey}`
               );

               // Optional: truncate or delete original session file after successful archive
               // await fs.writeFile(sessionPath, ''); // Clear session
               // Or: await archiveFileOnDisk(sessionPath, 'archived'); // Move to backup
          } catch (err) {
               api.logger.warn(
                    `memory-memvid: session archive failed: ${String(err)}`
               );
          }
     });
}
```

##### Capture Triggers

Reuse pattern from lancedb plugin with triggers for:

- Explicit memory commands: "remember", "zapamatuj si"
- Preferences: "prefer", "like", "want"
- Decisions: "decided", "will use"
- Entities: phone numbers, emails
- Important facts

#### 5.6 Service Registration

```typescript
api.registerService({
     id: 'memory-memvid',
     start: async () => {
          // Verify memvid CLI is accessible
          try {
               await memvidClient.exec(['--version']);
               api.logger.info(
                    `memory-memvid: initialized (archives: ${resolvedArchivesDir})`
               );

               // Ensure archives directory exists
               await fs.mkdir(resolvedArchivesDir, { recursive: true });

               // List existing archives
               const archives = await memvidClient.listArchives();
               api.logger.info(
                    `memory-memvid: found ${archives.length} existing archives`
               );
          } catch (err) {
               api.logger.error(
                    `memory-memvid: CLI not found at ${cfg.memvidPath}`
               );
               throw err;
          }
     },
     stop: () => {
          api.logger.info('memory-memvid: stopped');
     },
});
```

### 6. Testing (index.test.ts)

Create comprehensive tests:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import memvidPlugin from './index.js';

describe('memory-memvid plugin', () => {
     it('should export plugin object', () => {
          expect(memvidPlugin.id).toBe('memory-memvid');
          expect(memvidPlugin.kind).toBe('memory');
     });

     it('should validate config schema', () => {
          // Test config validation
     });

     // Test MemvidClient operations
     describe('MemvidClient', () => {
          it('should execute search', async () => {
               /* ... */
          });
          it('should execute ask', async () => {
               /* ... */
          });
          it('should execute store', async () => {
               /* ... */
          });
          // ... more tests
     });

     // Test tools
     describe('tools', () => {
          it('should register memvid_search tool', () => {
               /* ... */
          });
          it('should register memvid_ask tool', () => {
               /* ... */
          });
          // ... more tests
     });

     // Test auto-recall/capture
     describe('lifecycle hooks', () => {
          it('should inject memories on auto-recall', async () => {
               /* ... */
          });
          it('should capture important info on auto-capture', async () => {
               /* ... */
          });
     });
});
```

## Implementation Guidelines

### Error Handling

- Wrap all CLI calls in try-catch blocks
- Provide meaningful error messages
- Log errors using `api.logger.warn/error`
- Handle missing memvid binary gracefully

### CLI Output Parsing

- Parse JSON output from memvid CLI where available
- Handle text output for commands that don't support JSON
- Sanitize and validate CLI responses

### Security

- Never log sensitive information (API keys)
- Validate entry IDs before deletion (prevent injection)
- Use environment variable resolution for credentials
- Respect GDPR for forget operations

### Performance

- Cache memvid CLI availability check
- Batch operations where possible
- Use appropriate limits for search/timeline

### Documentation

- Add JSDoc comments to all exported functions
- Document each tool's purpose and parameters
- Include usage examples in CLI help text
- Keep instructions.md updated

## Special Considerations

### .mv2 File Capacity Management

**Default behavior**: When creating a new .mv2 file with `memvid create`, it has a **50MB cap**.

**Solution**: Immediately after creation, issue a self-hosted ticket to increase capacity:

```bash
# Create archive
memvid create my-archive.mv2

# Immediately issue ticket with 1GB cap using --seq 2
memvid tickets issue my-archive.mv2 \
  --issuer "openclaw.local" \
  --seq 2 \
  --capacity 1073741824  # 1GB in bytes
```

**Auto-Expansion Logic**:

1. After each `put` operation, check capacity via `memvid tickets list <file> --json`
2. Parse JSON response to get `usage.usage_percent`
3. If `usage_percent >= capacityThresholdPercent` (default 80%), trigger expansion:

     ```bash
     # Get current ticket info
     CURRENT_SEQ=$(memvid tickets list my-archive.mv2 --json | jq '.ticket.seq_no')
     CURRENT_CAP=$(memvid tickets list my-archive.mv2 --json | jq '.ticket.capacity_bytes')

     # Issue new ticket with incremented seq and doubled capacity
     NEW_SEQ=$((CURRENT_SEQ + 1))
     NEW_CAP=$((CURRENT_CAP * 2))

     memvid tickets issue my-archive.mv2 \
       --issuer "openclaw.local" \
       --seq $NEW_SEQ \
       --capacity $NEW_CAP
     ```

4. Log expansion: `logger.info("Expanded archive to X GB")`

**Expansion Thresholds**:

- Default trigger: 80% capacity usage
- Configurable via `capacityThresholdPercent` in plugin config
- Expansion multiplier: 2x (double the capacity each time)

### Enrichment Engine Selection

- **basic**: Default, no dependencies, works offline
- **candle**: Better quality, requires download (flag this to user)
- **cloud**: Best quality, requires API key and internet

When user selects `candle` engine:

1. Check if candle is already installed
2. If not, prompt/warn about download requirement
3. Provide option to download automatically via tool parameter

### Ticket Management (Self-Hosted Priority)

- **self-hosted tickets**: Default and recommended for OpenClaw
     - No external dependencies
     - Full control over capacity limits
     - Issued locally via `memvid tickets issue`
     - Requires `--issuer`, `--seq`, `--capacity` parameters
     - Optional `--expires-in` for time-limited tickets
- **cloud tickets**: Secondary option (de-prioritized)
     - Requires MEMVID_API_KEY environment variable
     - Syncs with Memvid cloud dashboard
     - Not the focus of this plugin

**Default workflow**:

1. Create archive → issue self-hosted ticket (seq 2, 1GB)
2. Monitor capacity → auto-expand via new self-hosted tickets (seq 3, 4, 5...)
3. Never require cloud API unless user explicitly configures it

### Archive Organization

Archives are stored in `archivesDir` (default: `~/.openclaw/memory/archives/`):

```
archives/
├── default-memory.mv2       # Agent's main memory archive
├── default-sessions.mv2     # Agent's archived sessions
├── agent2-memory.mv2        # Another agent's memory
└── agent2-sessions.mv2      # Another agent's sessions
```

**Naming convention**:

- `{agentId}-memory.mv2` - Explicit saves and auto-captured memories
- `{agentId}-sessions.mv2` - Archived session transcripts

### Session Archive vs Memory Archive

**Session archives** (`*-sessions.mv2`):

- Contain full conversation transcripts
- Ingested when session size exceeds threshold (default 10MB)
- Preserves exact conversation flow
- Searchable via semantic search

**Memory archives** (`*-memory.mv2`):

- Contain explicitly saved information
- Auto-captured important facts/preferences/decisions
- More curated and focused
- Default target for "remember this" commands

## Success Criteria

✅ Plugin exports valid OpenClaw plugin structure
✅ Archives stored in configurable directory (default: `~/.openclaw/memory/archives/`)
✅ All Memvid CLI operations accessible via tools
✅ All Memvid CLI operations accessible via CLI commands
✅ Auto-recall injects relevant memories from archives before agent start
✅ Auto-capture stores important information to archives after agent end
✅ **Auto-archive sessions when size threshold is reached**
✅ **Self-hosted ticket issued immediately when creating new archive (1GB cap)**
✅ **Auto-expand capacity when usage exceeds threshold (default 80%)**
✅ **Explicit saves default to Memvid archives, not just session logs**
✅ **Search works across all archives or specific archive**
✅ Configuration UI hints provide clear guidance
✅ Config schema validates all options correctly
✅ Error handling provides meaningful feedback
✅ Tests cover core functionality (archive creation, ticket issuance, capacity expansion)
✅ Documentation is complete and accurate
✅ Uses `api.resolvePath()` for all path resolution (no custom helpers)

## Development Workflow

1. **Setup**: Create all required files with proper structure
2. **Config**: Implement config.ts with schema validation
     - Use `api.resolvePath()` for all path resolution
     - Default to self-hosted tickets
     - Include auto-archive and capacity management options
3. **Client**: Build MemvidClient class with CLI wrapper
     - Implement archive management (create, list, info)
     - Implement ticket operations (issue, list, revoke)
     - Implement capacity checking and expansion
     - Ensure all operations target archives in archivesDir
4. **Tools**: Register all tools with proper parameter schemas
     - Include archiveName parameter where relevant
     - Default explicit saves to archive
     - Support multi-archive search
5. **CLI**: Register all CLI commands with help text
     - Archive management commands
     - Capacity management commands
     - Session archiving commands
6. **Hooks**: Implement auto-recall, auto-capture, and **auto-archive sessions**
     - Auto-recall searches across all archives
     - Auto-capture saves to `{agentId}-memory.mv2`
     - Auto-archive saves sessions to `{agentId}-sessions.mv2` when threshold reached
     - Check capacity after each write, auto-expand if needed
7. **Service**: Register service with startup checks
     - Verify memvid CLI availability
     - Create archives directory if missing
     - List existing archives
8. **Tests**: Write comprehensive test suite
     - Test archive creation with immediate ticket issuance
     - Test capacity expansion logic
     - Test session archiving
     - Test multi-archive search
9. **Integration**: Test with real Memvid installation
     - Create test archive
     - Verify ticket issued with 1GB cap
     - Fill archive to 80% and verify auto-expansion
     - Archive test session
     - Search across multiple archives
10. **Documentation**: Update this file with learnings

## Notes for Claude

- Prioritize security and error handling throughout
- Follow TypeScript best practices (strict typing, no `any`)
- Match code style from memory-lancedb reference plugin
- Use `api.logger` for all logging (info, warn, error)
- **Use `api.resolvePath()` for all path resolution - do NOT create custom helpers**
- Test thoroughly with real Memvid CLI before declaring complete
- Keep files under ~500-700 LOC (split if needed)
- Add brief comments for non-obvious logic
- Use existing OpenClaw patterns (stringEnum, Type helpers)
- Ensure all external references are implemented
- Self-hosted memory focus: no massive infrastructure dependency
- **CRITICAL**: Always issue self-hosted ticket (seq 2, 1GB) immediately after creating new archive
- **CRITICAL**: Check capacity after every `put` operation and auto-expand when threshold exceeded
- **CRITICAL**: Default explicit memory saves to archives, not just session logs
- **CRITICAL**: Support searching across multiple archives
- **CRITICAL**: Auto-archive sessions when size threshold is reached
- Session archive flow: read `.jsonl` → parse turns → ingest to `{agentId}-sessions.mv2`
- Memory vs session archives: different purposes, different naming
- Ticket sequence numbers: increment with each capacity expansion (2, 3, 4, ...)
- Capacity expansion multiplier: 2x (double each time)
- JSON parsing: use `--json` flag on Memvid CLI commands where available
