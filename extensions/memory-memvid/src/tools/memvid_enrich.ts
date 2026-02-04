import { stringEnum, type OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_enrich
export const memvidEnrich = (
     api: OpenClawPluginApi,
     memvidClient: MemvidClient
) =>
     api.registerTool(
          {
               name: 'memvid_enrich',
               description:
                    'Enrich archived memories with embeddings using specified engine',
               label: 'Enrich Archives',
               parameters: Type.Object({
                    archiveName: Type.String({
                         description: 'Archive to enrich',
                    }),
                    engine: Type.Optional(
                         stringEnum(['basic', 'candle', 'cloud'], {
                              description: 'Enrichment engine (default: basic)',
                         })
                    ),
                    downloadCandle: Type.Optional(
                         Type.Boolean({
                              description:
                                   'Download candle engine if not present',
                         })
                    ),
               }),
               async execute(_toolCallId, params) {
                    const {
                         archiveName,
                         engine = 'basic',
                         downloadCandle,
                    } = params as {
                         archiveName: string;
                         engine?: string;
                         downloadCandle?: boolean;
                    };
                    try {
                         if (engine === 'candle' && downloadCandle) {
                              api.logger.info?.(
                                   'Note: candle engine download may be required'
                              );
                         }

                         await memvidClient.enrich(
                              memvidClient.validateArchiveDir(archiveName),
                              engine
                         );

                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Enriched ${archiveName} with ${engine} engine`,
                                   },
                              ],
                              details: { archiveName, engine },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Enrich failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_enrich' }
     );
