# Build and run the shots app. Build from the REPOSITORY ROOT:
#   docker build -f apps/shots/Dockerfile -t shots .
#   docker run -p 3001:3001 --env-file .env shots
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @holdco/database exec prisma generate
RUN pnpm --filter @holdco/shots-app build

FROM node:22-slim
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["pnpm", "--filter", "@holdco/shots-app", "start"]
