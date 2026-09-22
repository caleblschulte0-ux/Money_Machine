# Barkly proxy. Zero dependencies, so there is no install step: the image is
# Node plus this directory. Configure it entirely by environment (see
# README.md, "Every environment variable"); in production it refuses to boot
# without ANTHROPIC_API_KEY, BARKLY_APP_TOKEN and BARKLY_ALLOWED_ORIGINS.
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production BARKLY_ENV=production PORT=8787
EXPOSE 8787
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "index.mjs"]
