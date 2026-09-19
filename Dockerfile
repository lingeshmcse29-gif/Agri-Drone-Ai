# ==============================================================================
# Stage 1: Build Frontend SPA
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Backend Runtime
# ==============================================================================
FROM node:20-bullseye-slim AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5001

# Install runtime dependencies for sharp (libvips)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --omit=dev

WORKDIR /app
# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend dist from Stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure upload directory directories exist
RUN mkdir -p /app/backend/uploads/drone \
    /app/backend/uploads/hotspots \
    /app/backend/uploads/processed

EXPOSE 5001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5001/api/health || exit 1

WORKDIR /app/backend
CMD ["node", "server.js"]
