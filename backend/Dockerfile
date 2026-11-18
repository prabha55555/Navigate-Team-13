# Navigate API (Express + Mongoose).
#
# BUILD CONTEXT MUST BE THE REPOSITORY ROOT, because the backend also needs ../ai_services:
#   docker build -f backend/Dockerfile -t navigate-backend .
# (docker-compose.yml already does this.)

# ---- Stage 1: install production dependencies -------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Toolchain in case a native module (bcrypt) has no prebuilt binary for this CPU.
RUN apk add --no-cache python3 make g++

COPY backend/package.json backend/package-lock.json ./backend/
COPY ai_services/package.json ai_services/package-lock.json ./ai_services/

# The backend requires ../ai_services/*, which resolves its own node_modules.
RUN cd backend && npm ci --omit=dev \
 && cd ../ai_services && npm ci --omit=dev

# ---- Stage 2: runtime image -------------------------------------------------
FROM node:20-alpine
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/ai_services/node_modules ./ai_services/node_modules
COPY backend ./backend
COPY ai_services ./ai_services

# Uploaded syllabus files are written to backend/uploads; the AI cache to ai_services/cache.
RUN mkdir -p backend/uploads ai_services/cache \
 && chown -R node:node /app

USER node
WORKDIR /app/backend
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
