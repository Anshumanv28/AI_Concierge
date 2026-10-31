# --- Build stage ---
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# CRA bakes REACT_APP_* vars into the bundle at build time, so they must be
# supplied as build args (see docker-compose.yml).
ARG REACT_APP_LIVEKIT_URL
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_LIVEKIT_URL=$REACT_APP_LIVEKIT_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

RUN npm run build

# --- Serve stage ---
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80 >/dev/null || exit 1
