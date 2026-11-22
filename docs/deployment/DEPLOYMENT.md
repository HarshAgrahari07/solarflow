# Railway deployment

SunPower is deployed as one Node service. The root Dockerfile builds the Vite
frontend and runs Express, which serves `/`, frontend routes, `/api/*`, and
authorized survey-photo responses from the same HTTPS origin. SQLite and
uploads are stored on a Railway volume, not in the container image.

## Prerequisites and GitHub connection

- A GitHub account with access to `HarshAgrahari07/solarpower`.
- A Railway account and a project connected to that repository.
- A Railway persistent volume mounted at `/app/data` before the first
  production deployment.
- Node 26 is included in the Docker image; do not install a second Node
  runtime in Railway.

In Railway, create a project from the GitHub repository and select the release
branch (or `main` after the release PR is merged). Keep the service root at the
repository root so Railway detects `Dockerfile` and `railway.toml`. Generate a
Railway domain or attach a custom domain. Configure the volume and variables
below, then deploy. Railway builds the Dockerfile and starts the container
with its Docker `CMD`.

## Build and start

From the repository root, an equivalent local container build is:

```sh
docker build -t sunpower-solutions .
```

The image build runs `npm ci --omit=dev --prefix /app/backend`,
`npm ci --prefix /app/frontend`, and `npm run build --prefix /app/frontend`.
The container start command is:

```sh
npm --prefix backend start
```

This is also the Dockerfile `CMD`; Railway should use the Dockerfile rather
than overriding the start command. The API listens on Railway's `PORT` and
binds to `0.0.0.0`. For local development, use `npm run dev` in `backend/` and
`npm run dev` in `frontend/`; the existing Vite `/api` proxy remains enabled.

## Environment variables

Set these in Railway's service Variables. Do not put production values in Git
or in the Docker image.

| Variable | Production value / behavior |
| --- | --- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Required; generate a unique cryptographically random value of at least 32 characters, for example `openssl rand -base64 48`. |
| `DATA_DIR` | `/app/data` |
| `DATABASE_PATH` | `/app/data/sunpower.sqlite` |
| `FILE_STORAGE_PATH` | `/app/data/uploads` |
| `PORT` | Supplied by Railway. The application defaults to `4000` for local use. |
| `FRONTEND_ORIGIN` | Optional. If configured, use the exact HTTPS origin, e.g. `https://your-service.up.railway.app`; otherwise only the request's same origin is accepted. |

Production startup rejects a missing JWT secret, non-HTTPS configured origin,
or a database/upload path outside `DATA_DIR`. Express trusts one Railway proxy
hop, uses secure HttpOnly SameSite=Lax cookies, and never enables
wildcard credentialed CORS.

## Persistent volume and startup

Attach a Railway volume to the service at exactly `/app/data` before the first
deployment. Keep the environment paths exactly as listed:

- SQLite: `/app/data/sunpower.sqlite`
- SQLite WAL/SHM sidecars: created beside the database.
- Managed survey photos: `/app/data/uploads`
- Generated demo credentials, if demo users are seeded: under `/app/data`.

The application creates the data and upload directories, opens SQLite in WAL
mode, enables foreign keys, and applies pending versioned migrations on
startup. Migrations are transactional and fail startup on an error. Application
startup does not seed users or synthetic business data.

## Initial administrator and demo data

Use Railway's service shell (`railway ssh` from the Railway CLI or the
Dashboard shell) to run commands inside the deployed container. Create a
production administrator with a generated password:

```sh
cd /app/backend
npm run admin:create -- --email admin@example.com --full-name "SunPower Administrator"
```

The script applies migrations, creates only an ADMIN account, and stores a
random password in `/app/data/initial-admin-credentials.txt` with private
file permissions. Retrieve it through the authorized service shell, save it in
an approved password manager, and remove the file after securely storing it.
Do not put the password in Git, chat, logs, or a public demo page. The script
refuses to overwrite an existing email or credentials file. Use the Admin
**Staff Accounts** workflow to create internal users.

For a controlled hackathon demonstration only, the synthetic role accounts
and business records can be seeded explicitly:

```sh
cd /app/backend
npm run seed
npm run db:seed
```

`npm run seed` creates the eight `@sunpower.demo` role accounts and writes
their shared randomly generated password to `/app/data/demo-credentials.txt`.
Retrieve and share that password only through a private channel; do not publish
it on a public website. Re-running this command resets those demo account
passwords to the saved generated value. `npm run db:seed` creates idempotent
synthetic workflow records without modifying users. Do not run either command
automatically on each deployment.

## Health checks and troubleshooting

Railway health-check path is `/api/health` (configured in `railway.toml`).
It checks database connectivity and migration readiness and returns only
non-sensitive status fields. A healthy response is HTTP 200 with
`{"status":"ok","database":"ok","readiness":"ready"}`.

- **Container exits at startup:** Check Railway logs for missing/weak
  `JWT_SECRET`, invalid production paths, or migration errors.
- **Database resets after redeploy:** Confirm the volume is mounted at
  `/app/data` and the three data-path variables match this guide.
- **Login cookie is not retained:** Use the Railway HTTPS domain and avoid
  pointing `FRONTEND_ORIGIN` at a different site.
- **Frontend routes return 404:** Confirm the service built from the root
  Dockerfile and that the client build completed.
- **API routes return HTML:** This should not occur; unknown `/api/*` routes
  return JSON 404 responses. Check the deployed image and Railway build logs.
- **Photos are missing after restore:** Restore the matching contents of
  `/app/data/uploads` as well as the database.

## Backup and restore

Use a protected backup destination and include both SQLite and the upload
directory. With the application environment available in a Railway shell,
create a consistent SQLite snapshot using the SQLite backup API:

```sh
cd /app/backend
node --input-type=module -e "import Database from 'better-sqlite3'; const db = new Database(process.env.DATABASE_PATH); await db.backup('/app/data/sunpower-backup.sqlite'); db.close()"
```

Copy the snapshot and `/app/data/uploads` to protected storage outside the
service volume; a file on the same volume is not an independent backup. To
restore, stop the service and restore the matching photo directory to
`/app/data/uploads`. For a SQLite snapshot already present on the volume, run:

```sh
cd /app/backend
node --input-type=module -e "import Database from 'better-sqlite3'; const snapshot = new Database('/app/data/sunpower-backup.sqlite', { readonly: true }); await snapshot.backup('/app/data/sunpower.sqlite'); snapshot.close()"
```

Then start the service; startup reapplies any pending migrations. Keep backup
access restricted because these files contain customer and operational records.
