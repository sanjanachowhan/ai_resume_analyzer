# Testing

The project has two kinds of automated tests. Both live in `server/tests/` and use Node's built-in test runner (no extra packages).

## Unit tests: fast, no database, no network

```bash
cd server
npm test
```

| File | What it checks |
|---|---|
| `extraction.test.js` | Skill dictionary matching, job description analysis, resume profile, experience dates |
| `matching.test.js` | Skill matching, keyword and soft-skill matching, weights, the weighted score, edge cases |
| `ai.test.js` | JSON recovery, schema validation, retry logic, prompts, prompt-injection protection |
| `gemini.test.js` | Gemini request building, response reading, error mapping, retries, timeouts |
| `analysis.test.js` | AI guardrails, the analysis pipeline, caching, AI-failure fallback |
| `analysis-read.test.js`, `analysis-history.test.js` | Saved analyses, history list, search, sorting, pagination, stats, deleting |
| `auth.test.js` | Registration, login, duplicate emails, no hash leaks, timing parity, route protection |
| `validators.test.js` | Registration, login, job and analysis input rules and the validation middleware |
| `text-utils.test.js` | Text cleaning, real file-type detection, resume section parsing |

External services (database, AI, hashing, tokens) are replaced by small fakes, so these tests are fast and free.

## Integration tests: real parsers, real API, real database

```bash
cd server
npm run test:integration
```

| File | What it checks |
|---|---|
| `integration/parsers.integration.js` | The real PDF and DOCX parsers on sample files in `tests/fixtures/`, and corrupted-file handling |
| `integration/api.integration.js` | The whole REST API: auth, uploads, jobs, analysis, history, deleting, and isolation between users |

- The app is started inside the test on a random port. You do not need `npm run dev`.
- It uses the database from `server/.env` (or `TEST_DATABASE_URL`). It refuses to run against a non-local database.
- It only creates users whose email starts with `apitest-`, and deletes them (and all their data) afterwards.
- The AI is switched off for these tests, so nothing is sent to OpenAI or Gemini and nothing is spent.

## Everything

```bash
npm run test:all
```

## Adding a test

Create `server/tests/<name>.test.js` for a unit test (it is picked up automatically), or `server/tests/integration/<name>.integration.js` for an integration test.
