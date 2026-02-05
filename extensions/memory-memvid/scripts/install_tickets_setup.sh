#!/usr/bin/env bash
# Installer stub for tickets & capacity controls
# This script is interactive and DOES NOT run automatically. It helps the operator opt-in and configure settings.

echo "Memvid Tickets & Capacity Setup Installer (stub)"
read -p "Enable monitoring scripts? (y/N) " enable_monitor
if [[ "$enable_monitor" =~ ^[Yy] ]]; then
  echo "Monitoring will be enabled in your local config (manual step)."
else
  echo "Monitoring left disabled. To enable later, set MEMVID_ENABLE_MONITOR=1 in your env."
fi

read -p "Enable auto-expand (disabled by default)? (y/N) " enable_auto
if [[ "$enable_auto" =~ ^[Yy] ]]; then
  read -p "Set manual confirm threshold in GB (default 10): " manual_gb
  manual_gb=${manual_gb:-10}
  echo "Auto-expand will be enabled (manual threshold ${manual_gb}GB)."
  echo "Please review scripts/install_tickets_setup.sh and enable in your service config when ready."
else
  echo "Auto-expand left disabled. Use CLI flag --auto-expand to enable temporarily."
fi

echo "Installer stub complete. No changes were made. Review scripts/ and src/utils/tickets_guard.ts for implementation details."
