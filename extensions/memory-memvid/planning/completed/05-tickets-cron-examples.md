# Example cron/systemd entries for memvid scheduler

These examples are for documentation only. They are disabled by default — operators should opt-in via the installer script.

Cron (run every 15 minutes):

_/15 _ \* \* \* /usr/bin/env node /path/to/memvid-plugin/scripts/run_scheduler.js >> /var/log/memvid-scheduler.log 2>&1

Systemd timer (recommended for servers):

Create /etc/systemd/system/memvid-scheduler.service:

[Unit]
Description=Memvid Scheduler Runner

[Service]
Type=oneshot
ExecStart=/usr/bin/env node /opt/memvid-plugin/bin/run_scheduler.js

Create /etc/systemd/system/memvid-scheduler.timer:

[Unit]
Description=Run memvid scheduler every 15 minutes

[Timer]
OnCalendar=\*:0/15
Persistent=true

[Install]
WantedBy=timers.target

Notes:

- The run_scheduler.js script should invoke the scheduler runDueJobs and exit with appropriate code.
- The installer stub can offer to write a local systemd unit into the user's home or print instructions.
