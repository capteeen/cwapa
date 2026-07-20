FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# yt-dlp + ffmpeg are required at runtime for audio extraction. Install the
# Python distribution with curl-cffi: the Unix zip binary excludes browser TLS
# impersonation, which TikTok now uses for its challenge-protected webpages.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates python3 python3-venv fontconfig \
    fonts-inter fonts-roboto fonts-open-sans fonts-lato fonts-comic-neue \
    fonts-liberation fonts-urw-base35 \
  && python3 -m venv /opt/yt-dlp \
  && /opt/yt-dlp/bin/pip install --no-cache-dir --pre "yt-dlp[default,curl-cffi]" \
  && /opt/yt-dlp/bin/python -c "import curl_cffi, yt_dlp" \
  && ln -s /opt/yt-dlp/bin/yt-dlp /usr/local/bin/yt-dlp \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
