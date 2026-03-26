# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Ensure public directory exists
RUN mkdir -p /app/public

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Python and CV dependencies
RUN apk add --no-cache python3 py3-pip libglib libgomp libstdc++ libgcc libjpeg-turbo libpng
RUN pip install --no-cache websockets opencv-python-headless face_recognition ultralytics numpy

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.temp ./.temp
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/cv-websocket-client.py ./cv-websocket-client.py

# Create faces directory for face database
RUN mkdir -p /app/faces && chown -R nextjs:nodejs /app/faces

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose ports
EXPOSE 3000 3001

# Start both servers using the startup script
CMD ["node", "server/start.js"]
