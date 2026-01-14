FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pkgconfig

COPY package*.json ./
ENV HUSKY=0
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    giflib \
    pixman

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 popverse

COPY package*.json ./
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev pixman-dev pkgconfig && \
    npm ci --omit=dev --ignore-scripts && \
    npm rebuild canvas && \
    apk del python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev pixman-dev pkgconfig

COPY knexfile.js ./
COPY --from=builder /app/dist ./dist

RUN mkdir -p logs && chown -R popverse:nodejs logs

USER popverse

EXPOSE 3000

CMD ["node", "dist/index.js"]
