import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { readFile, writeFile } from "node:fs/promises";
import logging from "../utils/logging";

export const ForgetCli = (api: OpenClawPluginApi, memvidClient: any) =>
  api.registerCli(
    ({ program }) => {
      const forget = program
        .command("memvid-forget")
        .description("Forget frames from an archive (audit + dry-run)");

      forget
        .command("forget")
        .argument("<archive>", "Archive name")
        .option("--query <q>", "Query to match frames to forget")
        .option("--dry-run", "Don't actually delete")
        .action(async (archive: string, opts: any) => {
          try {
            const archivePath = memvidClient.validateArchiveDir(archive);
            // perform a search to find affected frames
            const results = await memvidClient.search(opts.query || "", archivePath, 1000);
            const frameIds = results.map((r: any) => r.frameId).filter(Boolean);

            const entry = {
              timestamp: Date.now(),
              level: "audit",
              event: "forget-request",
              runId: logging.genRunId(),
              frames: frameIds,
              details: { archive, query: opts.query || "" },
            } as any;

            logging.structuredLog(entry);

            if (opts.dryRun) {
              console.log(`Dry run: ${frameIds.length} frames would be affected.`);
              console.log(JSON.stringify(frameIds, null, 2));
              return;
            }

            // actual forget: call memvidClient.forget (if exists) or delete via memvidClient.rawRemove
            if (typeof memvidClient.forget === "function") {
              for (const f of frameIds) {
                await memvidClient.forget(archivePath, f);
              }
            } else if (typeof memvidClient.rawRemove === "function") {
              for (const f of frameIds) {
                await memvidClient.rawRemove(archivePath, f);
              }
            } else {
              console.warn("No forget API on memvidClient; manual removal required");
            }

            const entry2 = {
              timestamp: Date.now(),
              level: "audit",
              event: "forget-completed",
              runId: entry.runId,
              frames: frameIds,
              details: { archive, count: frameIds.length },
            } as any;
            logging.structuredLog(entry2);

            console.log(`Forgot ${frameIds.length} frames from ${archive}`);
          } catch (err) {
            console.error(`Error: ${err}`);
            process.exit(1);
          }
        });
    },
    { commands: ["memvid-forget"] },
  );
