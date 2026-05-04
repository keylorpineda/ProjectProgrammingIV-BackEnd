# Build stage
# Cache buster: 2026-05-04T05:00:00
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify build output in builder stage
RUN ls -la dist/

# Production stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Install only production dependencies
COPY --chown=nestjs:nodejs package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Run as non-root user
USER nestjs

# Final image structure check (debug)
RUN ls -R dist | head -n 20

# Expose port (Render defaults to 10000 or uses $PORT)
EXPOSE 3000

# Start the application using relative path
CMD ["node", "dist/main.js"]
