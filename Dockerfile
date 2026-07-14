FROM mcr.microsoft.com/playwright:v1.61.1-noble

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/farmacompare.db \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev && mkdir -p /app/data

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
