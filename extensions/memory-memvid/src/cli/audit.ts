import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { readFile } from "node:fs/promises";
import logging from "../utils/logging";
import masking from "../utils/masking";

export const AuditCli = (api: OpenClawPluginApi) =>
  api.registerCli(
    ({ program }) => {
      const audit = program
        .command("memvid-audit")
        .description("View memvid audit log (masked by default)");

      audit
        .command("list")
        .option("--raw", "Show unmasked audit entries")
        .action(async (opts: any) => {
          try {
            const path = logging.AUDIT_LOG;
            const content = await readFile(path, "utf-8").catch(() => "");
            if (!content) {
              console.log("No audit log found.");
              return;
            }
            const lines = content.split("\n").filter(Boolean);
            for (const l of lines) {
              try {
                const obj = JSON.parse(l);
                const out = opts.raw
                  ? l
                  : (() => {
                      // mask any content fields in details
                      if (obj.details && obj.details.preview) {
                        obj.details.preview = masking.applyMaskToFrameContent(obj.details.preview);
                      }
                      return JSON.stringify(obj);
                    })();
                console.log(out);
              } catch (e) {
                console.log(l);
              }
            }
          } catch (err) {
            console.error(`Error reading audit log: ${err}`);
            process.exit(1);
          }
        });
    },
    { commands: ["memvid-audit"] },
  );
