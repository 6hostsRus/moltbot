import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { MemvidClient } from "./MemvidClient";

describe("MemvidClient smoke tests (using echo as memvid)", () => {
  it("createArchive returns expected archive path", async () => {
    const memvidPath = "echo";
    const archivesDir = join(tmpdir(), "memvid-test-archives");
    const client = new MemvidClient(memvidPath, archivesDir, "", 80, console);

    const archivePath = await client.createArchive("test-archive");
    expect(archivePath.endsWith(".mv2")).toBe(true);
    expect(archivePath.includes("test-archive")).toBe(true);
  });

  it("ensureArchive returns .mv2 path when missing", async () => {
    const memvidPath = "echo";
    const archivesDir = join(tmpdir(), "memvid-test-archives");
    const client = new MemvidClient(memvidPath, archivesDir, "", 80, console);

    const path = await client.ensureArchive("auto-archive");
    expect(path.endsWith(".mv2")).toBe(true);
  });
});
