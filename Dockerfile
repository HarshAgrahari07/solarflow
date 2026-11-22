FROM node:26-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix /app/backend

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix /app/frontend
COPY frontend ./frontend
RUN npm run build --prefix /app/frontend

COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts

FROM node:26-bookworm-slim AS production

RUN apt-get update \
  && apt-get install -y --no-install-recommends libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
  DATA_DIR=/app/data \
  DATABASE_PATH=/app/data/sunpower.sqlite \
  FILE_STORAGE_PATH=/app/data/uploads

COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/backend/scripts ./backend/scripts
COPY --from=build /app/frontend/dist ./frontend/dist

EXPOSE 4000
CMD ["npm", "--prefix", "backend", "start"]
