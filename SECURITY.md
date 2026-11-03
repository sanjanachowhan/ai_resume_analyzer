# Security

How the application protects its users and its data, and what it deliberately does not do yet.

## What is protected, and where

| Area | Protection | Where |
|---|---|---|
| Passwords | Hashed with bcrypt (12 rounds), never stored or returned in plain text. The 72-byte limit is enforced in bytes, not characters | `authCore.service.js`, `auth.validators.js` |
| Login | Same error for "wrong password" and "unknown email", and a dummy hash check so response time does not reveal which emails exist | `authCore.service.js` |
| Sessions | JWT signed with HS256 (algorithm pinned, so `alg: none` and similar forgeries fail), 7-day expiry, checked against the database on every request | `auth.service.js`, `authCore.js` |
| Data isolation | Every query for resumes, jobs and analyses filters by the logged-in user's id. Other users' items answer 404 | all `*.service.js` files |
| Input validation | Zod schemas on every request body, with length limits. Unknown fields are dropped (no mass assignment) | `validators/` |
| SQL injection | Prisma uses parameterized queries. No raw SQL with user input | `prisma` everywhere |
| Rate limiting | Global (300 per 15 min), login/register failures (20 per 15 min), account creation (10 per hour), uploads (40 per hour), AI calls (30 per hour) | `rateLimiters.js`, `app.js` |
| File uploads | 5 MB limit, extension check, real file-content check (magic bytes), kept in memory only (never written to disk), zip-bomb check for DOCX, 30-page limit for PDFs | `upload.js`, `fileValidation.js`, `zipInspector.js`, `pdfParser.js` |
| HTTP headers | Helmet (nosniff, HSTS, frame protection, and more), `X-Powered-By` removed, `Cache-Control: no-store` on all API responses | `app.js` |
| CORS | Only the configured website origin, only needed methods and headers, no cookies | `app.js` |
| Secrets | API keys, `DATABASE_URL` and `JWT_SECRET` live in `server/.env`, which Git ignores. The browser can only learn whether an AI key is set, never the key. In production the server refuses to start with a weak or placeholder secret, a non-https `CLIENT_URL`, or the default database password | `env.js`, `envChecks.js`, `.gitignore` |
| Error handling | Users only see friendly messages. Stack traces, SQL and file paths stay in the server log. Database outages become a polite 503 | `errorResponse.js`, `errorHandler.js` |
| AI safety | Resume and job text are treated as untrusted data (prompt-injection protection), output is validated and grounded against the resume, and invented numbers in rewrites are discarded | `promptTemplates.js`, `guardrails.js` |
| Crashes | The React app shows a message instead of a blank page. The server logs and restarts cleanly on a crash it cannot recover from | `ErrorBoundary.jsx`, `server.js` |

## Known limitations (honest list)

- **Token storage:** the JWT is kept in the browser's `localStorage`. This is simple, but any cross-site-scripting bug could steal it. React escapes content by default and the app never inserts raw HTML, but an `httpOnly` cookie would be stronger.
- **No email verification or password reset yet.** Anyone can register with any email address.
- **Registering reveals whether an email exists** (the "email already registered" message). That is a common usability tradeoff.
- **Rate limits are per server process.** They reset when the server restarts and are not shared between several servers. A shared store such as Redis would fix this.
- **No account lockout.** Login is rate limited per IP, not per account.
- **Zip-bomb check uses sizes the archive declares.** A forged archive could lie, so it is one layer next to the upload size limit.
- **Free-tier AI providers may use submitted text to improve their products.** Use a resume without personal contact details while testing, or a paid plan for real use.
- **Dependencies** should be kept up to date: run `npm audit` regularly.

## Reporting a problem

Please open an issue and avoid including real personal data or secrets.
