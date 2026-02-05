import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import {
  ArchiveInfo,
  CapacityInfo,
  Entry,
  IssueTicketOptions,
  SearchResult,
  Stats,
  TicketInfo,
  TimelineEntry,
  TimelineOptions,
} from "./types/types";
import logging from "./utils/logging";
/**
 * Memvid CLI wrapper client
 *
 * This version streams subprocess stdout/stderr live to the injected logger
 * and optionally to the process stdout/stderr when running locally. Streaming
 * can be disabled by setting MEMVID_STREAM_OUTPUT=0 in the environment.
 */
import * as scheduler from "./utils/scheduler";

export class MemvidClient {
  public scheduler: any;

  constructor(
    private memvidPath: string,
    private archivesDir: string,
    private apiKey: string,
    private capacityThreshold: number,
    private logger?: OpenClawPluginApi["logger"],
  ) {
    // attach scheduler API for CLI integration
    this.scheduler = {
      enqueueRetry: scheduler.enqueueRetry,
      runDueJobs: scheduler.runDueJobs,
      listJobs: scheduler.listJobs,
      deleteJob: scheduler.deleteJob,
    };
  }

  getArchivesDir(): string {
    return this.archivesDir;
  }

  getCliPath(): string {
    return this.memvidPath;
  }

  validateArchiveDir(archive: string): string {
    return join(this.getArchivesDir(), archive.endsWith(".mv2") ? archive : `${archive}.mv2`);
  }

