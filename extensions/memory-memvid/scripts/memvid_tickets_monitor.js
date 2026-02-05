#!/usr/bin/env node
// memvid_tickets_monitor.js
// Poll memvid tickets and alert if usagePercent exceeds threshold.

const fs = require("fs");
const path = require("path");

const DEFAULT_THRESHOLD = process.env.MEMVID_TICKETS_THRESHOLD
  ? Number(process.env.MEMVID_TICKETS_THRESHOLD)
  : 85;
const AUDIT_LOG =
  process.env.MEMVID_AUDIT_LOG ||
  path.join(process.env.HOME || "/tmp", ".openclaw", "memvid-audit.log");

async function checkTickets(memvidClient) {
  // memvidClient is optional; if not provided we attempt to use CLI via child_process (not implemented)
  if (!memvidClient || !memvidClient.tickets) {
    console.log("No memvidClient provided to monitor; exiting (not configured).");
    return;
  }
  const tickets = await memvidClient.tickets.list();
  // tickets expected shape: { usagePercent: number, capacityBytes: number, usedBytes: number }
  if (tickets.usagePercent >= DEFAULT_THRESHOLD) {
    const msg = `ALERT: memvid usage ${tickets.usagePercent}% >= threshold ${DEFAULT_THRESHOLD}%`;
    console.log(msg);
    // append audit entry
    try {
      const entry = {
        timestamp: Date.now(),
        level: "audit",
        event: "tickets-threshold-exceeded",
        details: tickets,
      };
      fs.mkdirSync(path.dirname(AUDIT_LOG), { recursive: true });
      fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + "\n");
    } catch (e) {
      console.error("Failed to write audit alert", e);
    }
  }
}

module.exports = { checkTickets };
