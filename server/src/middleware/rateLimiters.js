import rateLimit from 'express-rate-limit';

const limiter = ({ windowMs, limit, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMITED', message } },
  });

const HOUR = 60 * 60 * 1000;

// Login and register: slows down password guessing. Successful requests are not counted.
export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

// Account creation: every attempt counts, which discourages mass sign-ups.
export const registerLimiter = limiter({
  windowMs: HOUR,
  limit: 10,
  message: 'Too many accounts were created from this network. Please try again later.',
});

// Reading PDF/DOCX files uses CPU, so uploads get their own limit.
export const uploadLimiter = limiter({
  windowMs: HOUR,
  limit: 40,
  message: 'Too many uploads. Please try again later.',
});

// AI calls cost money, so they get a tighter limit.
export const aiLimiter = limiter({
  windowMs: HOUR,
  limit: 30,
  message: 'Too many AI requests. Please try again later.',
});
