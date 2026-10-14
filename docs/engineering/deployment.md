# Deployment

AKSI runs on a single Ubuntu VPS as native OS services — no containers. Two fully isolated
environments share the box: **production** and **staging**. Each has its own API process,
its own web app process (both systemd services), and its own Postgres database. DNS and TLS are
handled by Cloudflare (proxied/orange-cloud), terminating at Caddy on the VPS via a Cloudflare
Origin CA certificate.

## Domains

| Hostname | Serves | Environment |
|---|---|---|
| `aksisport.com` | landing page (placeholder for now) | production |
| `www.aksisport.com` | permanent redirect to `aksisport.com` | production |
| `app.aksisport.com` | web app | production |
| `api.aksisport.com` | API | production |
| `dev.aksisport.com` | landing page (placeholder for now) | staging |
| `app-dev.aksisport.com` | web app | staging |
| `api-dev.aksisport.com` | API | staging |

## Branches

- `dev` → development. Work lands here; once complete it is merged into `master`.
- `master` → the latest code. Not deployed anywhere.
- `staging` → staging (auto-deployed by `.github/workflows/deploy-staging.yml`). Commits are
  cherry-picked from `master`; `master` is then rebased onto `staging`.
- `production` → production (auto-deployed by `.github/workflows/deploy-production.yml`).
  Commits are cherry-picked from `staging`; the other branches are then rebased so `master`
  stays the latest.

Both workflows SSH into the VPS on push and run the matching `deploy/<env>/deploy.sh`. No one
needs to SSH in manually for a routine deploy.

- `scorer` → Vercel. The legacy no-login tennis scorer, frozen at the last commit where the
  web build still rendered it. Vercel's production branch must point here, not at `master`:
  once `dev` is merged into `master`, the web build is the Aksi app, which belongs on `app.aksisport.com`,
  not on Vercel. Nothing is merged into `scorer`.

## One-time VPS provisioning

Run once, in order, when setting up the VPS from scratch.

### 0. Create the `staging` and `production` branches

From your local machine, before cloning on the VPS (step 9): both branches must exist on
GitHub and contain `deploy/`.

### 1. As root — create the `deploy` user and lock down SSH

```bash
adduser --disabled-password --gecos "" deploy
mkdir -p /home/deploy/.ssh
# paste your public key in place of the placeholder below
echo "ssh-ed25519 AAAA...your-public-key... you@laptop" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Edit `/etc/ssh/sshd_config`: set `PermitRootLogin no` and `PasswordAuthentication no`, then:

```bash
systemctl restart ssh
```

**Open a new terminal and confirm `ssh deploy@<vps-ip>` works before closing this root session.**

### 2. ufw

```bash
apt update && apt -y upgrade
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3. Postgres — one instance, two databases

```bash
apt install -y postgresql
grep listen_addresses /etc/postgresql/*/main/postgresql.conf
# confirm it reads 'localhost' (Ubuntu's packaged default); if not, set it and `systemctl restart postgresql`

sudo -u postgres psql <<'EOF'
CREATE ROLE aksi_production_user LOGIN PASSWORD 'REPLACE_ME_PROD';
CREATE DATABASE aksi_production OWNER aksi_production_user;
CREATE ROLE aksi_staging_user LOGIN PASSWORD 'REPLACE_ME_STAGING';
CREATE DATABASE aksi_staging OWNER aksi_staging_user;
EOF
```

### 4. Go toolchain

