# Build stage
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

# Verify build output (debug)
RUN ls -la dist/

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
# Ensure proper ownership for the non-root user
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
