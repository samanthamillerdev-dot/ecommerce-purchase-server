FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/package.json
COPY packages/mock-external-api/package.json packages/mock-external-api/package.json
COPY packages/admin-ui/package.json packages/admin-ui/package.json
RUN npm ci
COPY packages/admin-ui packages/admin-ui

ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace packages/admin-ui

FROM nginx:1.27-alpine
COPY --from=build /repo/packages/admin-ui/dist /usr/share/nginx/html
EXPOSE 80
