import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { readFile, writeFile } from "node:fs/promises";
import { MemvidClient } from "../MemvidClient";
import { compactFrames, CompactionOptions } from "../utils/capture_compaction";
import logging from "../utils/logging";
import masking from "../utils/masking";
import { filterResults, composePrependContext } from "../utils/retrieval";

// Register Memvid CLI commands
export const Cli = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
  api.registerCli(
    ({ program }) => {
      const memvid = program.command("memvid").description("Memvid memory archive plugin commands");

      // memvid archive-session <sessionKey> - Archive a session
      memvid
        .command("archive-session")
        .description("Archive a session transcript")
        .argument("<sessionKey>", "Session key to archive")
        .option("--archive <name>", "Target archive name")
        .option("--compact", "Run compaction on the session before storing")
        .option("--compact-writeback", "If --compact, also write compacted frames into the archive")
        .option("--dry-run", "When used with --compact-writeback, do not actually write to archive")
        .option(
          "--sensitivity-allowlist <list>",
          "Comma-separated sensitivities to include (e.g. public,private)",
        )
        .option("--prefer-latest", "Prefer latest SET frames when composing compaction", true)
        .action(async (sessionKey: string, opts: any) => {
          try {
            const targetArchive = opts.archive || `default-sessions.mv2`;
            const archivePath = await memvidClient.ensureArchive(targetArchive);

            const sessionPath = api.resolvePath(
              `~/.openclaw/agents/default/sessions/${sessionKey}.jsonl`,
            );

            const sessionContent = await readFile(sessionPath, "utf-8");
            const lines = sessionContent.split("\n").filter(Boolean);
            let archived = 0;

            if (opts.compact) {
              // build frames from session
              const frames = lines
                .map((line) => {
                  try {
                    const turn = JSON.parse(line);
                    return {
                      frameId: turn.frameId || `session-${turn.timestamp || Date.now()}`,
                      content: turn.content || JSON.stringify(turn),
                      timestamp: turn.timestamp || Date.now(),
                      sessionId: turn.sessionId,
                      uri: turn.uri,
                      frameIndex: turn.frameIndex,
                      sensitivity: turn.sensitivity,
                      tags: turn.tags,
                      metadata: turn.metadata,
                    } as any;
                  } catch (e) {
                    return null;
                  }
                })
                .filter(Boolean) as any[];

              const compOpts: CompactionOptions = {
                timeWindowMs: opts.timeWindowMs ? Number.parseInt(opts.timeWindowMs) : undefined,
                maxSummaryWords: opts.maxWords ? Number.parseInt(opts.maxWords) : undefined,
                sensitivityThreshold: opts.sensitivityAllowlist
                  ? opts.sensitivityAllowlist.split(",").map((s: string) => s.trim())
                  : undefined,
                preferLatest:
                  opts.preferLatest !== undefined ? Boolean(opts.preferLatest) : undefined,
              };

              const compacted = compactFrames(frames, compOpts);

              const outPath = `${sessionPath}.compacted.jsonl`;
              const linesOut = compacted.map((c) =>
                JSON.stringify({
                  frameId: c.frameId,
                  timestamp: c.timestamp,
                  content: c.content,
                  metadata: c.metadata,
                  constituents: c.constituents,
                }),
              );
              await writeFile(outPath, linesOut.join("\n") + "\n", "utf-8");
              console.log(`Wrote compacted session preview to ${outPath}`);

              if (
                opts.compactWriteback ||
                opts.compactWriteback === true ||
                opts.compactWriteback === undefined
              ) {
                // support both --compact-writeback and camelCase opts depending on commander parsing
                if (opts.dryRun) {
                  console.log(
                    `Dry run: would write ${compacted.length} compacted frames to archive ${targetArchive}`,
                  );
                } else {
                  for (const c of compacted) {
                    await memvidClient.put(archivePath, c.content, {
                      source: "compaction",
                      timestamp: c.timestamp,
                      constituents: c.constituents,
                    });
                    archived++;
                  }
                  console.log(`Wrote ${archived} compacted frames into ${targetArchive}`);
                }
              }

              return;
            }

            // No compaction: store each turn as-is
            for (const line of lines) {
              try {
                const turn = JSON.parse(line);
                const frameContent = JSON.stringify(turn, null, 2);
                await memvidClient.put(archivePath, frameContent, {
                  source: "session-archive",
                  sessionKey,
                  timestamp: turn.timestamp || Date.now(),
                  role: turn.role,
                });
                archived++;
              } catch (parseErr) {
                api.logger.warn?.(`Failed to parse session line: ${parseErr}`);
              }
            }

            console.log(
              `Archived ${archived} turns from session ${sessionKey} to ${targetArchive}`,
            );
          } catch (err) {
            console.error(`Error: ${err}`);
            process.exit(1);
          }
        });

      // memvid compose <query> - Compose prependContext using retrieval rules
      memvid
        .command("compose")
        .description("Compose memory prependContext and decisions for a query")
        .argument("<query>", "Search query")
        .option("--archive <name>", "Specific archive to search")
        .option("--limit <n>", "Max results", "3")
        .option("--recency-ms <ms>", "Recency window in ms")
        .option("--min-score <s>", "Minimum score threshold")
        .option("--token-budget <n>", "Token budget", "3000")
        .action(async (query: string, opts: any) => {
          try {
            const results = await memvidClient.search(
              query,
              opts.archive ? memvidClient.validateArchiveDir(opts.archive) : undefined,
              Number.parseInt(opts.limit || "3"),
            );

            const filtered = filterResults(results, {
              recencyMs: opts.recencyMs ? Number.parseInt(opts.recencyMs) : undefined,
              minScore: opts.minScore ? Number.parseFloat(opts.minScore) : undefined,
              allowedSensitivity: undefined,
            });

            const composed = composePrependContext(filtered, {
              limit: Number.parseInt(opts.limit || "3"),
              tokenBudget: Number.parseInt(opts.tokenBudget || "3000"),
            });

            let output = composed.prependContext || "No relevant memories.";
            // mask output by default
            output = masking.applyMaskToFrameContent(output);
            console.log(output);
            logging.structuredLog({
              timestamp: Date.now(),
              level: "info",
              event: "compose-output",
              runId: logging.genRunId(),
              details: { query },
              reason: "masked",
            });
            console.log("\nDecisions:");
            console.log(JSON.stringify(composed.decisions, null, 2));
          } catch (err) {
            console.error(`Error: ${err}`);
            process.exit(1);
          }
        });

      // memvid compact <session|archive> - Preview or write-back compaction
      memvid
        .command("compact")
        .description("Compact a session JSONL file or preview compaction for an archive")
        .option("--session <path>", "Path to a session .jsonl file for compaction")
        .option("--archive <name>", "Archive name to preview compaction (searches recent entries)")
        .option("--time-window-ms <ms>", "Compaction time window in ms")
        .option("--max-words <n>", "Max words in compacted summary")
        .option(
          "--sensitivity-allowlist <list>",
          "Comma-separated sensitivities to include (e.g. public,private)",
        )
        .option("--prefer-latest", "Prefer latest SET frames when composing compaction", true)
        .option("--preview", "Print compacted frames to stdout (default)", true)
        .option("--write-back", "Write compacted results to a new file or archive")
        .option("--dry-run", "When used with --write-back, don't actually write")
        .action(async (opts: any) => {
          try {
            const compOpts: CompactionOptions = {
              timeWindowMs: opts.timeWindowMs ? Number.parseInt(opts.timeWindowMs) : undefined,
              maxSummaryWords: opts.maxWords ? Number.parseInt(opts.maxWords) : undefined,
              sensitivityThreshold: opts.sensitivityAllowlist
                ? opts.sensitivityAllowlist.split(",").map((s: string) => s.trim())
                : undefined,
              preferLatest:
                opts.preferLatest !== undefined ? Boolean(opts.preferLatest) : undefined,
            };

            if (opts.session) {
              const sessionPath = api.resolvePath(opts.session);
              const content = await readFile(sessionPath, "utf-8");
              const lines = content.split("\n").filter(Boolean);
              const frames = lines
                .map((l) => {
                  try {
                    const turn = JSON.parse(l);
                    return {
                      frameId: turn.frameId || `session-${turn.timestamp || Date.now()}`,
                      content: turn.content || JSON.stringify(turn),
                      timestamp: turn.timestamp || Date.now(),
                      sessionId: turn.sessionId,
                      uri: turn.uri,
                      frameIndex: turn.frameIndex,
                      sensitivity: turn.sensitivity,
                      tags: turn.tags,
                    } as any;
                  } catch (e) {
                    return null;
                  }
                })
                .filter(Boolean) as any[];

              const compacted = compactFrames(frames, compOpts);

              if (opts.preview || !opts.writeBack) {
                console.log(`Compacted ${compacted.length} groups from ${frames.length} frames:\n`);
                for (const c of compacted) {
                  const masked = masking.applyMaskToFrameContent(c.content);
                  console.log(
                    `- ${c.frameId} (includes ${c.constituents.length} frames) @ ${new Date(c.timestamp).toISOString()}`,
                  );
                  console.log(`${masked}\n`);
                }
                logging.structuredLog({
                  timestamp: Date.now(),
                  level: "info",
                  event: "compaction-preview",
                  runId: logging.genRunId(),
                  frames: compacted.map((c) => c.frameId),
                  details: { sessionPath },
                  reason: "masked",
                });
              }

              if (opts.writeBack) {
                const outPath = `${sessionPath}.compacted.jsonl`;
                if (opts.dryRun) {
                  console.log(
                    `Dry run: would write ${compacted.length} compacted frames to ${outPath}`,
                  );
                } else {
                  const linesOut = compacted.map((c) =>
                    JSON.stringify({
                      frameId: c.frameId,
                      timestamp: c.timestamp,
                      content: c.content,
                      metadata: c.metadata,
                      constituents: c.constituents,
                    }),
                  );
                  await writeFile(outPath, linesOut.join("\n") + "\n", "utf-8");
                  console.log(`Wrote compacted session to ${outPath}`);
                }
              }

              return;
            }

            if (opts.archive) {
              const archivePath = memvidClient.validateArchiveDir(opts.archive);
              const results = await memvidClient.search("", archivePath, 200);
              const frames = results.map((r: any) => ({
                frameId: r.frameId,
                content: r.content,
                timestamp: r.metadata?.timestamp || Date.now(),
                sessionId: r.metadata?.sessionId,
                uri: r.metadata?.uri,
                frameIndex: r.metadata?.frameIndex,
                sensitivity: r.metadata?.sensitivity,
                tags: r.metadata?.tags,
              }));
              const compacted = compactFrames(frames, compOpts);

              if (opts.preview || !opts.writeBack) {
                console.log(
                  `Preview: Compacted ${compacted.length} groups from ${frames.length} frames in ${opts.archive}:\n`,
                );
                for (const c of compacted) {
                  const masked = masking.applyMaskToFrameContent(c.content);
                  console.log(
                    `- ${c.frameId} (includes ${c.constituents.length} frames) @ ${new Date(c.timestamp).toISOString()}`,
                  );
                  console.log(`${masked}\n`);
                }
                logging.structuredLog({
                  timestamp: Date.now(),
                  level: "info",
                  event: "compaction-preview",
                  runId: logging.genRunId(),
                  frames: compacted.map((c) => c.frameId),
                  details: { archive: opts.archive },
                  reason: "masked",
                });
              }

              if (opts.writeBack) {
                if (opts.dryRun) {
                  console.log(
                    `Dry run: would write ${compacted.length} compacted frames into archive ${opts.archive}`,
                  );
                } else {
                  const targetArchive = await memvidClient.ensureArchive(opts.archive);
                  for (const c of compacted) {
                    await memvidClient.put(targetArchive, c.content, {
                      source: "compaction",
                      timestamp: c.timestamp,
                      constituents: c.constituents,
                    });
                  }
                  console.log(`Wrote ${compacted.length} compacted frames into ${opts.archive}`);
                }
              }

              return;
            }

            console.error("Error: must specify --session <path> or --archive <name>");
            process.exit(1);
          } catch (err) {
            console.error(`Error: ${err}`);
            process.exit(1);
          }
        });
    },
    { commands: ["memvid"] },
  );
