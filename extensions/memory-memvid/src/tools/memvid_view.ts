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

                         // If the provided frameId is not a simple number, attempt to resolve it
                         // by searching the archive for a matching uri or id, and prefer numeric frameIndex.
                         if (!/^\d+$/.test(String(frameId))) {
                              const searchResults = await memvidClient.search(
                                   frameId,
                                   memvidClient.validateArchiveDir(archiveName),
                                   10
                              );

                              const match = searchResults.find((r) => {
                                   const md = r.metadata as any;
                                   return (
                                        r.frameId === frameId ||
                                        md?.uri === frameId ||
                                        String(md?.frameIndex) === String(frameId)
                                   );
                              });

                              if (match) {
                                   // Prefer numeric frameIndex when available
                                   const md = match.metadata as any;
                                   if (md?.frameIndex !== undefined) {
                                        targetFrameId = String(md.frameIndex);
                                   } else if (match.frameId) {
                                        targetFrameId = match.frameId;
                                   }
                              } else {
                                   return {
                                        content: [
                                             {
                                                  type: 'text' as const,
                                                  text: `Could not resolve identifier '${frameId}' to a viewable frame. Try using the numeric frame index (e.g. 0) or search to find the frameId.`,
                                             },
                                        ],
                                        details: { archiveName, frameId },
                                   };
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
