# ==============================================
# OPTIMIZED DOCKERFILE FOR LAYER CACHING
# ==============================================

# Stage 1: Node.js dependencies for production
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Node.js dependencies for build (including devDependencies)
FROM node:20-alpine AS builder-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 3: Build the Node.js application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from builder-deps
COPY --from=builder-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy all project files needed for build
COPY . .

# Build the Node.js applicationapplication
RUN npm run build

# Stage 4: Python dependencies
FROM python:3.11-alpine AS python-deps
WORKDIR /app

# Install build dependencies for Python
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    libffi-dev \
    openssl-dev

# Copy Python requirements
COPY requirements-python.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-python.txt

# Stage 5: Production runtime
FROM python:3.11-alpine AS production
WORKDIR /app

# Install runtime system dependencies
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

# Copy Python packages from python-deps stage
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# Copy built Node.js app and package.json
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy production node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy important project folders/files
COPY migrations ./migrations
COPY shared ./shared
COPY telegram_bot ./telegram_bot
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY start.sh /app/start.sh

# Fix permissions for scripts
RUN dos2unix /app/docker-entrypoint.sh /app/start.sh 2>/dev/null || true && \
    chmod +x /app/docker-entrypoint.sh /app/start.sh

# Create non-root user and directories
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup && \
    mkdir -p /app/telegram_bot/temp /app/telegram_bot/logs && \
    chown -R appuser:appgroup /app

USER appuser

# Environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Entry point
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]

# Start command
CMD ["node", "dist/index.cjs"]
