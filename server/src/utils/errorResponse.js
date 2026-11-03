import { ZodError } from 'zod';
import { AppError } from './AppError.js';

const DB_UNAVAILABLE_CODES = ['P1001', 'P1002', 'P1008', 'P1017', 'P2024']; // can't reach / timed out / pool exhausted

const isDatabaseUnavailable = (err) =>
  err?.name === 'PrismaClientInitializationError' || DB_UNAVAILABLE_CODES.includes(err?.code);

const reply = (status, code, message, extra = {}) => ({ status, body: { success: false, error: { code, message, ...extra } } });

// Turns ANY error into a safe JSON response. Users only ever see friendly messages:
// no stack traces, SQL, file paths or library messages. `log` says whether the server should log the full error.
export function buildErrorResponse(err, { debug = false } = {}) {
  if (err instanceof ZodError) {
    return {
      ...reply(400, 'VALIDATION_ERROR', 'Invalid request data.', {
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      }),
      log: false,
    };
  }

  if (err instanceof AppError) {
    return { ...reply(err.statusCode, err.code, err.message), log: err.statusCode >= 500 };
  }

  // Errors from the body parser (bad JSON, body too large, ...)
  if (err?.type === 'entity.parse.failed') {
    return { ...reply(400, 'INVALID_JSON', 'The request body is not valid JSON.'), log: false };
  }
  if (err?.type === 'entity.too.large') {
    return { ...reply(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.'), log: false };
  }
  if (typeof err?.type === 'string' && err.status >= 400 && err.status < 500) {
    return { ...reply(err.status, 'BAD_REQUEST', 'The request could not be processed.'), log: false };
  }

  // Database trouble
  if (isDatabaseUnavailable(err)) {
    return { ...reply(503, 'DATABASE_UNAVAILABLE', 'The database is temporarily unavailable. Please try again in a moment.'), log: true };
  }
  if (err?.code === 'P2025') {
    return { ...reply(404, 'NOT_FOUND', 'The requested item was not found.'), log: false };
  }

  // Anything else is a bug: log it, show nothing technical.
  return {
    ...reply(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.', debug && err?.message ? { debug: err.message } : {}),
    log: true,
  };
}
