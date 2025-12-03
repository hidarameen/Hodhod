# Stage 1: Node.js dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Builder (Node.js app)
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .
RUN npm run build

# Stage 3: Python dependencies
FROM python:3.11-alpine AS python-deps
WORKDIR /app
RUN apk add --no-cache gcc g++ musl-dev libffi-dev openssl-dev
COPY requirements-python.txt ./
RUN pip install --no-cache-dir -r requirements-python.txt

# Stage 4: Production
FROM python:3.11-alpine AS production
WORKDIR /app
RUN apk add --no-cache nodejs npm ffmpeg postgresql-client dumb-init bash curl dos2unix libffi openssl

# Copy Python packages
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy built Node.js app and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copy **all other project folders** from builder stage
COPY --from=builder /app/attached_assets ./attached_assets
COPY --from=builder /app/client ./client
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/script ./script
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/telegram_bot ./telegram_bot
COPY --from=builder /app/docker-entrypoint.sh /app/docker-entrypoint.sh
COPY --from=builder /app/start.sh /app/start.sh

# Fix permissions
RUN dos2unix /app/docker-entrypoint.sh /app/start.sh 2>/dev/null || true && \
    chmod +x /app/docker-entrypoint.sh /app/start.sh

# Non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /app/telegram_bot/temp /app/telegram_bot/logs && \
    chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.cjs"]
