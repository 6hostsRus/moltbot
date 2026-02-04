import { stringEnum, type OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_repair
export const memvidRepair = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_repair',
               description: 'Repair and verify archive integrity',
               label: 'Repair Archive',
               parameters: Type.Object({
                    archiveName: Type.String({
                         description: 'Archive to repair',
                    }),
               }),
               async execute(_toolCallId, params) {
                    const { archiveName } = params as {
                         archiveName?: string;
                    };
                    if (!archiveName) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: 'Archive name is required',
                                   },
                              ],
                              details: {
                                   error: 'Missing archiveName parameter',
                              },
                         };
                    }
                    try {
                         await memvidClient.repair(
                              memvidClient.validateArchiveDir(archiveName)
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Repaired ${archiveName}`,
                                   },
                              ],
                              details: { archiveName },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Repair failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_repair' }
     );
