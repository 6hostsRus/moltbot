import { type OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_capacity_check
export const capacityCheck = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_capacity_check',
               description: 'Check archive capacity and usage',
               label: 'Check Capacity',
               parameters: Type.Object({
                    archiveName: Type.String({
                         description: 'Archive to check',
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
                         const capacity = await memvidClient.checkCapacity(
                              memvidClient.validateArchiveDir(archiveName)
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Capacity: ${(capacity.capacityBytes / 1024 ** 3).toFixed(2)} GB\nUsed: ${(capacity.currentBytes / 1024 ** 2).toFixed(2)} MB (${capacity.usagePercent.toFixed(1)}%)\nShould expand: ${capacity.shouldExpand ? 'Yes' : 'No'}`,
                                   },
                              ],
                              details: {
                                   archiveName,
                                   capacity,
                              },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Capacity check failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_capacity_check' }
     );
