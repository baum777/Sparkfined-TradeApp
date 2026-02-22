# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy source code
COPY backend ./backend
COPY api ./api
COPY apps ./apps

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build Backend
WORKDIR /app/backend
RUN pnpm run build

# Stage 2: Production Run
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.jsons for dependency resolution
COPY backend/package.json ./backend/
COPY api/package.json ./api/
COPY apps/backend-alerts/package.json ./apps/backend-alerts/

# Install production dependencies only for the backend
RUN pnpm install --frozen-lockfile --prod --filter tradeapp-backend...

# Copy built artifacts from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/migrations ./backend/migrations

# Create directory for SQLite data
RUN mkdir -p /app/backend/.data && chown -R node:node /app/backend/.data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=sqlite:./.data/tradeapp.sqlite

# Expose port
EXPOSE 3000

# Volume for persistence
VOLUME ["/app/backend/.data"]

# Switch to non-root user
USER node

# Start server
WORKDIR /app/backend
CMD ["node", "dist/server.js"]
