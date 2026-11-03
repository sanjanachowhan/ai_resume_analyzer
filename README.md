# AI Resume Analyzer & Job Match Platform

A full-stack web application that compares a resume with a job description, calculates a transparent match score, finds the missing skills, and uses AI (OpenAI or Google Gemini) to explain the gaps and suggest honest, specific improvements.

<!-- After you push to GitHub, add a CI badge here (replace YOUR-USER and YOUR-REPO):
[![CI](https://github.com/YOUR-USER/YOUR-REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR-USER/YOUR-REPO/actions) -->

## Contents

[Problem statement](#problem-statement) · [Features](#features) · [Screenshots](#screenshots) · [Tech stack](#technology-stack) · [Architecture](#system-architecture) · [How the score works](#how-the-match-score-works) · [How the AI is used](#how-the-ai-is-used) · [Installation](#installation) · [Environment variables](#environment-variables) · [Database setup](#database-setup) · [Running](#running-the-application) · [Scripts](#scripts) · [API](#api-documentation) · [Testing](#testing) · [Security](#security) · [Deployment](#deployment) · [Structure](#project-structure) · [Future improvements](#future-improvements) · [Limitations](#known-limitations)

## Problem statement

Most job applications are screened by software before a person reads them. Candidates rarely know why a resume was rejected, which required skills it appears to lack, or how to improve it without guessing. Generic "AI resume checkers" often make things worse: they invent experience, inflate scores, and hide how the number was produced.

This project takes a different approach:

- The **score is calculated by a deterministic, explainable algorithm**, not by asking an AI for a number.
- The **AI explains and advises**, and is never trusted blindly. Its output is validated, checked against the resume, and any invented facts or numbers are discarded.
- If the AI is unavailable, the **score report still works**.

## Features

**Accounts and data**
- Registration and login with bcrypt password hashing and JWT sessions
- Every resume, job description and analysis belongs to one user and is never visible to others

**Resumes**
- Drag-and-drop upload of PDF and DOCX files, with type and size validation and upload/extraction progress
- Text extraction and cleaning, and detection of name, email, and sections (skills, experience, education, projects, certifications)
- Skills, education level and years of experience detected from the text (never guessed: unknown stays "not detected")
- Only extracted text is stored; the uploaded file is never written to disk. Duplicate uploads are detected

**Job descriptions**
- Paste text, or upload a PDF/DOCX and review the extracted text before saving
- Requirements split into required vs preferred skills, soft skills, years of experience, education, certifications and responsibilities

**Matching and analysis**
- Weighted match score (skills, keywords, experience, education, responsibilities, soft skills) with configurable weights
- Skills grouped as matched, partial (a related skill is present), missing and additional
- AI gap analysis: strengths, missing skills with priority and advice, weakly evidenced skills, other gaps, project ideas, and an overall summary
- Suggested resume rewrites that never add facts or invent metrics
- Results are saved; the same resume and job are never sent to the AI twice unless you ask

**Dashboard and history**
- Circular score, bar chart of the score breakdown, donut chart of skill coverage
- Home dashboard with totals, average score, best match, score trend and recent analyses
- History with search, sorting, pagination and deleting

**Engineering**
- Provider-agnostic AI layer (switch OpenAI/Gemini with one setting)
- Security hardening, rate limiting, safe error handling, zip-bomb protection
- 100+ unit tests, integration tests against a real database, CI workflow, Docker support

## Screenshots

<!-- Take screenshots of the running app and save them in docs/screenshots/, then uncomment:

| Landing page | Analysis dashboard |
|---|---|
| ![Landing page](docs/screenshots/landing.png) | ![Analysis dashboard](docs/screenshots/dashboard.png) |

| Missing skills and advice | History |
|---|---|
| ![Missing skills](docs/screenshots/missing-skills.png) | ![History](docs/screenshots/history.png) |
-->

_Add screenshots here (see the comment in the README source)._ Use a sample resume without personal details.

## Technology stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | **React** + **Vite** | Fast development, component-based UI |
| Styling | **Tailwind CSS** | Consistent, responsive design without custom CSS files |
| Routing / HTTP | **React Router**, **Axios** | Client-side pages; one place for auth headers and error messages |
| Charts | **Recharts** | Bar, donut and line charts |
| Backend | **Node.js** + **Express** | Simple REST API |
| Database | **PostgreSQL** | Relational data with foreign keys, JSON columns for analysis results |
| ORM | **Prisma** | Typed, parameterized queries (no SQL injection) and migrations |
| Validation | **Zod** | One source of truth for request and AI-response shapes |
| Auth | **bcryptjs**, **jsonwebtoken** | Password hashing, signed sessions |
| Uploads | **multer** (memory), **pdfjs-dist** (PDF.js), **mammoth** | In-memory handling; PDF and DOCX text extraction |
| AI | **OpenAI** API, **Google Gemini** API | Interchangeable providers behind one interface |
| Security | **helmet**, **cors**, **express-rate-limit** | Headers, origin control, abuse limits |
| Tests | Node's built-in test runner | No extra test packages |

## System architecture

```text
   React website (Vite, Tailwind, Recharts)
        |
        |  HTTPS   /api/*   Authorization: Bearer <JWT>
        v
   Node.js + Express
   routes -> controllers -> services
        |
   +----+-------------------------------+
   |                                    |
   v                                    v
 PostgreSQL (Prisma)               AI layer
 users, resumes,                        |
 job descriptions,               +------+------+
 analyses                        v             v
                              OpenAI        Gemini
```

**What happens when you click "Analyze resume":**

```text
resume text + job text (already extracted and stored)
        |
        v
 1. Skill and requirement extraction (dictionary-based, deterministic)
 2. Matching: matched / partial / missing / additional skills, keyword and duty coverage
 3. Weighted score  ---------------------------------------------- saved even if the AI fails
        |
        v
 4. AI gap analysis + resume rewrites (in parallel), then a final summary
 5. Validation (Zod schema, retry once) and grounding checks (invented facts removed)
        |
        v
 6. Saved to PostgreSQL, shown on the dashboard
```

**Data model:** `User` has many `Resume`, `JobDescription` and `Analysis`. An `Analysis` points to one resume and one job description, and stores the scores, matched and missing skills, the AI output and its metadata as JSON. Deleting a user, resume or job deletes everything that depends on it.

## How the match score works

```text
Overall score = 40% skills + 20% keywords + 15% experience + 10% education + 10% responsibilities + 5% soft skills
```

| Part | How it is calculated |
|---|---|
| Skills | Required skills count fully, preferred skills half. A matched skill earns full credit, a related one (for example Azure for AWS) earns half, a missing one earns none. Some skills imply others (PostgreSQL implies SQL) |
| Keywords | Share of the job's keywords that appear on the resume (with light word stemming) |
| Experience | Years on the resume (stated or calculated from dates) divided by the years required, capped at 100% |
| Education | Meets the required degree level = 100, one level below = 50, further below = 0 |
| Responsibilities | How much of the wording of each listed duty appears in the resume's experience and projects |
| Soft skills | Share of the job's soft skills found on the resume |

**Fairness rules:** if a job does not ask for something (for example it states no years of experience), that part is left out and its weight is shared by the others. If the job asks but the resume does not let the app tell (for example no dates), that part is also left out and shown as "could not detect". Missing information never silently raises or lowers the score.

Weights can be changed in `server/src/config/matching.js` or with the `MATCH_WEIGHTS` environment variable.

## How the AI is used

The AI explains the result and gives advice. It does not decide the score. Protections in the code:

- **Grounded prompts:** the AI is told to use only the provided resume and job, never to invent experience, skills or metrics, and to separate "missing" from "not explicitly mentioned".
- **Prompt-injection protection:** resume and job text is wrapped as data, the wrapper tags are stripped from user text, and the prompt says to ignore instructions inside it.
- **Structured output:** responses must be valid JSON matching a Zod schema. Messy JSON is recovered, invalid JSON triggers one retry that explains the problem, and persistent failure becomes a controlled error.
- **Facts come from code, not the AI:** the list of missing skills comes from the matcher; the AI only adds reasons and advice. A rewrite is discarded if its "before" line is not on the resume or its "after" line contains a number that appears nowhere on the resume.
- **Cost control:** inputs are size-limited, results are cached, concurrent duplicate requests share one run, and AI endpoints have their own rate limit.

## Installation

### Prerequisites

- **Node.js 20.19 or newer** (22 or 24 recommended): <https://nodejs.org>
- **PostgreSQL 14 or newer** (installed locally, or run in Docker)
- **Git**
- An API key for **Google Gemini** (free tier available in Google AI Studio) or **OpenAI** (paid). The app works without one: you get the score and skill report, but no AI explanations

### Steps

```bash
git clone https://github.com/YOUR-USER/YOUR-REPO.git
cd YOUR-REPO

# install everything (root helper, server, client)
npm install
npm install --prefix server
npm install --prefix client
```

Create the settings file for the server:

```bash
# macOS / Linux
cp .env.example server/.env
# Windows PowerShell
Copy-Item .env.example server/.env
```

Then edit `server/.env` (see the next section). Generate a random `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Environment variables

Set these in `server/.env`. **Never commit this file** (it is in `.gitignore`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | none | PostgreSQL connection string, for example `postgresql://postgres:YOUR_PASSWORD@localhost:5432/resume_analyzer?schema=public` |
| `JWT_SECRET` | yes | none | Long random string used to sign sessions (at least 32 characters in production) |
| `JWT_EXPIRES_IN` | no | `7d` | How long a login lasts |
| `AI_PROVIDER` | no | `openai` | `openai` or `gemini` |
| `OPENAI_API_KEY` | if using OpenAI | none | OpenAI API key (server only) |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | OpenAI model name |
| `GEMINI_API_KEY` | if using Gemini | none | Google AI Studio API key (server only) |
| `GEMINI_MODEL` | no | `gemini-3.1-flash-lite` | Gemini model name. Model names change often: run `npm run ai:models` to list the ones your key can use |
| `NODE_ENV` | no | `development` | `development`, `test` or `production`. Production adds safety checks at start-up |
| `PORT` | no | `5000` | Port the API listens on |
| `CLIENT_URL` | no | `http://localhost:5173` | Address of the website. Used for CORS and must be `https://` in production |
| `MAX_FILE_SIZE_MB` | no | `5` | Upload size limit |
| `TRUST_PROXY` | no | `0` | Number of reverse proxies in front of the API (usually `1` on a hosting platform) |
| `SERVE_CLIENT` | no | `false` | `true` makes the API also serve the built website |
| `MATCH_WEIGHTS` | no | built-in weights | JSON to change score weights, for example `{"skills":0.5,"keywords":0.1}` |
| `TEST_DATABASE_URL` | no | none | Separate local database for the integration tests |

Website setting (`client/.env`, rarely needed): `VITE_API_URL`, only when the website and API are on different addresses.

## Database setup

Create an empty database, then apply the migrations:

```bash
# create the database (psql, or pgAdmin)
createdb resume_analyzer

cd server
npx prisma migrate dev      # development: applies migrations and generates the client
npx prisma migrate deploy   # production: applies migrations only, never creates new ones
npx prisma studio           # optional: browse the data in your browser
```

## Running the application

```bash
npm run dev
```

This starts the API on <http://localhost:5000> and the website on <http://localhost:5173> (open this one). Check the API with <http://localhost:5000/api/health>.

To check your AI setup: `cd server && npm run ai:test`.

## Scripts

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | API and website together |
| root | `npm run dev:server` / `dev:client` | One at a time |
| root | `npm run build` | Install and build for deployment |
| root | `npm start` | Apply migrations and start the production server |
| server | `npm test` | Unit tests (fast, no database) |
| server | `npm run test:integration` | Integration tests against a real database |
| server | `npm run test:all` | Both |
| server | `npm run ai:test` | Check the AI connection |
| server | `npm run ai:models` | List usable Gemini models |
| server | `npm run parse:resume -- file.pdf` | Try the resume parser on a file |
| server | `npm run backfill` | Add skill extraction to older saved records |
| client | `npm run build` | Production build of the website |

## API documentation

Base path: `/api`. Requests and responses are JSON, except file uploads (`multipart/form-data`). Protected routes need the header `Authorization: Bearer <token>`.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | no | API and database status |
| POST | `/auth/register` | no | Create an account, returns a token |
| POST | `/auth/login` | no | Log in, returns a token |
| GET | `/auth/me` | yes | The logged-in user |
| POST | `/resumes/upload` | yes | Upload a PDF/DOCX (field `resume`), extract and parse it |
| GET | `/resumes` | yes | List your resumes |
| GET | `/resumes/:id` | yes | One resume, including the extracted text |
| DELETE | `/resumes/:id` | yes | Delete a resume and its analyses |
| POST | `/jobs/extract` | yes | Upload a PDF/DOCX (field `file`) and get its text back; nothing is saved |
| POST | `/jobs` | yes | Save a job description |
| GET | `/jobs` | yes | List your job descriptions (with a preview) |
| GET | `/jobs/:id` | yes | One job description with its parsed requirements |
| DELETE | `/jobs/:id` | yes | Delete a job description and its analyses |
| POST | `/analysis/preview` | yes | Instant deterministic score, no AI, nothing saved |
| POST | `/analysis` | yes | Full analysis (score + AI), saved. Also available as `POST /ai/analyze` |
| GET | `/analysis` | yes | History. Query: `page`, `pageSize` (max 50), `sort` (`date` or `score`), `q` (search) |
| GET | `/analysis/stats` | yes | Totals, average, best match, recent analyses, score trend |
| GET | `/analysis/:id` | yes | One saved analysis |
| DELETE | `/analysis/:id` | yes | Delete an analysis |
| GET | `/ai/status` | yes | Which AI provider and model are set up (never the key) |
| POST | `/ai/test` | yes | Send a tiny prompt to check the AI connection |

### Examples

**Register**

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"Passw0rd123"}'
```

```json
{
  "success": true,
  "user": { "id": "…", "name": "Jane Doe", "email": "jane@example.com", "createdAt": "…" },
  "token": "eyJhbGciOi…"
}
```

Passwords need 8 to 72 characters, with at least one letter and one number.

**Upload a resume**

```bash
curl -X POST http://localhost:5000/api/resumes/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "resume=@jane-doe-resume.pdf"
```

Returns `201` with `{ "success": true, "duplicate": false, "resume": { "id", "fileName", "rawText", "parsedData" … } }`. Uploading the same text again returns `200` with `"duplicate": true` and the saved resume.

**Save a job description**

```bash
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Backend Developer","company":"Acme","description":"…at least 50 characters…"}'
```

**Run an analysis**

```bash
curl -X POST http://localhost:5000/api/analysis \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"resumeId":"…","jobId":"…"}'
```

Add `"force": true` to run the AI again even if a saved result exists. Response (shortened):

```json
{
  "success": true,
  "cached": false,
  "analysis": {
    "id": "…",
    "scores": { "overall": 78, "skills": 82, "keywords": 75, "experience": 80,
                "education": 100, "responsibilities": 70, "softSkills": 65 },
    "components": { "skills": { "status": "scored", "score": 82, "weight": 0.4, "effectiveWeight": 0.45 } },
    "skills": {
      "matched": [{ "skill": "React", "importance": "required" }],
      "partial": [{ "skill": "AWS", "importance": "preferred", "relatedTo": "Azure" }],
      "missing": [{ "skill": "Docker", "importance": "High", "reason": "…", "recommendation": "…" }],
      "additional": ["Python"],
      "weak": [{ "skill": "Git", "reason": "…" }]
    },
    "ai": {
      "gap": { "summary": "…", "strengths": ["…"], "suggestions": ["…"] },
      "improvements": { "rewrites": [{ "section": "Experience", "current": "…", "suggested": "…" }] },
      "summary": { "headline": "…", "summary": "…", "topPriorities": ["…", "…", "…"] }
    },
    "aiAvailable": true,
    "suggestions": ["…"],
    "aiMeta": { "provider": "gemini", "model": "…", "durationMs": 9000, "warnings": [] }
  }
}
```

If the AI is unavailable, the analysis is still saved: `aiAvailable` is `false`, `ai` is `null`, and `aiMeta.error` says why.

### Errors

Every error has the same shape, and never contains stack traces or internal details:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid request data.",
  "details": [{ "field": "password", "message": "Password must be at least 8 characters" }] } }
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_FILE_TYPE`, `NO_FILE` |
| 401 | `UNAUTHORIZED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` |
| 404 | `NOT_FOUND` (also returned for other users' data) |
| 409 | `EMAIL_TAKEN` |
| 413 | `PAYLOAD_TOO_LARGE`, `FILE_TOO_LARGE` |
| 422 | `UNREADABLE_FILE`, `EMPTY_RESUME`, `EMPTY_DOCUMENT`, `UNSAFE_FILE`, `INSUFFICIENT_REQUIREMENTS` |
| 429 | `RATE_LIMITED` (with a `Retry-After` header) |
| 5xx | `INTERNAL_ERROR`, `DATABASE_UNAVAILABLE`, and `AI_*` codes such as `AI_NOT_CONFIGURED`, `AI_RATE_LIMITED`, `AI_TIMEOUT` |

## Testing

```bash
cd server
npm test                  # unit tests: fast, no database, no network
npm run test:integration  # real parsers + the whole API against a real database
```

The integration tests use a local database, create only users whose email starts with `apitest-` (deleted afterwards), and switch the AI off so nothing is spent. See [TESTING.md](TESTING.md) for what each file covers. A GitHub Actions workflow (`.github/workflows/ci.yml`) runs everything and builds the website on each push.

## Security

Passwords are hashed with bcrypt, sessions are pinned-algorithm JWTs, every query is scoped to the logged-in user, every request body is validated, uploads are checked by content and protected against zip bombs, and the API has security headers, strict CORS, rate limits and safe error responses. See [SECURITY.md](SECURITY.md) for the full list and the known limitations.

## Deployment

The app can be deployed as **one service**: the API also serves the built website (`SERVE_CLIENT=true`). A `Dockerfile` and `docker-compose.yml` are included. See [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions, production settings and a pre-launch checklist.

## Project structure

```text
.
├── client/                  React website
│   └── src/
│       ├── components/      reusable UI (analysis charts, upload, layout…)
│       ├── pages/           landing, login, dashboard, resumes, jobs, analysis, history
│       ├── layouts/         public and signed-in layouts
│       ├── context/         authentication state
│       ├── services/        API calls (axios)
│       └── utils/
├── server/
│   ├── prisma/              schema and migrations
│   ├── scripts/             helper commands (AI test, parser test, backfill…)
│   ├── tests/               unit tests, integration tests, sample files
│   └── src/
│       ├── ai/              provider-agnostic AI layer, prompts, schemas, guardrails
│       ├── config/          environment, matching weights, Prisma client
│       ├── controllers/     HTTP layer
│       ├── data/            skills dictionary, skill relations
│       ├── middleware/      auth, uploads, rate limits, errors
│       ├── parsers/         PDF, DOCX and resume-section parsing
│       ├── routes/
│       ├── services/        business logic (matching, scoring, analysis pipeline…)
│       ├── utils/ validators/
│       ├── app.js           Express app
│       └── server.js        start-up and shutdown
├── Dockerfile  docker-compose.yml
├── .github/workflows/ci.yml
├── README.md  SECURITY.md  TESTING.md  DEPLOYMENT.md  LICENSE
```

## Future improvements

- **Profile and settings page:** change password, delete account and data
- **Email verification and password reset**
- **ATS score** and formatting checks (tables, columns, fonts that parsers struggle with)
- **Resume rewriting** into a full tailored version (with the same no-invented-facts rules)
- **Cover letter generation** from a resume and job description
- **LinkedIn profile analysis**
- **Job recommendation engine** based on the skills in a resume
- **Multiple resume versions** and comparison between them
- **Interview question generation** based on the gaps found
- **Skill-learning roadmap** for each missing skill
- **OCR** for scanned PDFs
- **Streaming progress** from the server during analysis (instead of steps completed before the request)
- **Shared rate-limit store (Redis)** for multi-server deployments
- **httpOnly cookie sessions** instead of `localStorage` tokens
- **Larger skills dictionary**, or AI-assisted skill extraction as a second opinion

## Known limitations

- Skill detection uses a fixed dictionary (about 170 skills). Skills outside it are not scored, though keyword matching still sees their words.
- Scanned (image-only) PDFs cannot be read; the app asks for a text-based version.
- Free-tier AI providers may use submitted text to improve their products. Use a resume without personal contact details while testing.
- No email verification or password reset yet.
- More in [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE). Replace `[Your Name]` in the license file with your name.
