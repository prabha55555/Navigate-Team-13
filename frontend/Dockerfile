# Navigate web app: build the React bundle, then serve it with nginx.
# Build context: ./frontend   (docker build -t navigate-frontend frontend)

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# CI=false so lint warnings do not fail the production build.
RUN CI=false npm run build

# ---- Stage 2: serve ---------------------------------------------------------
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
