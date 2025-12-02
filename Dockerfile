# ==============================================
# OPTIMIZED DOCKERFILE FOR LAYER CACHING
# ==============================================

# Stage 1: Install Node.js dependencies (cached if package.json unchanged)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy all project files (except ignored by .dockerignore)
COPY . .

# Build the Node.js application
RUN npm run build

# Stage 3: Python dependencies (cached separately)
FROM python:3.11-alpine AS python-deps
WORKDIR /app

# Install build dependencies for Python packages
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

# Stage 4: Production runtime
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

# Copy the rest of project files (all folders, scripts, migrations, shared, telegram_bot)
COPY . .

# Fix permissions for entrypoint scripts
RUN dos2unix /docker-entrypoint.sh /app/start.sh 2>/dev/null || true && \
    chmod +x /docker-entrypoint.sh /app/start.sh

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Create necessary directories and set ownership
RUN mkdir -p /app/telegram_bot/temp /app/telegram_bot/logs && \
    chown -R appuser:appgroup /app

# Switch to non-root user
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

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--", "/docker-entrypoint.sh"]

# Start the application
CMD ["node", "dist/index.cjs"]
