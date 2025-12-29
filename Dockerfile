# ==========================================
# Production Dockerfile
# Node.js + Python 3.11 + Alpine
# ==========================================

# --------------------------
# Stage 1: Node.js dependencies (production)
# --------------------------
FROM node:20-alpine AS node-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --------------------------
# Stage 2: Node.js build
# --------------------------
FROM node:20-alpine AS node-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --------------------------
# Stage 3: Python dependencies
# --------------------------
FROM python:3.11-alpine AS python-deps
WORKDIR /app

RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    libffi-dev \
    openssl-dev

COPY requirements-python.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-python.txt && \
    pip install --no-cache-dir yt-dlp

# --------------------------
# Stage 4: Production runtime
# --------------------------
FROM python:3.11-alpine
WORKDIR /app

# Runtime tools
RUN apk add --no-cache \
    nodejs \
    npm \
    ffmpeg \
    postgresql-client \
    dumb-init \
    bash \
    curl \
    dos2unix \
    libffi \
    openssl

# Copy Python packages & binaries (includes yt-dlp)
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy Node.js build
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/package.json ./

# Copy production node_modules
COPY --from=node-deps /app/node_modules ./node_modules

# Copy project files
COPY attached_assets ./attached_assets
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY migrations ./migrations
COPY telegram_bot ./telegram_bot
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY start.sh /app/start.sh

# Fix permissions
RUN dos2unix /app/docker-entrypoint.sh /app/start.sh 2>/dev/null || true && \
    chmod +x /app/docker-entrypoint.sh /app/start.sh

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /app/telegram_bot/temp /app/telegram_bot/logs && \
    chown -R appuser:appgroup /app

USER appuser

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV PATH="/usr/local/bin:${PATH}"

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.cjs"]
