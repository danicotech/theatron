# theatron:活動前端(Next.js,pnpm workspace:web + packages/ui)。
#
# build 階段裝相依、跑 next build;runtime 直接沿用同一棵 node_modules 跑 next start。
# 沒有用 standalone 輸出:packages/ui 是以原始碼形式被 transpilePackages 吃進去的,
# standalone 的檔案追蹤對 workspace 套件不可靠,為了省幾百 MB 冒這個險不值得(本地部署)。
#
# NEXT_PUBLIC_* 是 build 時就寫死進 bundle 的,所以用 build arg 給。

ARG NODE_VERSION=22
ARG PNPM_VERSION=11.10.0

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
ARG NEXT_PUBLIC_TOURNAMENT_SLUG
ENV NEXT_PUBLIC_TOURNAMENT_SLUG=${NEXT_PUBLIC_TOURNAMENT_SLUG} \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
  && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY web/package.json ./web/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @theatron/web build

FROM node:${NODE_VERSION}-bookworm-slim
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
WORKDIR /app
COPY --from=build /app /app
USER node
EXPOSE 3000
CMD ["node", "web/node_modules/next/dist/bin/next", "start", "web", "--hostname", "0.0.0.0", "--port", "3000"]
