import { describe, it, expect } from "vitest";
import { TicketsCli } from "../src/cli/tickets";

describe("scheduler enqueue CLI", () => {
  it("registers enqueue and calls scheduler", async () => {
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
      scheduler: {
        enqueueRetry: (path: string, bytes: number) => "job-123",
      },
    };

    TicketsCli(api, mockClient);
    expect(lastAction).not.toBeNull();

    await lastAction("test-archive", "4096");
  });
});
