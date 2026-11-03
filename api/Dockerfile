FROM node:22-alpine

WORKDIR /app

# Installera beroenden (ändras sällan – maximerar Docker-cache)
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
RUN npm ci --workspace=api --omit=dev

# Kopiera källkod (ändras ofta – läggs sist)
COPY shared/ shared/
COPY api/ api/

WORKDIR /app/api
EXPOSE 4000

# M6: commiten imagen byggdes från. Pipelinen skickar in den (build-args), lokalt blir det "dev".
# Syns i /api/health som `sha` – så vet deploysteget att molnet kör rätt version.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

# boot.js: väntar på databasen och seedar om SEED_ON_START=1 (staging i molnet), startar sedan index.js.
CMD ["node", "src/boot.js"]
