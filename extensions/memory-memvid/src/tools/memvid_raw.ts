import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_raw
export const memvidRaw = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
     api.registerTool(
          {
               name: 'memvid_raw',
               description:
                    'Diagnostic: run a raw memvid CLI command and return raw JSON output for debugging',
               label: 'Raw CLI Dump',
               parameters: Type.Object({
                    archiveName: Type.String({ description: 'Archive to query' }),
                    uri: Type.Optional(Type.String({ description: 'Frame URI (mv2://...)' })),
                    frameId: Type.Optional(Type.String({ description: 'Numeric frame id' })),
               }),
               async execute(_toolCallId, params) {
                    const { archiveName, uri, frameId } = params as {
                         archiveName: string;
                         uri?: string;
                         frameId?: string;
                    };

                    try {
                         const archivePath = memvidClient.validateArchiveDir(archiveName);

                         if (!uri && !frameId) {
                              return {
                                   content: [
                                        { type: 'text' as const, text: 'Please provide either uri or frameId' },
                                   ],
                                   details: {},
                              };
                         }

                         const idOrUri = uri || String(frameId);

                         // Call the client's exec directly to get raw JSON (view with --json)
                         const args = uri
                              ? ['view', archivePath, '--uri', String(uri), '--json']
                              : ['view', archivePath, '--frame-id', String(frameId), '--json'];

                         const raw = await memvidClient['exec'](args);

                         return {
                              content: [
                                   { type: 'text' as const, text: 'Raw memvid JSON output attached in details' },
                              ],
                              details: { archiveName, idOrUri, raw: raw },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   { type: 'text' as const, text: `Raw dump failed: ${err}` },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_raw' }
     );
