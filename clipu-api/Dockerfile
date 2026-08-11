FROM node:22-slim

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 \
	&& rm -rf /var/lib/apt/lists/* \
	&& curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
	&& chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=10000
EXPOSE 10000
CMD ["node", "server.js"]
