import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// TODO: Review this tool. It seems that there's logic to work against all archives if there's no archiveName, but an archive name is also required 🤷🏽
// Tool: memvid_stats
export const memvidStats = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_stats',
               description: 'Get statistics about Memvid archives',
               label: 'Statistics',
               parameters: Type.Object({
                    archiveName: Type.Optional(
                         Type.String({
                              description:
                                   'Specific archive (default: all archives)',
                         })
                    ),
               }),
               async execute(_toolCallId, params) {
                    const { archiveName } = params as {
                         archiveName?: string;
                    };
                    try {
                         if (archiveName) {
                              const stats = await memvidClient.stats(
                                   memvidClient.validateArchiveDir(archiveName)
                              );

                              return {
                                   content: [
                                        {
                                             type: 'text' as const,
                                             text: `Archive: ${archiveName}\nEntries: ${stats.totalEntries}\nSize: ${(stats.sizeBytes / 1024 ** 2).toFixed(2)} MB\nCapacity: ${stats.capacityBytes ? (stats.capacityBytes / 1024 ** 3).toFixed(2) + ' GB' : 'N/A'}\nUsage: ${stats.usagePercent?.toFixed(1) || 'N/A'}%`,
                                        },
                                   ],
                                   details: { archiveName, stats },
                              };
                         } else {
                              const archives =
                                   await memvidClient.listArchives();
                              let totalEntries = 0;
                              let totalSize = 0;

                              for (const archive of archives) {
                                   try {
                                        const stats = await memvidClient.stats(
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

                              return {
                                   content: [
                                        {
                                             type: 'text' as const,
                                             text: `Total archives: ${archives.length}\nTotal entries: ${totalEntries}\nTotal size: ${(totalSize / 1024 ** 2).toFixed(2)} MB`,
                                        },
                                   ],
                                   details: {
                                        archivesCount: archives.length,
                                        totalEntries,
                                        totalSizeBytes: totalSize,
                                   },
                              };
                         }
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Stats failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_stats' }
     );