  /**
   * Execute memvid CLI command and stream output.
   */
  private async exec(args: string[], archivePath?: string): Promise<string> {
    const cmd = [this.memvidPath, ...args];
    if (archivePath) {
      cmd.push(archivePath);
    }

    const env = { ...process.env } as Record<string, string | undefined>;
    if (this.apiKey) {
      env.MEMVID_API_KEY = this.apiKey;
    }

    const streamEnabled = env.MEMVID_STREAM_OUTPUT !== "0";

    return new Promise<string>((resolve, reject) => {
      try {
        const child = spawn(cmd[0], cmd.slice(1), { env });

        let stdoutBuf = "";
        let stderrBuf = "";

        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stdoutBuf += text;
          // Log live
          this.logger?.info?.(`memvid: ${text.trim()}`);
          if (streamEnabled) process.stdout.write(text);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stderrBuf += text;
          // Warn live
          this.logger?.warn?.(`memvid [stderr]: ${text.trim()}`);
          if (streamEnabled) process.stderr.write(text);
        });

        child.on("error", (err) => {
          this.logger?.error?.(`memvid command spawn failed: ${cmd.join(" ")} - ${String(err)}`);
          reject(err);
        });

        child.on("close", (code) => {
          if (stderrBuf && !stderrBuf.includes("Warning")) {
            // already logged incrementally; keep a concise warning
            this.logger?.warn?.(`memvid finished with stderr output`);
          }

          if (code !== 0) {
            const message = `memvid exited ${code}: ${stderrBuf || stdoutBuf}`;
            this.logger?.error?.(message);
            return reject(new Error(message));
          }

          resolve(stdoutBuf.trim());
        });
      } catch (err) {
        this.logger?.error?.(
          `memvid command failed (exception): ${cmd.join(" ")} - ${String(err)}`,
        );
        reject(err);
      }
    });
  }

  /**
   * Create a new archive with immediate ticket issuance
   */
  async createArchive(name: string): Promise<string> {
    const archivePath = join(this.archivesDir, name.endsWith(".mv2") ? name : `${name}.mv2`);

    // Create the archive
    await this.exec(["create", archivePath]);
    this.logger?.info?.(`Created archive: ${archivePath}`);

    // Immediately issue self-hosted ticket with 1GB capacity
    const oneGB = 1073741824;
    await this.issueTicket(archivePath, {
      issuer: "openclaw.local",
      seq: 2,
      capacity: oneGB,
    });
    this.logger?.info?.(`Issued initial 1GB ticket for: ${archivePath}`);

    return archivePath;
  }

  /**
   * Get archive information
   */
  async getArchiveInfo(archivePath: string): Promise<ArchiveInfo> {
    const archiveStat = await stat(archivePath);
    return {
      name: basename(archivePath),
      path: archivePath,
      sizeBytes: archiveStat.size,
    };
  }

  /**
   * List all archives in archivesDir
   */
  async listArchives(): Promise<ArchiveInfo[]> {
    try {
      const files = await readdir(this.archivesDir);
      const archives: ArchiveInfo[] = [];

      for (const file of files) {
        if (file.endsWith(".mv2")) {
          const path = join(this.archivesDir, file);
          try {
            const info = await this.getArchiveInfo(path);
            archives.push(info);
          } catch (err) {
            this.logger?.warn?.(`Failed to read archive ${file}: ${err}`);
          }
        }
      }

      return archives;
    } catch (err) {
      this.logger?.warn?.(`Failed to list archives: ${err}`);
      return [];
    }
  }

  /**
   * Ensure archive exists, create if not
   */
  async ensureArchive(name: string): Promise<string> {
    const archivePath = join(this.archivesDir, name.endsWith(".mv2") ? name : `${name}.mv2`);

    try {
      await stat(archivePath);
      return archivePath;
    } catch {
      return await this.createArchive(name);
    }
  }

  /**
   * Put content into archive
   */
  async put(
    archivePath: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const runId = logging.genRunId();
    const start = Date.now();
    logging.structuredLog({
      timestamp: start,
      level: "info",
      event: "put-start",
      runId,
      details: { archivePath, preview: (content || "").substring(0, 200), metadata },
      reason: "starting put",
    });
    // Use memvid put with stdin via spawn so we can stream
    const metaJson = metadata ? JSON.stringify(metadata) : "{}";
    const args = ["put", archivePath, "--metadata", metaJson];

    const env = { ...process.env } as Record<string, string | undefined>;
    if (this.apiKey) {
      env.MEMVID_API_KEY = this.apiKey;
    }

    const streamEnabled = env.MEMVID_STREAM_OUTPUT !== "0";

    return new Promise<string>((resolve, reject) => {
      try {
        const child = spawn(this.memvidPath, args, { env });

        let stdoutBuf = "";
        let stderrBuf = "";

        // write content to stdin
        child.stdin.write(content);
        child.stdin.end();

        child.stdout?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stdoutBuf += text;
          this.logger?.info?.(`memvid: ${text.trim()}`);
          if (streamEnabled) process.stdout.write(text);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stderrBuf += text;
          this.logger?.warn?.(`memvid [stderr]: ${text.trim()}`);
          if (streamEnabled) process.stderr.write(text);
        });

        child.on("error", (err) => {
          this.logger?.error?.(`memvid put spawn failed: ${args.join(" ")} - ${String(err)}`);
          reject(err);
        });

        child.on("close", async (code) => {
          const end = Date.now();
          const latency = end - start;

          if (code !== 0) {
            const message = `memvid put exited ${code}: ${stderrBuf || stdoutBuf}`;
            this.logger?.error?.(message);
            logging.structuredLog({
              timestamp: end,
              level: "error",
              event: "put-failed",
              runId,
              details: { archivePath, stderr: stderrBuf || stdoutBuf },
              latencyMs: latency,
              reason: "put-exit-nonzero",
            });
            return reject(new Error(message));
          }

          const frameId = stdoutBuf.trim();

          try {
            // Check capacity after put
            await this.checkAndExpandCapacity(archivePath);
            logging.structuredLog({
              timestamp: end,
              level: "audit",
              event: "put-completed",
              runId,
              frames: [frameId],
              details: { archivePath, metadata },
              latencyMs: latency,
              reason: "stored",
            });
            resolve(frameId);
          } catch (err) {
            logging.structuredLog({
              timestamp: end,
              level: "warn",
              event: "put-completed-check-failed",
              runId,
              frames: [frameId],
              details: { archivePath, err: String(err) },
              latencyMs: latency,
              reason: "post-put-check-failed",
            });
            reject(err);
          }
        });
      } catch (err) {
        this.logger?.error?.(`memvid put failed (exception): ${args.join(" ")} - ${String(err)}`);
        reject(err);
      }
    });
  }

  /**
   * Search archives
   */
  async search(query: string, archivePath?: string, limit = 5): Promise<SearchResult[]> {
    const runId = logging.genRunId();
    const start = Date.now();

    const archives = archivePath ? [archivePath] : (await this.listArchives()).map((a) => a.path);
    const results: SearchResult[] = [];

    for (const archive of archives) {
      try {
        const args = ["find", archive, "--query", `"${query}"`, "--limit", String(limit), "--json"];
        const output = await this.exec(args);

        if (!output) continue;

        const parsed = JSON.parse(output);
        const archiveName = basename(archive);

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            results.push({
              archiveName,
              content: item.content || item.text || "",
              score: item.score,
              frameId: item.frame_id || item.id,
              metadata: item.metadata,
            });
          }
        } else if (parsed && Array.isArray(parsed.hits)) {
          // mv2.result.v2 format (object with hits array)
          for (const hit of parsed.hits) {
            const md = hit.metadata || {};
            // Normalize frame index and uri into metadata for callers
            if (md && typeof md === "object") {
              if (hit.frame_id !== undefined) md.frameIndex = hit.frame_id;
              else if (hit.frameId !== undefined) md.frameIndex = hit.frameId;
              if (hit.uri) md.uri = hit.uri;
            }

            results.push({
              archiveName,
              content: hit.text || hit.content || "",
              score: hit.score || hit.rank || 0,
              frameId:
                hit.frame_id !== undefined
                  ? String(hit.frame_id)
                  : hit.frameId
                    ? String(hit.frameId)
                    : hit.id || hit.uri || "",
              metadata: md,
            });
          }
        }
      } catch (err) {
        this.logger?.warn?.(`Search failed for ${archive}: ${err}`);
      }
    }

    const end = Date.now();
    const latency = end - start;
    logging.structuredLog({
      timestamp: end,
      level: "info",
      event: "search",
      runId,
      details: { query, archives: archives.length },
      latencyMs: latency,
      reason: "search-completed",
      frames: results.map((r) => r.frameId || ""),
    });

    return results.slice(0, limit);
  }

  /**
   * Ask natural language question
   */
  async ask(question: string, archivePath?: string): Promise<string> {
    const archives = archivePath ? [archivePath] : (await this.listArchives()).map((a) => a.path);

    if (archives.length === 0) {
      return "No archives available to query.";
    }

    // Use first archive or specified archive
    const targetArchive = archives[0];
    const args = ["ask", targetArchive, "--question", question];

    try {
      const answer = await this.exec(args);
      return answer || "No answer found.";
    } catch (err) {
      throw new Error(`Failed to ask question: ${err}`);
    }
  }

  /**
   * Get timeline of entries
   */
  async timeline(archivePath: string, options: TimelineOptions = {}): Promise<TimelineEntry[]> {
    const args = ["timeline", archivePath, "--json"];

    if (options.startDate) args.push("--start", options.startDate);
    if (options.endDate) args.push("--end", options.endDate);
    if (options.limit) args.push("--limit", String(options.limit));

    try {
      const output = await this.exec(args);
      const parsed = JSON.parse(output);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((item) => ({
        frameId: item.frame_id || item.id,
        timestamp: item.timestamp || Date.now(),
        content: item.content || item.text || "",
        metadata: item.metadata,
      }));
    } catch (err) {
      throw new Error(`Timeline failed: ${err}`);
    }
  }

  /**
   * View specific entry
   */
  async view(archivePath: string, idOrUri: string): Promise<Entry> {
    // If idOrUri looks like a URI, call with --uri; otherwise use --frame-id
    const isUri = String(idOrUri).startsWith("mv2://") || String(idOrUri).includes("/");

    const args = isUri
      ? ["view", archivePath, "--uri", String(idOrUri), "--json"]
      : ["view", archivePath, "--frame-id", String(idOrUri), "--json"];

    try {
      const output = await this.exec(args);
      let parsed: any;
      try {
        parsed = JSON.parse(output);
      } catch (parseErr) {
        this.logger?.warn?.(`memvid view: failed to parse JSON output: ${parseErr}`);
        parsed = null;
      }

      // If parsed is null or missing content, log raw output for diagnostics
      if (!parsed || (!parsed.content && !parsed.text)) {
        this.logger?.info?.(`memvid view raw output: ${output}`);
      }

      // Prefer parsed.content or parsed.text, but fall back to frame.search_text or frame.content
      let content = parsed?.content || parsed?.text || "";
      if (!content && parsed?.frame && typeof parsed.frame === "object") {
        content = parsed.frame.search_text || parsed.frame.content || parsed.frame.preview || "";
      }

      return {
        frameId: parsed?.frame_id || parsed?.id || parsed?.frame?.id || idOrUri,
        content: content || "",
        timestamp: parsed?.timestamp || parsed?.frame?.timestamp || Date.now(),
        metadata: parsed || {},
      };
    } catch (err) {
      throw new Error(`View failed: ${err}`);
    }
  }

  /**
   * Get archive statistics
   */
  async stats(archivePath: string): Promise<Stats> {
    const args = ["stats", archivePath, "--json"];

    try {
      const output = await this.exec(args);
      const parsed = JSON.parse(output);

      return {
        totalEntries: parsed.total_entries || parsed.count || 0,
        sizeBytes: parsed.size_bytes || parsed.size || 0,
        capacityBytes: parsed.capacity_bytes,
        usagePercent: parsed.usage_percent,
      };
    } catch (err) {
      throw new Error(`Stats failed: ${err}`);
    }
  }

  /**
   * Enrich archive with embeddings
   */
  async enrich(archivePath: string, engine = "basic"): Promise<void> {
    const args = ["enrich", archivePath, "--engine", engine];

    try {
      await this.exec(args);
      this.logger?.info?.(`Enriched ${archivePath} with ${engine} engine`);
    } catch (err) {
      throw new Error(`Enrich failed: ${err}`);
    }
  }

  /**
   * Delete entry from archive
   */
  async delete(archivePath: string, frameId: string): Promise<void> {
    const args = ["delete", archivePath, "--frame-id", frameId];

    try {
      await this.exec(args);
      this.logger?.info?.(`Deleted frame ${frameId} from ${archivePath}`);
    } catch (err) {
      throw new Error(`Delete failed: ${err}`);
    }
  }

  /**
   * Repair archive
   */
  async repair(archivePath: string): Promise<void> {
    const args = ["repair", archivePath];

    try {
      await this.exec(args);
      this.logger?.info?.(`Repaired ${archivePath}`);
    } catch (err) {
      throw new Error(`Repair failed: ${err}`);
    }
  }

  /**
   * Vacuum archive
   */
  async vacuum(archivePath: string): Promise<void> {
    const args = ["vacuum", archivePath];

    try {
      await this.exec(args);
      this.logger?.info?.(`Vacuumed ${archivePath}`);
    } catch (err) {
      throw new Error(`Vacuum failed: ${err}`);
    }
  }

  /**
   * Issue ticket for archive
   */
  async issueTicket(archivePath: string, options: IssueTicketOptions): Promise<void> {
    const args = [
      "tickets",
      "issue",
      archivePath,
      "--issuer",
      options.issuer,
      "--seq",
      String(options.seq),
      "--capacity",
      String(options.capacity),
    ];

    if (options.expiresIn) {
      args.push("--expires-in", String(options.expiresIn));
    }

    try {
      await this.exec(args);
      this.logger?.info?.(
        `Issued ticket for ${archivePath}: seq=${options.seq}, capacity=${options.capacity}`,
      );
    } catch (err) {
      throw new Error(`Issue ticket failed: ${err}`);
    }
  }

  /**
   * List tickets for archive
   */
  async listTickets(archivePath: string): Promise<TicketInfo> {
    const args = ["tickets", "list", archivePath, "--json"];

    try {
      const output = await this.exec(args);
      const parsed = JSON.parse(output);
      return parsed as TicketInfo;
    } catch (err) {
      throw new Error(`List tickets failed: ${err}`);
    }
  }

  /**
   * Revoke ticket for archive
   */
  async revokeTicket(archivePath: string): Promise<void> {
    const args = ["tickets", "revoke", archivePath];

    try {
      await this.exec(args);
      this.logger?.info?.(`Revoked ticket for ${archivePath}`);
    } catch (err) {
      throw new Error(`Revoke ticket failed: ${err}`);
    }
  }

  /**
   * Check archive capacity
   */
  async checkCapacity(archivePath: string): Promise<CapacityInfo> {
    try {
      const ticketInfo = await this.listTickets(archivePath);

      const capacityBytes = ticketInfo.ticket?.capacity_bytes || 0;
      const currentBytes = ticketInfo.usage?.usage_bytes || 0;
      const usagePercent = ticketInfo.usage?.usage_percent || 0;
      const shouldExpand = usagePercent >= this.capacityThreshold;

      return {
        capacityBytes,
        currentBytes,
        usagePercent,
        shouldExpand,
      };
    } catch (err) {
      throw new Error(`Check capacity failed: ${err}`);
    }
  }

  /**
   * Expand archive capacity
   */
  async expandCapacity(archivePath: string, newSizeBytes: number): Promise<void> {
    try {
      const ticketInfo = await this.listTickets(archivePath);
      const currentSeq = ticketInfo.ticket?.seq_no || 1;
      const issuer = ticketInfo.ticket?.issuer || "openclaw.local";

      await this.issueTicket(archivePath, {
        issuer,
        seq: currentSeq + 1,
        capacity: newSizeBytes,
      });

      this.logger?.info?.(`Expanded ${archivePath} to ${(newSizeBytes / 1024 ** 3).toFixed(2)} GB`);
    } catch (err) {
      throw new Error(`Expand capacity failed: ${err}`);
    }
  }

  /**
   * Check capacity after operation and auto-expand if needed
   */
  private async checkAndExpandCapacity(archivePath: string): Promise<void> {
    try {
      const capacity = await this.checkCapacity(archivePath);

      if (capacity.shouldExpand) {
        const newCapacity = capacity.capacityBytes * 2;
        await this.expandCapacity(archivePath, newCapacity);
      }
    } catch (err) {
      this.logger?.warn?.(`Auto-expand check failed: ${err}`);
    }
  }
}
