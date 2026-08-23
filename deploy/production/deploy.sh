#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/go/bin:$PATH"

cd /opt/aksi-production/server
go build -o bin/aksi-server ./cmd/api
sudo systemctl restart aksi-api-production

cd /opt/aksi-production
npm ci
set -a; source /etc/aksi/production-web.env; set +a
npm run build:web
pm2 restart web-production
