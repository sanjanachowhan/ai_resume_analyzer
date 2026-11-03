import 'dotenv/config';
import { z } from 'zod';
import { productionProblems } from './envChecks.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  AI_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.1-flash-lite'), // model names change often; list yours with: npm run ai:models

  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),

  // How many reverse proxies sit in front of the API (0 locally, usually 1 on a hosting platform).
  // Needed so rate limits see each visitor's real IP address.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // Let this server also serve the built website (client/dist). One service, one URL, no CORS needed.
  SERVE_CLIENT: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  CLIENT_DIST_DIR: z.string().optional(), // only needed if the built website is somewhere unusual (tests use it)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const problems = productionProblems(parsed.data);
if (problems.length) {
  console.error('Unsafe production configuration:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

export const env = parsed.data;
