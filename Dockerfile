# Builds the website and the API into ONE image. The API serves the website, so you deploy a single service.
#   docker build -t resumeiq .

# ---- 1. build the website ----
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. the API + the built website ----
FROM node:22-alpine
RUN apk add --no-cache openssl

WORKDIR /app/server
COPY server/package*.json ./
# --include=dev: the Prisma command-line tool is needed at start-up to apply database migrations
RUN npm ci --include=dev
COPY server/ ./
RUN npx prisma generate

COPY --from=client-build /app/client/dist /app/client/dist

ENV NODE_ENV=production \
    PORT=5000 \
    SERVE_CLIENT=true

RUN chown -R node:node /app
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

# Apply pending database migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
