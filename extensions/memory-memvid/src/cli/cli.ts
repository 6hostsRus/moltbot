import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { MemvidClient } from '../MemvidClient';
import { readFile } from 'node:fs/promises';

// TODO: Further modularize CLI commands. This file is too big for my taste.

/**
 * Register Memvid CLI commands
 */
export const Cli = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
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
                    .action(async (opts: { json?: boolean }) => {
                         try {
                              const archives =
                                   await memvidClient.listArchives();

                              if (opts.json) {
                                   console.log(
                                        JSON.stringify(archives, null, 2)
                                   );
                              } else {
                                   if (archives.length === 0) {
                                        console.log('No archives found.');
                                   } else {
                                        console.log(
                                             `Found ${archives.length} archive(s):\n`
                                        );
                                        for (const archive of archives) {
                                             const sizeMB = (
                                                  (archive.sizeBytes || 0) /
                                                  1024 ** 2
                                             ).toFixed(2);
                                             console.log(
                                                  `  ${archive.name} (${sizeMB} MB)`
                                             );
                                        }
                                   }
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid create <name> - Create new archive
               memvid
                    .command('create')
                    .description('Create new Memvid archive')
                    .argument('<name>', 'Archive name')
                    .option('--no-ticket', 'Skip initial ticket creation')
                    .action(async (name: string, opts: any) => {
                         try {
                              const archivePath =
                                   await memvidClient.createArchive(name);
                              console.log(`Created archive: ${archivePath}`);

                              if (opts.ticket !== false) {
                                   console.log('Issued 1GB self-hosted ticket');
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid archive-session <sessionKey> - Archive a session
               memvid
                    .command('archive-session')
                    .description('Archive a session transcript')
                    .argument('<sessionKey>', 'Session key to archive')
                    .option('--archive <name>', 'Target archive name')
                    .action(async (sessionKey: string, opts: any) => {
                         try {
                              // TODO: touch this up to get the active agent session
                              const targetArchive =
                                   opts.archive || `default-sessions.mv2`;
                              const archivePath =
                                   await memvidClient.ensureArchive(
                                        targetArchive
                                   );
                              // TODO: figure out how to get the session path of the active agent
                              const sessionPath = api.resolvePath(
                                   `~/.openclaw/agents/default/sessions/${sessionKey}.jsonl`
                              );

                              const sessionContent = await readFile(
                                   sessionPath,
                                   'utf-8'
                              );
                              const lines = sessionContent
                                   .split('\n')
                                   .filter(Boolean);
                              let archived = 0;

                              for (const line of lines) {
                                   try {
                                        const turn = JSON.parse(line);
                                        const frameContent = JSON.stringify(
                                             turn,
                                             null,
                                             2
                                        );
                                        await memvidClient.put(
                                             archivePath,
                                             frameContent,
                                             {
                                                  source: 'session-archive',
                                                  sessionKey,
                                                  timestamp:
                                                       turn.timestamp ||
                                                       Date.now(),
                                                  role: turn.role,
                                             }
                                        );
                                        archived++;
                                   } catch (parseErr) {
                                        api.logger.warn?.(
                                             `Failed to parse session line: ${parseErr}`
                                        );
                                   }
                              }

                              console.log(
                                   `Archived ${archived} turns from session ${sessionKey} to ${targetArchive}`
                              );
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid search <query> - Search archives
               memvid
                    .command('search')
                    .description('Search archives')
                    .argument('<query>', 'Search query')
                    .option('--archive <name>', 'Specific archive to search')
                    .option('--limit <n>', 'Max results', '5')
                    .action(async (query: string, opts: any) => {
                         try {
                              const results = await memvidClient.search(
                                   query,
                                   memvidClient.validateArchiveDir(
                                        opts.archive
                                   ),
                                   Number.parseInt(opts.limit)
                              );

                              if (results.length === 0) {
                                   console.log('No results found.');
                              } else {
                                   console.log(
                                        `Found ${results.length} result(s):\n`
                                   );
                                   for (const [
                                        i,
                                        result,
                                   ] of results.entries()) {
                                        console.log(
                                             `${i + 1}. [${result.archiveName}] ${result.frameId || 'N/A'}`
                                        );
                                        console.log(
                                             `   ${result.content.substring(0, 200)}${result.content.length > 200 ? '...' : ''}\n`
                                        );
                                   }
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid ask <question> - Ask natural language question
               memvid
                    .command('ask')
                    .description('Ask a question to archives')
                    .argument('<question>', 'Natural language question')
                    .option('--archive <name>', 'Specific archive to query')
                    .action(async (question: string, opts: any) => {
                         try {
                              const answer = await memvidClient.ask(
                                   question,
                                   memvidClient.validateArchiveDir(opts.archive)
                              );
                              console.log(answer);
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid store <content> - Store memory
               memvid
                    .command('store')
                    .description('Store information in archive')
                    .argument('<content>', 'Content to remember')
                    .option('--archive <name>', 'Target archive')
                    .option('--metadata <json>', 'Metadata as JSON')
                    .action(async (content: string, opts: any) => {
                         try {
                              // TODO: determine if I need to ensureArchive anywhere I have
                              // archivePath usage. This may be handy.
                              const targetArchive =
                                   opts.archive || `default-memory.mv2`;
                              const archivePath =
                                   await memvidClient.ensureArchive(
                                        targetArchive
                                   );

                              const metadata = opts.metadata
                                   ? JSON.parse(opts.metadata)
                                   : {};
                              const frameId = await memvidClient.put(
                                   archivePath,
                                   content,
                                   {
                                        ...metadata,
                                        source: 'cli-store',
                                        timestamp: Date.now(),
                                   }
                              );

                              console.log(
                                   `Stored in ${targetArchive} (frame: ${frameId})`
                              );
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid timeline - Show timeline
               memvid
                    .command('timeline')
                    .description('Show archive timeline')
                    .argument('<archive>', 'Archive name')
                    .option('--start <date>', 'Start date')
                    .option('--end <date>', 'End date')
                    .option('--limit <n>', 'Max results')
                    .action(async (archive: string, opts: any) => {
                         try {
                              const entries = await memvidClient.timeline(
                                   memvidClient.validateArchiveDir(archive),
                                   {
                                        startDate: opts.start,
                                        endDate: opts.end,
                                        limit: opts.limit
                                             ? Number.parseInt(opts.limit)
                                             : undefined,
                                   }
                              );

                              if (entries.length === 0) {
                                   console.log('No timeline entries found.');
                              } else {
                                   console.log(
                                        `Timeline (${entries.length} entries):\n`
                                   );
                                   for (const entry of entries) {
                                        const date = new Date(
                                             entry.timestamp
                                        ).toISOString();
                                        console.log(
                                             `[${date}] ${entry.frameId}`
                                        );
                                        console.log(
                                             `  ${entry.content.substring(0, 150)}\n`
                                        );
                                   }
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid view <archive> <frameId> - View frame details
               memvid
                    .command('view')
                    .description('View archived entry details')
                    .argument('<archive>', 'Archive name')
                    .argument('<frameId>', 'Frame ID')
                    .action(async (archive: string, frameId: string) => {
                         try {
                              const entry = await memvidClient.view(
                                   memvidClient.validateArchiveDir(archive),
                                   frameId
                              );

                              console.log(`Frame: ${entry.frameId}`);
                              console.log(
                                   `Timestamp: ${new Date(entry.timestamp).toISOString()}`
                              );
                              console.log(`\nContent:\n${entry.content}`);

                              if (entry.metadata) {
                                   console.log(
                                        `\nMetadata:\n${JSON.stringify(entry.metadata, null, 2)}`
                                   );
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid stats - Show statistics
               memvid
                    .command('stats')
                    .description('Show archive statistics')
                    .option('--archive <name>', 'Specific archive')
                    .action(async (opts: any) => {
                         try {
                              if (opts.archive) {
                                   const stats = await memvidClient.stats(
                                        memvidClient.validateArchiveDir(
                                             opts.archive
                                        )
                                   );

                                   console.log(`Archive: ${opts.archive}`);
                                   console.log(
                                        `Entries: ${stats.totalEntries}`
                                   );
                                   console.log(
                                        `Size: ${(stats.sizeBytes / 1024 ** 2).toFixed(2)} MB`
                                   );
                                   if (stats.capacityBytes) {
                                        console.log(
                                             `Capacity: ${(stats.capacityBytes / 1024 ** 3).toFixed(2)} GB`
                                        );
                                   }
                                   if (stats.usagePercent !== undefined) {
                                        console.log(
                                             `Usage: ${stats.usagePercent.toFixed(1)}%`
                                        );
                                   }
                              } else {
                                   const archives =
                                        await memvidClient.listArchives();
                                   let totalEntries = 0;
                                   let totalSize = 0;

                                   for (const archive of archives) {
                                        try {
                                             const stats =
                                                  await memvidClient.stats(
                                                       archive.path
                                                  );
                                             totalEntries += stats.totalEntries;
                                             totalSize += stats.sizeBytes;
                                        } catch (err) {
                                             api.logger.warn?.(
                                                  `Failed to get stats for ${archive.name}: ${err}`
                                             );
                                        }
                                   }

                                   console.log(
                                        `Total archives: ${archives.length}`
                                   );
                                   console.log(
                                        `Total entries: ${totalEntries}`
                                   );
                                   console.log(
                                        `Total size: ${(totalSize / 1024 ** 2).toFixed(2)} MB`
                                   );
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
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
                    .option(
                         '--download-candle',
                         'Download candle engine if needed'
                    )
                    .action(async (archive: string, opts: any) => {
                         try {
                              if (
                                   opts.engine === 'candle' &&
                                   opts.downloadCandle
                              ) {
                                   console.log(
                                        'Note: candle engine download may be required'
                                   );
                              }

                              await memvidClient.enrich(
                                   memvidClient.validateArchiveDir(archive),
                                   opts.engine
                              );
                              console.log(
                                   `Enriched ${archive} with ${opts.engine} engine`
                              );
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid repair - Repair archive
               memvid
                    .command('repair')
                    .description('Repair archive integrity')
                    .argument('<archive>', 'Archive name')
                    .action(async (archive: string) => {
                         try {
                              await memvidClient.repair(
                                   memvidClient.validateArchiveDir(archive)
                              );
                              console.log(`Repaired ${archive}`);
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid vacuum - Vacuum archive
               memvid
                    .command('vacuum')
                    .description('Optimize archive storage')
                    .argument('<archive>', 'Archive name')
                    .action(async (archive: string) => {
                         try {
                              await memvidClient.vacuum(
                                   memvidClient.validateArchiveDir(archive)
                              );
                              console.log(`Vacuumed ${archive}`);
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid capacity - Check/manage capacity
               const capacity = memvid
                    .command('capacity')
                    .description('Manage archive capacity');

               capacity
                    .command('check')
                    .description('Check archive capacity')
                    .argument('<archive>', 'Archive name')
                    .action(async (archive: string) => {
                         try {
                              const capacityInfo =
                                   await memvidClient.checkCapacity(
                                        memvidClient.validateArchiveDir(archive)
                                   );

                              console.log(`Archive: ${archive}`);
                              console.log(
                                   `Capacity: ${(capacityInfo.capacityBytes / 1024 ** 3).toFixed(2)} GB`
                              );
                              console.log(
                                   `Used: ${(capacityInfo.currentBytes / 1024 ** 2).toFixed(2)} MB`
                              );
                              console.log(
                                   `Usage: ${capacityInfo.usagePercent.toFixed(1)}%`
                              );
                              console.log(
                                   `Should expand: ${capacityInfo.shouldExpand ? 'Yes' : 'No'}`
                              );
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               capacity
                    .command('expand')
                    .description('Expand archive capacity')
                    .argument('<archive>', 'Archive name')
                    .argument('<sizeGB>', 'New size in GB')
                    .action(async (archive: string, sizeGB: string) => {
                         try {
                              const newSizeBytes =
                                   Number.parseFloat(sizeGB) * 1024 ** 3;
                              await memvidClient.expandCapacity(
                                   memvidClient.validateArchiveDir(archive),
                                   newSizeBytes
                              );

                              console.log(
                                   `Expanded ${archive} to ${sizeGB} GB`
                              );
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               // memvid tickets - Manage tickets (self-hosted focus)
               const tickets = memvid
                    .command('tickets')
                    .description('Manage archive tickets');

               tickets
                    .command('list')
                    .description('List archive tickets')
                    .argument('<archive>', 'Archive name')
                    .action(async (archive: string) => {
                         try {
                              const ticketInfo = await memvidClient.listTickets(
                                   memvidClient.validateArchiveDir(archive)
                              );

                              if (ticketInfo.ticket) {
                                   console.log(`Ticket for ${archive}:`);
                                   console.log(
                                        `  Issuer: ${ticketInfo.ticket.issuer}`
                                   );
                                   console.log(
                                        `  Sequence: ${ticketInfo.ticket.seq_no}`
                                   );
                                   console.log(
                                        `  Capacity: ${(ticketInfo.ticket.capacity_bytes / 1024 ** 3).toFixed(2)} GB`
                                   );

                                   if (ticketInfo.ticket.expires_at) {
                                        console.log(
                                             `  Expires: ${new Date(ticketInfo.ticket.expires_at * 1000).toISOString()}`
                                        );
                                   }
                              }

                              if (ticketInfo.usage) {
                                   console.log(`\nUsage:`);
                                   console.log(
                                        `  Used: ${(ticketInfo.usage.usage_bytes / 1024 ** 2).toFixed(2)} MB`
                                   );
                                   console.log(
                                        `  Percentage: ${ticketInfo.usage.usage_percent.toFixed(1)}%`
                                   );
                              }
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });

               tickets
                    .command('issue')
                    .description('Issue self-hosted ticket')
                    .argument('<archive>', 'Archive name')
                    .option(
                         '--issuer <name>',
                         'Ticket issuer',
                         'openclaw.local'
                    )
                    .requiredOption('--seq <n>', 'Sequence number (required)')
                    .requiredOption(
                         '--capacity <bytes>',
                         'Capacity in bytes (required)'
                    )
                    .option('--expires-in <seconds>', 'Expiration time')
                    .action(
                         async (
                              archive: string,
                              opts: {
                                   issuer: string;
                                   seq: string;
                                   capacity: string;
                                   expiresIn?: string;
                              }
                         ) => {
                              try {
                                   await memvidClient.issueTicket(
                                        memvidClient.validateArchiveDir(
                                             archive
                                        ),
                                        {
                                             issuer: opts.issuer,
                                             seq: Number.parseInt(opts.seq),
                                             capacity: Number.parseInt(
                                                  opts.capacity
                                             ),
                                             expiresIn: opts.expiresIn
                                                  ? Number.parseInt(
                                                         opts.expiresIn
                                                    )
                                                  : undefined,
                                        }
                                   );

                                   console.log(
                                        `Issued ticket for ${archive} (seq: ${opts.seq}, capacity: ${(Number.parseInt(opts.capacity) / 1024 ** 3).toFixed(2)} GB)`
                                   );
                              } catch (err) {
                                   console.error(`Error: ${err}`);
                                   process.exit(1);
                              }
                         }
                    );

               tickets
                    .command('revoke')
                    .description('Revoke archive ticket')
                    .argument('<archive>', 'Archive name')
                    .action(async (archive: string) => {
                         try {
                              await memvidClient.revokeTicket(
                                   memvidClient.validateArchiveDir(archive)
                              );
                              console.log(`Revoked ticket for ${archive}`);
                         } catch (err) {
                              console.error(`Error: ${err}`);
                              process.exit(1);
                         }
                    });
          },
          { commands: ['memvid'] }
     );
