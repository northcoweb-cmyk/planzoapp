# Real-browser iPhone simulator, hostable on Render / Railway / Fly.io (not Vercel).
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npx playwright-core install --with-deps chromium && rm -rf /var/lib/apt/lists/*
COPY local-server.js ./
COPY lib ./lib
COPY public ./public
ENV HOST=0.0.0.0 PROFILE_DIR=/data/profile
EXPOSE 4321
CMD ["node", "local-server.js"]
