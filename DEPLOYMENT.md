# Deployment guide

This guide takes the app from your laptop to a public website. Hosting providers change their screens and prices often, so this guide describes **what to set up** and gives exact commands for the app itself. For the exact buttons, follow your provider's documentation.

## 1. Pick a setup

| | A. One service (recommended) | B. Two services |
|---|---|---|
| What runs | The API also serves the website | Website on a static host, API on a server host |
| Settings | `SERVE_CLIENT=true` | `VITE_API_URL` for the website, `CLIENT_URL` for the API |
| Pros | One URL, no CORS, simplest | Static hosting can be cheaper and faster |
| Cons | Website is served by your API server | Two things to configure, CORS must match exactly |

You also need a **PostgreSQL database** (a managed one from your host is easiest) and, for AI insights, an **API key** from Google AI Studio or OpenAI.

## 2. Production settings

Set these as environment variables on your host (never in Git):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | The connection string from your database provider. Many require SSL: add `?sslmode=require` (check your provider's instructions) |
| `JWT_SECRET` | A fresh random value, 32+ characters (command below). Never reuse your local one |
| `CLIENT_URL` | The public address of the website, starting with `https://`, with no path |
| `SERVE_CLIENT` | `true` (setup A) |
| `TRUST_PROXY` | `1` on most hosting platforms (there is one proxy in front of your app) |
| `AI_PROVIDER`, `GEMINI_API_KEY` / `OPENAI_API_KEY`, model names | As in your local `.env` |
| `PORT` | Usually set by the platform. The app reads it automatically |

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

In production the server **refuses to start** if `JWT_SECRET` is short or looks like a placeholder, `CLIENT_URL` is not `https://`, or the database still uses the default `postgres:postgres` login. The message tells you which.

## 3. Try it with Docker on your own computer (optional but recommended)

This runs the same image you would deploy, plus a database, on your machine. It needs Docker Desktop.

Create a file named `.env.docker` next to `docker-compose.yml` (it is ignored by Git):

```env
DB_PASSWORD=choose-letters-and-numbers-only
JWT_SECRET=paste-a-long-random-string-here
AI_PROVIDER=gemini
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Then:

```bash
docker compose --env-file .env.docker up --build
```

Open <http://localhost:5000>. The first start builds the image and applies the database migrations. Stop with `Ctrl+C`, and remove everything (including the database) with `docker compose down -v`.

The compose file runs in `development` mode because it uses plain `http://localhost`. Real deployments use `production` behind `https`.

## 4. Setup A: one service

### With Docker (any host that runs containers)

The `Dockerfile` builds the website and the API into one image. On your host:

1. Create a **web service from your Git repository** (or from the Dockerfile) and a **PostgreSQL database**.
2. Add the environment variables from section 2.
3. Set the health check path to `/api/health`.
4. Deploy. On each start the container applies pending migrations (`prisma migrate deploy`) and then starts the server.

### Without Docker (hosts with a Node.js build step)

First add two helper scripts (once, from the project root):

```bash
npm pkg set "scripts.build=npm ci --include=dev --prefix server && npm run prisma:generate --prefix server && npm ci --prefix client && npm run build --prefix client"
npm pkg set "scripts.start=npm run migrate:deploy --prefix server && npm start --prefix server"
cd server
npm pkg set "scripts.prisma:generate=prisma generate"
npm pkg set "scripts.migrate:deploy=prisma migrate deploy"
```

Then on the host:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Start command | `npm start` |
| Node version | 22 |
| Health check path | `/api/health` |

## 5. Setup B: two services

1. **API:** deploy as above but leave `SERVE_CLIENT` unset. Set `CLIENT_URL` to the exact website address (for example `https://resumeiq.example.com`, no trailing slash needed).
2. **Website:** on a static host, set the root folder to `client`, build command `npm run build`, output folder `dist`, and the environment variable `VITE_API_URL=https://your-api-address/api`. Add a rule that sends every path to `index.html`, so addresses like `/history` work after a refresh.
3. If login fails in the browser with a CORS error, `CLIENT_URL` does not match the website address exactly (including `https` and any `www`).

## 6. The database

- **Apply migrations with `npx prisma migrate deploy`.** Never run `migrate dev` against a production database: it can offer to reset it.
- **Backups:** turn on automatic backups with your database provider, and test a restore once.
- **Deploying a schema change:** commit the new folder in `server/prisma/migrations`, push, and let the start command apply it.
- **Do not** run the integration tests against the production database (they refuse to run against a non-local database, on purpose).

## 7. After the first deploy: smoke test

1. Open `https://your-site/api/health`. You should see `"status":"ok","database":"connected"`.
2. Register a new account and log in.
3. Upload a sample resume, add a job description and run an analysis.
4. Refresh on the history page and a deep link (for example `/history`). Both should load.
5. In the browser developer tools, confirm there are no red CORS or 401 errors.

## 8. Running and updating

- **Logs:** use your host's log viewer. The server logs full error details there; users never see them.
- **Updating:** push to Git, let the host rebuild. Migrations apply automatically on start.
- **Rolling back:** redeploy the previous version. If a migration was applied, restoring from a backup may be needed, so make schema changes carefully.
- **Rotating secrets:** changing `JWT_SECRET` logs everyone out (that is fine). Changing an AI key only needs a restart.
- **AI spending:** set a monthly limit or budget alert in your AI provider's dashboard.
- **Dependencies:** run `npm audit` in `server` and `client` regularly.

## 9. Pre-launch checklist

**Secrets and repository**
- [ ] `server/.env` and `.env.docker` are **not** in Git (`git status`, and `git log --all --oneline -- server/.env` shows nothing)
- [ ] No real resume or personal data in the repository (`git log --all --name-only | findstr /i ".pdf .docx"` should list only the sample files in `server/tests/fixtures`)
- [ ] `JWT_SECRET` and API keys on the host are new, not the ones from your laptop
- [ ] You replaced `[Your Name]` in `LICENSE` and added your repository address to the README badge

**Configuration**
- [ ] `NODE_ENV=production`, `CLIENT_URL` is the real `https://` address, `TRUST_PROXY` matches your host
- [ ] The database has automatic backups
- [ ] An AI spending limit or alert is set

**Quality**
- [ ] `npm test` and `npm run test:integration` pass locally (`fail 0`)
- [ ] The GitHub Actions run is green
- [ ] You uploaded your own real resume (PDF) and it worked
- [ ] The smoke test in section 7 passes on the live site

**Presentation (for a portfolio project)**
- [ ] Screenshots added to the README
- [ ] Live link and a short demo video or GIF in the README
- [ ] A sample resume and job description someone can use to try the demo without their own data
