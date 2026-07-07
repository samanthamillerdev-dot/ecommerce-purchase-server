FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/mock-external-api/package.json packages/mock-external-api/package.json
COPY packages/admin-ui/package.json packages/admin-ui/package.json
RUN npm ci
COPY packages/mock-external-api packages/mock-external-api
RUN npm run build --workspace packages/mock-external-api

FROM node:22-bookworm-slim
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/mock-external-api/package.json packages/mock-external-api/package.json
COPY --from=build /repo/packages/mock-external-api/dist packages/mock-external-api/dist
WORKDIR /repo/packages/mock-external-api

EXPOSE 4001
CMD ["node", "dist/index.js"]
