FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY package.json .
COPY src ./src
COPY constants.js .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chown -R node:node /app && chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 8180
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
