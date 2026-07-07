FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/mock-external-api/package.json packages/mock-external-api/package.json
COPY packages/admin-ui/package.json packages/admin-ui/package.json
RUN npm ci
COPY packages/server packages/server
RUN npm run build --workspace packages/server

FROM node:22-bookworm-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/server/package.json packages/server/package.json
COPY --from=build /repo/packages/server/dist packages/server/dist
WORKDIR /repo/packages/server

EXPOSE 3000
CMD ["node", "--experimental-sqlite", "dist/index.js"]
