import { genRunId, structuredLog } from "../utils/logging";

export function TicketsCli(api: any, memvidClient: any) {
  api.registerCli(({ program }: any) => {
    const ticketsCmd = program.command("tickets").description("Ticket operations: list/apply");

    ticketsCmd
      .command("list")
      .description("List tickets and usage for an archive")
      .argument("<archive>", "Archive name")
      .option("--raw", "Print raw JSON", false)
      .action(async (archive: string, opts: any) => {
        const runId = genRunId();
        try {
          const archivePath = memvidClient.validateArchiveDir(archive);
          const info = await memvidClient.listTickets(archivePath);
          structuredLog({
            timestamp: Date.now(),
            level: "info",
            event: "tickets-list",
            runId,
            details: {
              archive,
              summary: { ticket: info.ticket?.seq_no, capacity: info.ticket?.capacity_bytes },
            },
          });
          if (opts.raw) console.log(JSON.stringify(info, null, 2));
          else
            console.log(
              `Archive: ${archive}\nTicket seq: ${info.ticket?.seq_no} capacity: ${info.ticket?.capacity_bytes} usage: ${info.usage?.usage_percent}%`,
            );
        } catch (e) {
          structuredLog({
            timestamp: Date.now(),
            level: "error",
            event: "tickets-list-failed",
            runId,
            details: { archive, error: String(e) },
          });
          console.error(`Failed to list tickets: ${e}`);
        }
      });

    ticketsCmd
      .command("apply")
      .description("Apply/issue tickets according to plan")
      .argument("<archive>", "Archive name")
      .option("--dry-run", "Preview only", false)
      .option("--auto-expand", "Enable auto-apply (disabled by default)", false)
      .option("--bytes <n>", "Force issue ticket with capacity bytes")
      .action(async (archive: string, opts: any) => {
        const runId = genRunId();
        try {
          const archivePath = memvidClient.validateArchiveDir(archive);
          const stats = await memvidClient.checkCapacity(archivePath);
          structuredLog({
            timestamp: Date.now(),
            level: "info",
            event: "tickets-apply-evaluate",
            runId,
            details: { archive, stats },
          });

          if (!opts.autoExpand && !opts.bytes) {
            console.log(
              "Auto-apply is disabled by default. Use --auto-expand to enable or --bytes to force.",
            );
            return;
          }

          const recommendBytes = opts.bytes ? Number(opts.bytes) : stats.capacityBytes * 2;

          if (opts.dryRun) {
            structuredLog({
              timestamp: Date.now(),
              level: "audit",
              event: "tickets-apply-preview",
              runId,
              details: { archive, recommendBytes },
            });
            console.log(
              `Dry run: would issue ticket for ${archive} with capacity ${recommendBytes} bytes`,
            );
            return;
          }

          // Perform apply
          await memvidClient.expandCapacity(archivePath, recommendBytes);
          structuredLog({
            timestamp: Date.now(),
            level: "audit",
            event: "tickets-apply-completed",
            runId,
            details: { archive, bytes: recommendBytes },
          });
          console.log(`Applied ticket for ${archive}: ${recommendBytes} bytes`);
        } catch (e) {
          structuredLog({
            timestamp: Date.now(),
            level: "error",
            event: "tickets-apply-failed",
            runId,
            details: { archive, error: String(e) },
          });
          console.error(`Failed to apply tickets: ${e}`);
        }
      });
    const schedulerCmd = program
      .command("scheduler")
      .description("Scheduler operations (list/cancel/run)");

    schedulerCmd
      .command("list")
      .description("List scheduled jobs")
      .action(async () => {
        try {
          const jobs = memvidClient.scheduler.listJobs();
          console.log(JSON.stringify(jobs, null, 2));
        } catch (e) {
          console.error(`Failed to list scheduler jobs: ${e}`);
        }
      });

    schedulerCmd
      .command("cancel")
      .description("Cancel a scheduled job")
      .argument("<jobId>", "Job id")
      .option("--elevated", "Require elevated permission to cancel", false)
      .action(async (jobId: string, opts: any) => {
        try {
          const allowed = opts.elevated || process.env.MEMVID_ELEVATED === "1";
          if (!allowed) {
            console.error(
              "Elevated permission required to cancel jobs. Use --elevated or set MEMVID_ELEVATED=1",
            );
            return;
          }
          await memvidClient.scheduler.deleteJob(jobId);
          console.log(`Cancelled job ${jobId}`);
        } catch (e) {
          console.error(`Failed to cancel job: ${e}`);
        }
      });

    schedulerCmd
      .command("run-due")
      .description("Run due scheduled jobs now")
      .option("--elevated", "Require elevated permission to run due jobs", false)
      .action(async (opts: any) => {
        try {
          const allowed = opts.elevated || process.env.MEMVID_ELEVATED === "1";
          if (!allowed) {
            console.error(
              "Elevated permission required to run due jobs. Use --elevated or set MEMVID_ELEVATED=1",
            );
            return;
          }
          await memvidClient.scheduler.runDueJobs(memvidClient);
          console.log("Run due jobs completed");
        } catch (e) {
          console.error(`Failed to run due jobs: ${e}`);
        }
      });

    schedulerCmd
      .command("enqueue")
      .description("Enqueue a retry job for an archive")
      .argument("<archive>", "Archive name")
      .argument("<bytes>", "Recommended bytes")
      .action(async (archive: string, bytes: string) => {
        try {
          const archivePath = memvidClient.validateArchiveDir(archive);
          const id = memvidClient.scheduler.enqueueRetry(archivePath, Number(bytes));
          console.log(`Enqueued job ${id} for ${archive} recommending ${bytes} bytes`);
        } catch (e) {
          console.error(`Failed to enqueue job: ${e}`);
        }
      });
  });
}
