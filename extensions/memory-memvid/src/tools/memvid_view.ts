import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_view
export const memvidView = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_view',
               description:
                    'View detailed information about a specific archived memory',
               label: 'View Entry',
               parameters: Type.Object({
                    archiveName: Type.String({
                         description: 'Archive containing the entry',
                    }),
                    frameId: Type.String({ description: 'Frame ID' }),
               }),
               async execute(_toolCallId, params) {
                    const { archiveName, frameId } = params as {
                         archiveName: string;
                         frameId: string;
                    };
                    try {
                         let targetFrameId = frameId;

                         // If the provided frameId is not a simple number, try to resolve it.
                         if (!/^\d+$/.test(String(frameId))) {
                              // If it looks like a URI, call view by uri directly.
                              if (String(frameId).startsWith('mv2://') || String(frameId).includes('/')) {
                                   // Let the client view by uri directly
                                   try {
                                        const entry = await memvidClient.view(
                                             memvidClient.validateArchiveDir(archiveName),
                                             String(frameId)
                                        );

                                        return {
                                             content: [
                                                  {
                                                       type: 'text' as const,
                                                       text: `Frame (by uri):\n\n${entry.content}`,
                                                  },
                                             ],
                                             details: { archiveName, entry },
                                        };
                                   } catch (err) {
                                        return {
                                             content: [
                                                  {
                                                       type: 'text' as const,
                                                       text: `View by uri failed: ${err}`,
                                                  },
                                             ],
                                             details: { archiveName, frameId, error: String(err) },
                                        };
                                   }
                              }

                              // Otherwise, attempt to find by searching for the identifier (try quoted exact match first)
                              const quoted = `"${frameId}"`;
                              const searchResults = await memvidClient.search(
                                   quoted,
                                   memvidClient.validateArchiveDir(archiveName),
                                   10
                              );

                              const match = searchResults.find((r) => {
                                   const md = r.metadata as any;
                                   return (
                                        r.frameId === frameId ||
                                        md?.uri === frameId ||
                                        String(md?.frameIndex) === String(frameId) ||
                                        r.frameId === frameId
                                   );
                              });

                              if (match) {
                                   const md = match.metadata as any;
                                   if (md?.frameIndex !== undefined) {
                                        targetFrameId = String(md.frameIndex);
                                   } else if (match.frameId) {
                                        targetFrameId = match.frameId;
                                   }
                              } else {
                                   // As a fallback, try searching without quotes
                                   const fallback = await memvidClient.search(
                                        frameId,
                                        memvidClient.validateArchiveDir(archiveName),
                                        10
                                   );

                                   const fallbackMatch = fallback.find((r) => (r.metadata as any)?.uri === frameId || String((r.metadata as any)?.frameIndex) === String(frameId));

                                   if (fallbackMatch) {
                                        const md = fallbackMatch.metadata as any;
                                        if (md?.frameIndex !== undefined) targetFrameId = String(md.frameIndex);
                                   }

                                   if (!targetFrameId) {
                                        return {
                                             content: [
                                                  {
                                                       type: 'text' as const,
                                                       text: `Could not resolve identifier '${frameId}' to a viewable frame. Try using the numeric frame index (e.g. 0) or the full mv2:// URI.`,
                                                  },
                                             ],
                                             details: { archiveName, frameId },
                                        };
                                   }
                              }
                         }

                         const entry = await memvidClient.view(
                              memvidClient.validateArchiveDir(archiveName),
                              targetFrameId
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Frame ${targetFrameId}:\n\n${entry.content}`,
                                   },
                              ],
                              details: {
                                   archiveName,
                                   entry,
                              },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `View failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_view' }
     );
