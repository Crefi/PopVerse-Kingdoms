FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 popverse

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

USER popverse

EXPOSE 3000

CMD ["node", "dist/index.js"]
