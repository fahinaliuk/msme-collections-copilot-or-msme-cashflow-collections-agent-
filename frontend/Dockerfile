# Multi-stage build for Next.js client
FROM node:22-alpine AS builder

WORKDIR /app

# Next.js bakes rewrites at build time — set internal API URL for Docker network
ARG API_URL=http://backend:8000
ENV API_URL=${API_URL}
# When NEXT_PUBLIC_API_URL is set, axios uses it directly (Vercel/Render mode)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY . .
RUN npm run build

# Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start"]