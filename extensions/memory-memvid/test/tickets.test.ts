import { describe, it, expect } from "vitest";
import { TicketsCli } from "../src/cli/tickets";
import { genRunId } from "../src/utils/logging";

describe("tickets cli stubs", () => {
  it("registers commands and supports dry-run", async () => {
    let registeredAction: any = null;
    const api: any = {
      registerCli: (fn: any) => {
        const builder: any = {
          description: () => builder,
          command: () => builder,
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

    const mockClient: any = {};
    TicketsCli(api, mockClient);
    expect(registeredAction).not.toBeNull();

    // call action with dry-run
    await registeredAction({ dryRun: true, autoExpand: false });
  });
});
