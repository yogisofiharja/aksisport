#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/go/bin:$PATH"

cd /opt/aksi-staging/server
go build -o bin/aksi-server ./cmd/api
sudo systemctl restart aksi-api-staging

cd /opt/aksi-staging
npm ci
set -a; source /etc/aksi/staging-web.env; set +a
npm run build:web
sudo systemctl restart aksi-web-staging
