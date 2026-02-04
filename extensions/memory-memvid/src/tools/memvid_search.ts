import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_search
export const memvidSearch = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_search',
               description:
                    'Search through Memvid archives using semantic search. Searches across all archived sessions and explicitly saved memories.',
               label: 'Search Archives',
               parameters: Type.Object({
                    query: Type.String({ description: 'Search query' }),
                    archiveName: Type.Optional(
                         Type.String({
                              description:
                                   'Specific archive to search (default: all archives)',
                         })
                    ),
                    limit: Type.Optional(
                         Type.Number({
                              description: 'Max results (default 5)',
                              default: 5,
                         })
                    ),
               }),
               async execute(_toolCallId, params) {
                    const {
                         query,
                         archiveName,
                         limit = 5,
                    } = params as {
                         query: string;
                         archiveName?: string;
                         limit?: number;
                    };
                    try {
                         // TODO: if there's no archiveName, search all archives instead.
                         // Truthfully, it makes much more sense to work in some sort of memory distillation feature
                         // and require a path for this one. Then, we can start a deep-dive into memory
                         // if necessary.
                         api.logger.info?.(
                              `Searching Memvid archive \`${archiveName || 'all'}\` for query: ${query}`
                         );
                         const results = await memvidClient.search(
                              query,
                              archiveName ? memvidClient.validateArchiveDir(archiveName) : undefined,
                              limit
                         );

                         if (results.length === 0) {
                              return {
                                   content: [
                                        {
                                             type: 'text' as const,
                                             text: 'No results found.',
                                        },
                                   ],
                                   details: { query, resultsCount: 0 },
                              };
                         }

                         const formattedResults = results
                              .map(
                                   (r, i) =>
                                        `${i + 1}. [${r.archiveName}] ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`
                              )
                              .join('\n\n');

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Found ${results.length} results:\n\n${formattedResults}`,
                                   },
                              ],
                              details: {
                                   query,
                                   resultsCount: results.length,
                                   results: results.map((r) => ({
                                        archive: r.archiveName,
                                        content: r.content,
                                        score: r.score,
                                        frameId: r.frameId,
                                   })),
                              },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Search failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_search' }
     );
