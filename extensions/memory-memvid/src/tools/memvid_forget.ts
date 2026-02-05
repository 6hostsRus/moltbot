import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { join } from "node:path";
import { MemvidClient } from "../MemvidClient";

// Tool: memvid_forget
export const memvidForget = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
  api.registerTool(
    {
      name: "memvid_forget",
      description: "Delete specific memories from archives. GDPR-compliant.",
      label: "Forget Memory",
      parameters: Type.Object({
        query: Type.Optional(
          Type.String({
            description: "Search to find memory",
          }),
        ),
        archiveName: Type.Optional(Type.String({ description: "Archive to search" })),
        frameId: Type.Optional(Type.String({ description: "Specific frame ID" })),
      }),
      async execute(_toolCallId, params) {
        const { query, archiveName, frameId } = params as {
          query?: string;
          archiveName: string;
          frameId?: string;
        };
        try {
          if (frameId && archiveName) {
            await memvidClient.delete(memvidClient.validateArchiveDir(archiveName), frameId);

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Deleted frame ${frameId} from ${archiveName}`,
                },
              ],
              details: { archiveName, frameId },
            };
          } else if (query) {
            const results = await memvidClient.search(
              query,
              archiveName ? memvidClient.validateArchiveDir(archiveName) : undefined,
              5,
            );

            if (results.length === 0) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "No matching memories found.",
                  },
                ],
                details: { query },
              };
            }

            if (results.length === 1 && results[0].frameId) {
              const result = results[0];
              const targetPath = join(memvidClient.getArchivesDir(), result.archiveName);
              await memvidClient.delete(targetPath, result.frameId as string);

              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Deleted matching memory from ${result.archiveName}`,
                  },
                ],
                details: {
                  archiveName: result.archiveName,
                  frameId: result.frameId,
                  content: result.content.substring(0, 100),
                },
              };
            }

            const candidates = results
              .map(
                (r, i) =>
                  `${i + 1}. [${r.archiveName}] ${r.frameId}: ${r.content.substring(0, 100)}`,
              )
              .join("\n");

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Multiple matches found. Please specify frameId:\n\n${candidates}`,
                },
              ],
              details: { query, candidates: results },
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: "Please provide either (query) or (archiveName + frameId)",
              },
            ],
            details: {},
          };
        } catch (err) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Forget failed: ${err}`,
              },
            ],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memvid_forget" },
  );
