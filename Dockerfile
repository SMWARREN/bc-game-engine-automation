FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN apk add --no-cache su-exec \
  && npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY README.md ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R node:node /app /data

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
