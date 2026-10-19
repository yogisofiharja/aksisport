# Aksi

A platform that helps sports communities organize their activities:
Communities, Sessions, matches with live scoring, payments and chat.
One Expo + React Native + TypeScript codebase for iOS, Android and web,
with a Go API in `server/`.

This README covers setup only. For how the app works and where things
are, see `docs/` (start with `docs/AKSI_PRODUCT_DECISIONS.md` and
`docs/current/repository-map.md`).

## App

```bash
npm install
cp .env.example .env   # Firebase web config and EXPO_PUBLIC_API_BASE_URL
npm run web            # or: npm start, then press i / a for a simulator
```

In development, a local `EXPO_PUBLIC_API_BASE_URL` (localhost or a
private-network address, e.g. `http://localhost:8080`) follows the host the
app was loaded from, so a new Wi-Fi address needs no `.env` change.

## API

Needs Go and a Postgres database.

```bash
cd server
cp .env.example .env   # DATABASE_URL, FIREBASE_PROJECT_ID, ALLOWED_ORIGINS, …
make migrate-up        # forward-only migrations in server/migrations
make run
```

Optional settings in `server/.env.example`: `RESEND_API_KEY` and
`MAIL_FROM` for email, `FIREBASE_SERVICE_ACCOUNT_FILE` for password
changes, `CLIENT_IP_HEADER` / `TRUSTED_PROXIES` behind a proxy. Keep
secrets out of the repository.

## Tests

```bash
npm test               # app (vitest)
cd server && make test # API (go test)
```

## Deploying

Staging and production run on a VPS, deployed from the `staging` and
`production` branches; see `docs/engineering/deployment.md`. The original
standalone scorer is frozen on the `scorer` branch and served by Vercel.
