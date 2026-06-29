# ============================================================
# LocalVoice2Action — production image for Cloud Run.
# Multi-stage: deps → builder (npm run build) → runner (standalone server).
# next.config.js sets output:"standalone", so the runner needs only the
# self-contained server + static assets — no node_modules, small image.
# ============================================================

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Maps key is NEXT_PUBLIC_ → inlined into the client bundle at BUILD time.
# It is a PUBLIC client key (ends up in browser JS regardless) and is protected
# by HTTP-referrer + API + quota restrictions in GCP Console, so baking it here
# is safe. The server-only GEMINI_API_KEY is deliberately NOT here — it is a
# real secret, injected at RUNTIME via Cloud Run --set-env-vars.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCHDhz4wf8_Rt6EEjEsPR8bhSofg56ZZnc
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run sends traffic to $PORT; default 3000 for local parity.
ENV PORT=3000
# Standalone server must bind to all interfaces or the platform can't reach it.
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy the standalone server, static chunks, and public assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# The standalone output entrypoint (NOT `next start`).
CMD ["node", "server.js"]
