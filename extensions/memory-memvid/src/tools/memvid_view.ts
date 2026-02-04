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
                         const entry = await memvidClient.view(
                              memvidClient.validateArchiveDir(archiveName),
                              frameId
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Frame ${frameId}:\n\n${entry.content}`,
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
