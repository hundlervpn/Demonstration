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
FROM node:20-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Python and CV dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-dev build-essential cmake \
    libglib2.0-0 libgomp1 libjpeg62-turbo libpng16-16 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir --break-system-packages --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --break-system-packages websockets opencv-python-headless face_recognition ultralytics numpy

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts

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