Installed from the official tarball (matching `server/go.mod`'s `go 1.25.2`) rather than apt,
which typically lags:

```bash
curl -LO https://go.dev/dl/go1.25.2.linux-amd64.tar.gz
rm -rf /usr/local/go
tar -C /usr/local -xzf go1.25.2.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
source /etc/profile.d/go.sh
go version   # expect go1.25.2
```

### 5. Node.js

Node 22 LTS (Node 20 reaches end of life in 2026). Only needed to build the web app and to run
`serve`; no global packages.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v && npm -v
```

### 6. Caddy

Official apt repo — sets up its own systemd unit and `caddy` user/group automatically.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

Caddy's `reverse_proxy` passes WebSockets through unchanged, so the live
connection (`/v1/live`, DP-021) needs no extra Caddy or Cloudflare
setting; Cloudflare proxies WebSockets on every plan and closes ones idle
for about 100 seconds, which the server's 25-second ping prevents. Run a
single API process per environment: the live hub is in memory.

### 7. Cloudflare — Origin CA certificate

In the Cloudflare dashboard (not CLI): SSL/TLS → Origin Server → Create Certificate →
hostnames `aksisport.com` and `*.aksisport.com` → 15-year validity → copy both the
certificate and the private key (shown once). One cert pair covers all six subdomains.

```bash
mkdir -p /etc/caddy/certs
nano /etc/caddy/certs/aksisport-wildcard.pem   # paste the certificate
nano /etc/caddy/certs/aksisport-wildcard.key   # paste the private key
chown root:caddy /etc/caddy/certs/aksisport-wildcard.*
chmod 640 /etc/caddy/certs/aksisport-wildcard.*
```

### 8. Cloudflare — DNS

In the dashboard: a proxied (orange-cloud) `A` record for `@` (apex `aksisport.com`) → VPS IP,
and proxied records for `www`, `app`, `api`, `dev`, `app-dev`, `api-dev` — either `A` → VPS IP
or `CNAME` → `aksisport.com` (equivalent; CNAMEs mean an IP change touches one record). Then SSL/TLS → Overview → set mode to
**Full (Strict)** — this is what makes Cloudflare's edge validate the Origin CA cert Caddy
presents.

### 9. As `deploy` — GitHub deploy key + clone both checkouts

```bash
ssh-keygen -t ed25519 -C "aksi-vps-deploy" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
# add this as a read-only Deploy Key: GitHub repo → Settings → Deploy keys → Add deploy key

sudo mkdir -p /opt/aksi-production /opt/aksi-staging
sudo chown deploy:deploy /opt/aksi-production /opt/aksi-staging
git clone -b production git@github.com:<org>/<repo>.git /opt/aksi-production
git clone -b staging git@github.com:<org>/<repo>.git /opt/aksi-staging
```

### 10. Caddyfile

```bash
sudo cp /opt/aksi-production/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

This file is shared infrastructure. Neither deploy workflow touches it — it's only reloaded
manually when a domain changes.

### 11. Secrets

`/etc/aksi/production.env`, `/etc/aksi/production-web.env`, `/etc/aksi/staging.env`,
`/etc/aksi/staging-web.env` live outside the repo entirely and are hand-provisioned. Fill in
real values — DB credentials from step 3, each environment's own Firebase project:

```bash
sudo mkdir -p /etc/aksi
sudo tee /etc/aksi/production.env <<'EOF'
PORT=8080
DATABASE_URL=postgres://aksi_production_user:REPLACE_ME_PROD@localhost:5432/aksi_production?sslmode=disable
FIREBASE_PROJECT_ID=<prod-firebase-project-id>
ALLOWED_ORIGINS=https://app.aksisport.com
# Account email (DP-015). Without RESEND_API_KEY, confirmation and reset
# codes are written to the server log instead of being emailed. MAIL_FROM
# must be an address on a domain verified in Resend (DNS records added in
# Cloudflare); without it only Resend's test sender is used, which
# delivers to the Resend account owner's address alone.
RESEND_API_KEY=<resend-api-key>
MAIL_FROM=Aksi <no-reply@aksisport.com>
# Optional. Path to a Firebase service account key (Firebase console >
# Project settings > Service accounts > Generate new private key), readable
# only by the API's user. Enables password recovery (DP-015); without it
# everything else works and recovery reports itself unavailable.
FIREBASE_SERVICE_ACCOUNT_FILE=/etc/aksi/production-firebase-admin.json
# Rate limiting on public routes needs each visitor's real address. Behind
# Cloudflare the TCP peer is Caddy, so read Cloudflare's header — believed
# only from the local Caddy (TRUSTED_PROXIES defaults to 127.0.0.1,::1).
# Without this, every visitor shares one rate limit.
CLIENT_IP_HEADER=CF-Connecting-IP
# Push notifications (DP-018). Web Push keys are generated on first start
# and stored in the database — nothing to provision. VAPID_SUBJECT is how
# browser push services can reach the operator (defaults to
# https://app.aksisport.com). EXPO_ACCESS_TOKEN only if the Expo project
# turns on enhanced push security.
# VAPID_SUBJECT=mailto:admin@aksisport.com
EOF

sudo tee /etc/aksi/production-web.env <<'EOF'
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_API_BASE_URL=https://api.aksisport.com
EOF

# repeat for staging: /etc/aksi/staging.env (PORT=8081, aksi_staging_user/aksi_staging,
# ALLOWED_ORIGINS=https://app-dev.aksisport.com, its own RESEND/MAIL_FROM, Firebase
# service account and CLIENT_IP_HEADER=CF-Connecting-IP) and /etc/aksi/staging-web.env
# (staging Firebase project's values, EXPO_PUBLIC_API_BASE_URL=https://api-dev.aksisport.com)

sudo chown root:deploy /etc/aksi/*.env
sudo chmod 640 /etc/aksi/*.env
```

`ALLOWED_ORIGINS` is read verbatim into the `Access-Control-Allow-Origin` header (not a parsed
list) — each environment gets exactly one origin value.

### 12. First build, by hand, in each checkout

```bash
cd /opt/aksi-production/server && go build -o bin/aksi-server ./cmd/api
cd /opt/aksi-production && npm ci && set -a && source /etc/aksi/production-web.env && set +a && npm run build:web

cd /opt/aksi-staging/server && go build -o bin/aksi-server ./cmd/api
cd /opt/aksi-staging && npm ci && set -a && source /etc/aksi/staging-web.env && set +a && npm run build:web
```

### 13. systemd units

Four units, two per environment: the API (`aksi-api-<env>`, the Go binary) and the web app
(`aksi-web-<env>`, `serve -s dist` bound to `127.0.0.1` so only Caddy reaches it). `enable`
makes them start on boot.

```bash
sudo cp /opt/aksi-production/deploy/production/aksi-api.service /etc/systemd/system/aksi-api-production.service
sudo cp /opt/aksi-production/deploy/production/aksi-web.service /etc/systemd/system/aksi-web-production.service
sudo cp /opt/aksi-staging/deploy/staging/aksi-api.service /etc/systemd/system/aksi-api-staging.service
sudo cp /opt/aksi-staging/deploy/staging/aksi-web.service /etc/systemd/system/aksi-web-staging.service
sudo systemctl daemon-reload
sudo systemctl enable --now aksi-api-production aksi-web-production aksi-api-staging aksi-web-staging
```

Unit files are copied, not symlinked, so a change to `deploy/<env>/*.service` needs this step
repeated by hand (deploys don't reinstall units).

### 14. Logs

Everything goes to the journal:

```bash
journalctl -u aksi-api-production -f
journalctl -u aksi-web-production -n 100
```

### 15. Narrow sudoers rule

CI needs to restart the systemd units without a password, but only those four commands:

```bash
sudo visudo -f /etc/sudoers.d/deploy-aksi
```

Paste exactly:

```
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart aksi-api-production, /usr/bin/systemctl restart aksi-api-staging, /usr/bin/systemctl restart aksi-web-production, /usr/bin/systemctl restart aksi-web-staging
```

```bash
sudo visudo -c
```

### 16. CI-only SSH key

Separate from the GitHub deploy key in step 9 — this one lets CI *into* the VPS, not into
GitHub, so a compromised CI secret can't push to the repo.

```bash
ssh-keygen -t ed25519 -C "aksi-ci-deploy" -f ~/.ssh/ci_deploy -N ""
cat ~/.ssh/ci_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/ci_deploy   # copy this private key into the GitHub Actions secret VPS_SSH_KEY
```

Add repo secrets (Settings → Secrets and variables → Actions): `VPS_HOST` (VPS IP),
`VPS_USER=deploy`, `VPS_SSH_KEY` (the private key just printed).

### 17. Verify

See the checklist below, then push a trivial change to `server/` on `staging` and confirm
`deploy-staging.yml` succeeds and the change is live. Repeat on `production` once that branch
exists.

## Ongoing deploys

Push to `staging` → staging deploys automatically. Push to `production` → production deploys
automatically. Neither requires manual SSH access.

`deploy/<env>/deploy.sh` does, in order: `go build` the API, `systemctl restart` the API unit,
`npm ci` + `npm run build:web` for the web app (with that environment's `EXPO_PUBLIC_*` vars
sourced first, since Expo inlines them at build time), then `systemctl restart` the web unit.

Each GitHub Actions workflow runs this in **two separate SSH steps** — first `git fetch` +
`git reset --hard`, then a fresh SSH call to run `deploy.sh`. A script must never `git
reset`/pull itself and keep executing in the same process; bash reads scripts incrementally
from disk, so self-modifying mid-run risks corrupted execution.

## Backups

`deploy/backup.sh <production|staging>` runs `pg_dump`, gzips it into
`/var/backups/aksi/<env>/`, and prunes anything older than 14 days. **Production only is
backed up** — staging data is disposable, so no cron entry is set up for it.

**Do not add the cron job during initial provisioning.** Set it up only once production has
been deployed and verified running (i.e. after step 17's checklist passes for production, once
the `production` branch exists and `aksi-api-production` / `aksi-web-production` are confirmed
healthy) — a backup job for a database that isn't live yet has nothing to back up. At that
point:

```bash
sudo tee /etc/cron.d/aksi-backup <<'EOF'
0 3 * * * deploy /opt/aksi-production/deploy/backup.sh production
EOF
```

## Landing page

Not built yet. `aksisport.com` and `dev.aksisport.com` currently return a placeholder
`respond` from Caddy so DNS/cert routing is ready. Once that project exists, swap the
placeholder block in `deploy/Caddyfile` for a `reverse_proxy` or `root` + `file_server`
directive and reload Caddy — no DNS or certificate rework needed.

## Verification checklist

- `systemctl status aksi-api-production` / `aksi-api-staging` — active, no restart loop;
  `journalctl -u aksi-api-<env>` shows a successful migration run and `listening on :<port>`
  on the latest start.
- `systemctl status aksi-web-production` / `aksi-web-staging` — active; `systemctl is-enabled`
  on all four units reports `enabled`.
- `curl https://api.aksisport.com/healthz` and `https://api-dev.aksisport.com/healthz` →
  `{"status":"ok"}` through Cloudflare.
- `curl -I https://app.aksisport.com/` and `https://app-dev.aksisport.com/` → 200, and an
  unknown deep path on each also 200 with `index.html` content (not a `serve` 404) — confirms
  SPA fallback.
- `curl -I https://aksisport.com/` and `https://dev.aksisport.com/` → 200 placeholder
  response.
- Each Postgres role can only see its own database (`\l` as `aksi_staging_user` can't reach
  `aksi_production`); `\dt` in each DB shows all migrations applied independently.
- CORS: `curl -H "Origin: https://app.aksisport.com" -I https://api.aksisport.com/v1/...`
  returns `Access-Control-Allow-Origin: https://app.aksisport.com` exactly (and the equivalent
  for staging).
- `sudo ufw status` shows only 22/80/443 allowed.
- Reboot survival: `sudo reboot`, then re-check everything above.
