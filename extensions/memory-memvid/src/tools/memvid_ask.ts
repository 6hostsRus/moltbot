import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { Type } from '@sinclair/typebox';
import { MemvidClient } from '../MemvidClient';

// Tool: memvid_ask
export const memvidAsk = (api: OpenClawPluginApi, memvidClient: MemvidClient) =>
     api.registerTool(
          {
               name: 'memvid_ask',
               description: 'Ask natural language questions to Memvid archives',
               label: 'Ask Question',
               parameters: Type.Object({
                    question: Type.String({
                         description: 'Natural language question',
                    }),
                    archiveName: Type.Optional(
                         Type.String({
                              description: 'Specific archive to query',
                         })
                    ),
               }),
               async execute(
                    _toolCallId,
                    params: { question: string; archiveName: string }
               ) {
                    const { question, archiveName } = params;
                    try {
                         const targetArchive = archiveName ? memvidClient.validateArchiveDir(archiveName) : undefined;

                         const answer = await memvidClient.ask(
                              question,
                              targetArchive
                         );

                         return {
                              content: [
                                   { type: 'text' as const, text: answer },
                              ],
                              details: { question, answer },
                         };
                    } catch (err) {
                         return {
                              content: [
                                   {
                                        type: 'text' as const,
                                        text: `Ask failed: ${err}`,
                                   },
                              ],
                              details: { error: String(err) },
                         };
                    }
               },
          },
          { name: 'memvid_ask' }
     );
