import { AppError } from '../utils/AppError.js';
import { buildErrorResponse } from '../utils/errorResponse.js';
import { env } from '../config/env.js';

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const { status, body, log } = buildErrorResponse(err, { debug: env.NODE_ENV === 'development' });
  if (log) console.error(`${req.method} ${req.originalUrl} failed:`, err); // full details stay in the server log
  res.status(status).json(body);
}
