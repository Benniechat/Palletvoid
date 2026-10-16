FROM node:20-slim

# Install system dependencies for native builds if needed
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first for efficient layer caching
COPY package*.json ./

RUN npm install

# Copy application source code
COPY . .

# Run initial seed to prepare tables and verified catalog
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
