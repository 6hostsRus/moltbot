import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { stat, readFile, mkdir } from "node:fs/promises";
import { Cli } from "./src/cli/cli.ts";
import { MemvidClient } from "./src/MemvidClient.ts";
import { mergeTools } from "./src/tools/tools.ts";
import { memvidConfigSchema } from "./src/types/types.ts";
import { mergeConfig } from "./src/utils/config.ts";
import { shouldCapture } from "./src/utils/helpers.ts";

/**
 * Main plugin export
 */
const memvidPlugin = {
  id: "memory-memvid",
  name: "Memory (Memvid)",
  description: "Self-hosted Memvid-backed long-term memory with auto-recall/capture",
  kind: "memory" as const,
  configSchema: memvidConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = memvidConfigSchema.parse(api.pluginConfig);
    const mergedCfg = mergeConfig(cfg);

    // Resolve paths using api.resolvePath
    const resolvedArchivesDir = api.resolvePath(mergedCfg.archivesDir);
    const memvidPath = mergedCfg.memvidPath;

    // Create Memvid client
    const memvidClient = new MemvidClient(
      memvidPath,
      resolvedArchivesDir,
      mergedCfg.apiKey,
      mergedCfg.capacityThresholdPercent,
      api.logger,
    );

    // TODO: consider moving tool, service, and CLI registration to the MemvidClient class itself.

    // TODO: Consider reviewing the tool names. Make it simpler for lifecycle hooks, later
    // Register tools
    mergeTools(api, memvidClient);

    // Register CLI commands
    Cli(api, memvidClient);
    // Register forget CLI
    try {
      const { ForgetCli } = await import('./src/cli/forget');
      ForgetCli(api, memvidClient);
    } catch (e) {
      api.logger.warn?.(`memory-memvid: failed to register forget CLI: ${e}`);
    }

    try {
      const { AuditCli } = await import('./src/cli/audit');
      AuditCli(api);
    } catch (e) {
      api.logger.warn?.(`memory-memvid: failed to register audit CLI: ${e}`);
    }

    // Lifecycle hooks
    // Auto-recall hook
    if (mergedCfg.autoRecall) {
      api.on("before_agent_start", async (event) => {
        if (!event.prompt || event.prompt.length < 5) {
          return;
        }

        try {
          const results = await memvidClient.search(`${event.prompt}`, undefined, 3);

          if (results.length === 0) {
            return;
          }

          const memoryContext = results.map((r) => `- [${r.archiveName}] ${r.content}`).join("\n");

          api.logger.info?.(
            `memory-memvid: injecting ${results.length} archived memories into context`,
          );

          return {
            prependContext: `<relevant-memories>\nThe following archived memories may be relevant:\n${memoryContext}\n</relevant-memories>`,
          };
        } catch (err) {
          api.logger.warn?.(`memory-memvid: recall failed: ${String(err)}`);
        }
      });
    }
    // Auto-capture hook
    api.registerHook(
      "agent_end",
      async (event) => {
        if (mergedCfg.autoCapture) {
          if (!event.messages || event.messages.length === 0) {
            return;
          }

          try {
            const texts: string[] = [];
            for (const msg of event.messages) {
              if (!msg || typeof msg !== "object") continue;
              const msgObj = msg as Record<string, unknown>;
              const role = msgObj.role;
              if (role !== "user" && role !== "assistant") continue;

              const content = msgObj.content;
              if (typeof content === "string") {
                texts.push(content);
              } else if (Array.isArray(content)) {
                for (const block of content) {
                  if (
                    block &&
                    typeof block === "object" &&
                    "type" in block &&
                    block.type === "text" &&
                    "text" in block &&
                    typeof block.text === "string"
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

            const archiveName = `default-memory.mv2`;
            const archivePath = await memvidClient.ensureArchive(archiveName);

            let stored = 0;
            for (const text of toCapture.slice(0, 3)) {
              await memvidClient.put(archivePath, text, {
                source: "auto-capture",
                timestamp: Date.now(),
              });
              stored++;
            }

            if (stored > 0) {
              api.logger.info?.(
                `memory-memvid: auto-captured ${stored} memories to ${archiveName}`,
              );
            }
          } catch (err) {
            api.logger.warn?.(`memory-memvid: capture failed: ${String(err)}`);
          }
        }
        if (mergedCfg.autoArchiveSessions) {
          if (!event.sessionKey || event.messages) {
            return;
          }

          try {
            const sessionPath = api.resolvePath(
              `~/.openclaw/agents/default/sessions/${event.sessionKey}.jsonl`,
            );

            let sessionStat;
            try {
              sessionStat = await stat(sessionPath);
            } catch {
              return; // Session file doesn't exist
            }

            const sizeMB = sessionStat.size / (1024 * 1024);
            const thresholdMB = mergedCfg.sessionArchiveThresholdMB || 10;

            if (sizeMB < thresholdMB) {
              return; // Session too small to archive yet
            }

            api.logger.info?.(
              `memory-memvid: archiving session ${event.sessionKey} (${sizeMB.toFixed(2)} MB)`,
            );

            const archiveName = `default-sessions.mv2`;
            const archivePath = await memvidClient.ensureArchive(archiveName);

            const sessionContent = await readFile(sessionPath, "utf-8");
            const lines = sessionContent.split("\n").filter(Boolean);

            let archived = 0;
            for (const line of lines) {
              try {
                const turn = JSON.parse(line);
                const frameContent = JSON.stringify(turn, null, 2);
                await memvidClient.put(archivePath, frameContent, {
                  source: "session-archive",
                  sessionKey: event.sessionKey,
                  timestamp: turn.timestamp || Date.now(),
                  role: turn.role,
                });
                archived++;
              } catch (parseErr) {
                api.logger.warn?.(`memory-memvid: failed to parse session line: ${parseErr}`);
              }
            }

            api.logger.info?.(
              `memory-memvid: archived ${archived} turns from session ${event.sessionKey}`,
            );
          } catch (err) {
            api.logger.warn?.(`memory-memvid: session archive failed: ${String(err)}`);
          }
        }
      },
      { name: "memory-memvid-auto-capture-archive" },
    );

    // TODO: check if mkdir will overwrite existing dirs
    // Register service
    api.registerService({
      id: "memory-memvid",
      start: async () => {
        try {
          await memvidClient["exec"](["--version"]);
          api.logger.info(
            `memory-memvid: initialized (archives: ${memvidClient.getArchivesDir()})`,
          );

          await mkdir(memvidClient.getArchivesDir(), {
            recursive: true,
          });

          const archives = await memvidClient.listArchives();
          api.logger.info(`memory-memvid: found ${archives.length} existing archives`);
        } catch (err) {
          api.logger.error(`memory-memvid: CLI not found at ${memvidClient.getCliPath()}`);
          throw err;
        }
      },
      stop: () => {
        api.logger.info("memory-memvid: stopped");
      },
    });
  },
};

export default memvidPlugin;
