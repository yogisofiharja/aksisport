#!/bin/bash
# Run this from iTerm (not VS Code's terminal) — diagnoses whether the DB
# connection is blocked by macOS's per-app Local Network permission, then
# starts the API server if the connection is clear.

DB_HOST="192.168.56.10"
DB_PORT="5432"

echo "== Checking network path to ${DB_HOST}:${DB_PORT} from $(basename "$SHELL") via iTerm =="

echo "-- ping --"
ping -c 2 -t 3 "$DB_HOST"

echo ""
echo "-- TCP connect test (port ${DB_PORT}) --"
nc -G 3 -zv "$DB_HOST" "$DB_PORT"
NC_STATUS=$?

echo ""
if [ $NC_STATUS -ne 0 ]; then
  echo "Still blocked from this app too. Check System Settings > Privacy & Security >"
  echo "Local Network for iTerm specifically — it needs its own entry/approval,"
  echo "separate from VS Code."
  exit 1
fi

echo "Connection OK — starting the API server (Ctrl+C to stop)."
echo ""
cd "$(dirname "$0")" || exit 1
go run ./cmd/api
