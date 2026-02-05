import { describe, it, expect } from "vitest";
import { TicketsCli } from "../src/cli/tickets";

describe("tickets cli integration (mock client)", () => {
  it("list and apply dry-run", async () => {
    let lastAction: any = null;
    const api: any = {
      registerCli: (fn: any) => {
        const builder: any = {
          description: () => builder,
          command: () => builder,
          argument: () => builder,
          option: () => builder,
          action: (act: any) => {
            lastAction = act;
            return builder;
          },
        };
        const program = { command: () => builder };
        fn({ program });
      },
    };

    const mockClient: any = {
      validateArchiveDir: (n: string) => `/tmp/${n}.mv2`,
      listTickets: async (path: string) => ({
        ticket: { seq_no: 2, capacity_bytes: 1073741824 },
        usage: { usage_percent: 90 },
      }),
      checkCapacity: async (path: string) => ({
        capacityBytes: 1073741824,
        currentBytes: 900000000,
        usagePercent: 90,
        shouldExpand: true,
      }),
      expandCapacity: async (path: string, bytes: number) => {
        return { ok: true, bytes };
      },
      scheduler: {
        listJobs: () => [],
        deleteJob: async (id: string) => {},
        runDueJobs: async () => {},
        _saveState: async () => {},
      },
    };

    TicketsCli(api, mockClient);
    expect(lastAction).not.toBeNull();

    // simulate calling 'list' action
    await lastAction("list", { archive: "test-archive", raw: false });
  });
});
