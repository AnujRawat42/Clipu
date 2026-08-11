FROM node:22-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg python3 python3-pip \
	&& rm -rf /var/lib/apt/lists/* \
	&& pip install --break-system-packages --no-cache-dir -U yt-dlp bgutil-ytdlp-pot-provider

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
