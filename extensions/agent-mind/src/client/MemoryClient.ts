import { use, Memvid } from "@memvid/sdk";

class MemoryClient {
  private archive: Memvid | null = null;
  private path: string;

  constructor(path: string) {
    this.path = path;
    this.initMemory(path);
  }

  getArchive() {
    return this.archive;
  }

  getPath() {
    return this.path;
  }

  // Initializes access the .mv2 file at the given path, creates if it doesn't exist.
  async initMemory(path: string) {
    try {
      this.archive = await use("basic", path, { mode: "auto" });
    } catch (error) {
      console.error("Failed to initialize memory:", error);
      this.archive = null;
    }
  }
}

export default MemoryClient;
