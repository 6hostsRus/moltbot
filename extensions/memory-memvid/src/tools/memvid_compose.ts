import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import { MemvidClient } from "../MemvidClient";
import { filterResults, composePrependContext } from "../utils/retrieval";

export const memvidCompose = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
  api.registerTool(
    {
      name: "memvid_compose",
      description:
        "Compose prependContext and inclusion decisions for a query using retrieval filters and token budget",
      label: "Compose Memory Context",
      parameters: Type.Object({
        query: Type.String({ description: "Search query" }),
        archiveName: Type.Optional(Type.String({ description: "Specific archive to search" })),
        limit: Type.Optional(Type.Number({ default: 5 })),
        recencyMs: Type.Optional(Type.Number()),
        minScore: Type.Optional(Type.Number()),
        allowedSensitivity: Type.Optional(Type.Array(Type.String())),
        tokenBudget: Type.Optional(Type.Number()),
      }),
      async execute(_toolCallId, params) {
        const {
          query,
          archiveName,
          limit = 5,
          recencyMs,
          minScore,
          allowedSensitivity,
          tokenBudget,
        } = params as any;

        try {
          api.logger.info?.(`memvid_compose: searching for query: ${query}`);
          const results = await memvidClient.search(
            query,
            archiveName ? memvidClient.validateArchiveDir(archiveName) : undefined,
            limit,
          );

          const filtered = filterResults(results, {
            recencyMs,
            minScore,
            allowedSensitivity,
            limit,
          });

          const composed = composePrependContext(filtered, { limit, tokenBudget });

          return {
            content: [
              {
                type: "json" as const,
                data: composed,
              },
            ],
            details: {
              query,
              resultsCount: results.length,
              filteredCount: filtered.length,
            },
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `Compose failed: ${err}` }],
            details: { error: String(err) },
          };
        }
      },
    },
    { name: "memvid_compose" },
  );
