import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { readFile } from "fs/promises";
import { MemvidClient } from "../MemvidClient";

// TODO: figure out how to skip the "write to jsonl" piece and manage entirely from memvid.
// Tool: memvid_archive_session
export const archive_session = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
  api.registerTool(
    {
      name: "memvid_archive_session",
      description: "Archive a session transcript to Memvid for long-term semantic search",
      label: "Archive Session",
      parameters: Type.Object({
        sessionKey: Type.String({
          description: "Session key to archive",
        }),
        archiveName: Type.Optional(
          Type.String({
            description: "Custom archive name (default: auto-generated from agentId)",
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const { sessionKey, archiveName } = params as {
          sessionKey: string;
          archiveName?: string;
        };
        try {
          // Determine target archive
          const targetArchive = archiveName || `default-sessions.mv2`;
          const archivePath = await memvidClient.ensureArchive(targetArchive);
          // TODO: pass in the actual session path
          // Read session file (placeholder - would need actual session path resolution)
          const sessionPath = api.resolvePath(
            `~/.openclaw/agents/default/sessions/${sessionKey}.jsonl`,
          );

          let sessionContent: string;
          try {
            sessionContent = await readFile(sessionPath, "utf-8");
          } catch (err) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Session file not found: ${sessionPath}`,
                },
              ],
              details: { error: String(err) },
            };
          }

          const lines = sessionContent.split("\n").filter(Boolean);
          let archived = 0;

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

          return {
            content: [
              {
                type: "text" as const,
                text: `Archived ${archived} turns from session ${sessionKey} to ${targetArchive}`,
              },
            ],
            details: {
              archive: targetArchive,
              archivePath,
              turnsArchived: archived,
            },
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to archive session: ${err}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memvid_archive_session" },
  );
