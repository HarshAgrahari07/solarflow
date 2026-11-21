FROM node:26-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix /app/server

COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix /app/client
COPY client ./client
RUN npm run build --prefix /app/client

COPY server/src ./server/src
COPY server/scripts ./server/scripts

FROM node:26-bookworm-slim AS production

RUN apt-get update \
  && apt-get install -y --no-install-recommends libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
  DATA_DIR=/app/data \
  DATABASE_PATH=/app/data/sunpower.sqlite \
  FILE_STORAGE_PATH=/app/data/uploads

COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/server/scripts ./server/scripts
COPY --from=build /app/client/dist ./client/dist

EXPOSE 4000
CMD ["npm", "--prefix", "server", "start"]
