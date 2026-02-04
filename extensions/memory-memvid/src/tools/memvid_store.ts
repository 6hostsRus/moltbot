import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_store
export const memvidStore = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_store',
               description:
                    'Store important information in Memvid archives for long-term memory. This is the default for explicit memory saves.',
               label: 'Store Memory',
               parameters: Type.Object({
                    content: Type.String({
                         description: 'Information to remember',
                    }),
                    archiveName: Type.Optional(
                         Type.String({
                              description:
                                   "Target archive (default: agent's main archive)",
                         })
                    ),
                    metadata: Type.Optional(
                         Type.Record(Type.String(), Type.Unknown(), {
                              description:
                                   'Additional metadata (tags, importance, etc.)',
                         })
                    ),
               }),
               async execute(_toolCallId, params) {
                    const { content, archiveName, metadata } = params as {
                         content: string;
                         archiveName?: string;
                         metadata?: Record<string, unknown>;
                    };
                    try {
                         const targetArchive =
                              archiveName || `default-memory.mv2`;
                         const archivePath =
                              await memvidClient.ensureArchive(targetArchive);

                         const frameId = await memvidClient.put(
                              archivePath,
                              content,
                              {
                                   ...metadata,
                                   source: 'explicit-save',
                                   timestamp: Date.now(),
                              }
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Stored in ${targetArchive}`,
                                   },
                              ],
                              details: {
                                   archive: targetArchive,
                                   frameId,
                                   content: content.substring(0, 100),
                              },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Store failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_store' }
     );
