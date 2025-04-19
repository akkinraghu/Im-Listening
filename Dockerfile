# 1. Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# 2. Production stage
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app .
RUN npm ci --omit=dev --legacy-peer-deps
EXPOSE 3000
CMD ["npm", "start"]
