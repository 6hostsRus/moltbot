import { type OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';
// Tool: memvid_capacity_expand
export const capacityExpand = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool({
          name: 'memvid_capacity_expand',
          description:
               'Manually expand archive capacity by issuing new self-hosted ticket',
          label: 'Expand Capacity',
          parameters: Type.Object({
               archiveName: Type.String({
                    description: 'Archive to expand',
               }),
               newSizeGB: Type.Number({
                    description: 'New capacity in GB',
               }),
          }),
          async execute(_toolCallId, params) {
               const { archiveName, newSizeGB } = params as {
                    archiveName: string;
                    newSizeGB: number;
               };
               try {
                    const newSizeBytes = newSizeGB * 1024 ** 3;
                    await memvidClient.expandCapacity(
                         memvidClient.validateArchiveDir(archiveName),
                         newSizeBytes
                    );

                    return {
                         content: [
                              {
                                   type: 'text' as const,
                                   text: `Expanded ${archiveName} to ${newSizeGB} GB`,
                              },
                         ],
                         details: {
                              archiveName,
                              newSizeGB,
                              newSizeBytes,
                         },
                    };
               } catch (err) {
                    return {
                         content: [
                              {
                                   type: 'text' as const,
                                   text: `Capacity expansion failed: ${err}`,
                              },
                         ],
                         details: { error: String(err) },
                    };
               }
          },
     });
