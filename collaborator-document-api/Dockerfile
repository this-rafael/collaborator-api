FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile=false

COPY tsconfig.json tsconfig.build.json .swcrc ./
COPY src ./src

RUN pnpm build

FROM node:24.18.0-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile=false

COPY --from=build /app/dist ./dist

EXPOSE 3000

USER node

CMD ["node", "dist/index.js"]
