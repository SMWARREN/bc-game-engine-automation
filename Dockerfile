FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV npm_config_update_notifier=false

COPY package.json package-lock.json ./
RUN apk add --no-cache su-exec \
  && npm install -g npm@11.13.0 \
  && npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY README.md ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data \
  && sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R node:node /app /data

ENTRYPOINT ["/bin/sh", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
