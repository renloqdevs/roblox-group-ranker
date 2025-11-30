# Roblox Group Ranking Bot - Docker Image
# Multi-stage build for smaller final image

# ============================================
# Stage 1: Build dependencies
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev for build if needed)
RUN npm ci --only=production

# ============================================
# Stage 2: Production image
# ============================================
FROM node:18-alpine

# Add labels for container metadata
LABEL org.opencontainers.image.title="Roblox Group Ranking Bot"
LABEL org.opencontainers.image.description="Self-hosted API for Roblox group ranking operations"
LABEL org.opencontainers.image.version="1.1.1"

# Create non-root user for security
RUN addgroup -g 1001 -S rankbot && \
    adduser -S rankbot -u 1001 -G rankbot

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY package*.json ./
COPY src ./src

# Set ownership to non-root user
RUN chown -R rankbot:rankbot /app

# Switch to non-root user
USER rankbot

# Environment variables with sensible defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info
ENV LOG_TIMESTAMPS=true

# Expose the API port
EXPOSE 3000

# Health check using the /live endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/live || exit 1

# Start the API server
CMD ["node", "src/index.js"]
