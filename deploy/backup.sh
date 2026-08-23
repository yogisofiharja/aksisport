#!/usr/bin/env bash
# Usage: deploy/backup.sh <production|staging>
set -euo pipefail

ENV="$1"
DB="aksi_${ENV}"
DEST="/var/backups/aksi/${ENV}"

mkdir -p "$DEST"
pg_dump -U "aksi_${ENV}_user" -h localhost "$DB" | gzip > "${DEST}/$(date +%Y%m%d-%H%M%S).sql.gz"
find "$DEST" -type f -mtime +14 -delete
