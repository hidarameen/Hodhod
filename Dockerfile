# ==========================================
# Northflanks optimized Docker image
# Node.js + Python + Alpine
# ==========================================

# --------------------------
# Stage 1: Node.js dependencies (prod only)
# --------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --------------------------
# Stage 2: Node.js build (with devDependencies)
# --------------------------
FROM node:20-alpine AS builder
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

# Build dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    libffi-dev \
    openssl-dev

# Python requirements
COPY requirements-python.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements-python.txt

# --------------------------
# Stage 4: Production runtime
# --------------------------
FROM python:3.11-alpine AS production
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

# Copy Python packages and binaries
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy built Node.js app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy project files
COPY attached_assets ./attached_assets
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY migrations ./migrations
COPY telegram_bot ./telegram_bot
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY start.sh /app/start.sh

# Fix line endings & permissions
RUN dos2unix /app/docker-entrypoint.sh /app/start.sh 2>/dev/null || true && \
    chmod +x /app/docker-entrypoint.sh /app/start.sh

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /app/telegram_bot/temp /app/telegram_bot/logs && \
    chown -R appuser:appgroup /app

# Switch user
USER appuser

# ✅ FIX yt-dlp PATH WARNING
ENV PATH="/home/appuser/.local/bin:/usr/local/bin:${PATH}"

# Environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.cjs"]
