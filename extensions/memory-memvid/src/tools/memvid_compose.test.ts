import { describe, it, expect } from "vitest";
import { memvidCompose } from "./memvid_compose";

describe("memvid_compose tool", () => {
  it("registers and executes compose with mocked client", async () => {
    let registeredTool: any = null;

    const mockApi: any = {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      registerTool: (tool: any) => {
        registeredTool = tool;
      },
    };

    const sampleResults = [
      {
        archiveName: "a",
        content: "First memory content",
        score: 0.9,
        frameId: "1",
        metadata: {
          timestamp: Date.now() - 1000,
          sensitivity: "public",
          summary: "First memory",
          uri: "mv2://a/1",
          frameIndex: 1,
        },
      },
      {
        archiveName: "a",
        content: "Second memory content",
        score: 0.6,
        frameId: "2",
        metadata: {
          timestamp: Date.now() - 1000 * 60 * 60 * 24 * 40,
          sensitivity: "private",
          summary: "Second memory",
          uri: "mv2://a/2",
          frameIndex: 2,
        },
      },
    ];

    const mockClient: any = {
      search: async (query: string, archivePath: string | undefined, limit: number) => {
        return sampleResults;
      },
      validateArchiveDir: (name: string) => name,
    };

    memvidCompose(mockApi, mockClient);
    expect(registeredTool).not.toBeNull();

    const res = await registeredTool.execute("call-1", {
      query: "test",
      limit: 2,
      tokenBudget: 100,
    });
    expect(res.details.query).toBe("test");
    expect(res.details.resultsCount).toBe(sampleResults.length);
    expect(res.content[0].data).toHaveProperty("decisions");
  });
});
