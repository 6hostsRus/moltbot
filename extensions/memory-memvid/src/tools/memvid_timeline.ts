import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_timeline
export const memvidTimeline = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_timeline',
               description: 'Retrieve archived memories in chronological order',
               label: 'Timeline View',
               parameters: Type.Object({
                    archiveName: Type.String({
                         description: 'Archive to query',
                    }),
                    startDate: Type.Optional(
                         Type.String({ description: 'Start date filter' })
                    ),
                    endDate: Type.Optional(
                         Type.String({ description: 'End date filter' })
                    ),
                    limit: Type.Optional(
                         Type.Number({ description: 'Max results' })
                    ),
               }),
               async execute(_toolCallId, params) {
                    const { archiveName, startDate, endDate, limit } =
                         params as {
                              archiveName: string;
                              startDate?: string;
                              endDate?: string;
                              limit?: number;
                         };
                    try {
                         const entries = await memvidClient.timeline(
                              memvidClient.validateArchiveDir(archiveName),
                              {
                                   startDate,
                                   endDate,
                                   limit,
                              }
                         );

                         if (entries.length === 0) {
                              return {
                                   content: [
                                        {
                                             type: 'text' as const,
                                             text: 'No timeline entries found.',
                                        },
                                   ],
                                   details: {
                                        archiveName,
                                        entriesCount: 0,
                                   },
                              };
                         }

                         const formatted = entries
                              .map(
                                   (e) =>
                                        `[${new Date(e.timestamp).toISOString()}] ${e.content.substring(0, 100)}`
                              )
                              .join('\n');

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Timeline (${entries.length} entries):\n\n${formatted}`,
                                   },
                              ],
                              details: {
                                   archiveName,
                                   entriesCount: entries.length,
                                   entries,
                              },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Timeline failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_timeline' }
     );
