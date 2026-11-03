import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', env.TRUST_PROXY); // so rate limits use the visitor's IP, not the proxy's
app.disable('x-powered-by');
app.disable('etag'); // responses contain personal data: never answer with "304 not modified"

app.use(helmet()); // security headers (nosniff, HSTS, frame protection, ...)

// Only the website itself may call the API from a browser. Tokens travel in the Authorization header, not cookies.
app.use(
  cors({
    origin: new URL(env.CLIENT_URL).origin,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

// Never let browsers or proxies keep copies of API responses.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '200kb' }));
if (env.NODE_ENV === 'development') app.use(morgan('dev'));

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    },
  })
);

app.use('/api', routes);

// Optional: serve the built website from this same server (see DEPLOYMENT.md).
if (env.SERVE_CLIENT) {
  const dist = env.CLIENT_DIST_DIR
    ? path.resolve(env.CLIENT_DIST_DIR)
    : fileURLToPath(new URL('../../client/dist', import.meta.url));
  const indexFile = path.join(dist, 'index.html');

  if (!fs.existsSync(indexFile)) {
    console.error(`SERVE_CLIENT is on, but ${indexFile} does not exist. Build the website first: npm run build --prefix client`);
    process.exit(1);
  }

  // Built files have a hash in their name, so browsers can keep them for a year.
  app.use('/assets', express.static(path.join(dist, 'assets'), { maxAge: '1y', immutable: true, index: false }));
  app.use('/assets', (req, res) => res.status(404).end()); // a missing asset is a 404, never the home page
  app.use(express.static(dist, { index: false }));

  // Any other page address belongs to the React router, so send the app shell and let it decide.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-cache'); // always fetch the newest index.html after a deployment
    res.sendFile(indexFile);
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
