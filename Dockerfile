FROM node:22-slim

RUN apt-get update && apt-get install -y chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY tsconfig.json ./

CMD ["npm", "start"]
