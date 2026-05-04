# Build stage
# Cache buster: 2026-05-04T01:43:00
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

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage using absolute paths
COPY --from=builder /app/dist /app/dist

# Create non-root user and fix permissions
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

# Final image structure check (debug)
RUN ls -R /app/dist | head -n 20

USER nestjs

# Expose port (Render defaults to 10000 or uses $PORT)
EXPOSE 3000

# Start the application using absolute path
CMD ["node", "/app/dist/main.js"]
