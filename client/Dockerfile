# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL=https://api.codecollabproj.com/api
ENV VITE_API_URL=$VITE_API_URL
ENV GENERATE_SOURCEMAP=false

RUN npm run build

# Stage 2: Production (no devDependencies, minimal attack surface)
FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve@14.2.4

# Run as non-root user
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001
COPY --from=builder --chown=appuser:appuser /app/build ./build
USER appuser

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
