import { describe, it, expect } from "vitest";

const tempAudit = "/tmp/memvid-audit-test.log";
process.env.MEMVID_AUDIT_LOG = tempAudit;

import { readFile } from "node:fs/promises";
import { ForgetCli } from "./cli/forget";

describe("forget CLI dry-run", () => {
  it("logs affected frames and does not call forget on dry-run", async () => {
    let registeredAction: any = null;

    const api: any = {
      registerCli: (fn: any) => {
        const builder: any = {
          description: () => builder,
          command: () => builder,
          argument: () => builder,
          option: () => builder,
          action: (act: any) => {
            registeredAction = act;
            return builder;
          },
        };
        const program = { command: () => builder };
        fn({ program });
      },
    };

    const sampleResults = [{ frameId: "f1" }, { frameId: "f2" }];

    const mockClient: any = {
      validateArchiveDir: (name: string) => name,
      search: async (q: string, archive: string, limit: number) => sampleResults,
      forget: async (archive: string, id: string) => {
        throw new Error("should not be called in dry-run");
      },
      rawRemove: undefined,
    };

    ForgetCli(api as any, mockClient as any);
    expect(registeredAction).not.toBeNull();

    // call the action
    await registeredAction("test-archive", { query: "q", dryRun: true });

    // read audit log (wait for async write)
    const fs = await import("node:fs/promises");
    let content = "";
    for (let i = 0; i < 200; i++) {
      try {
        content = await fs.readFile(tempAudit, "utf-8");
        break;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    expect(content).toContain("forget-request");
    expect(content).toContain("f1");
    expect(content).toContain("f2");
  });
});
