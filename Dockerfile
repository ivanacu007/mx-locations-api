FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Download and ingest SEPOMEX data at build time
RUN apt-get update && apt-get install -y curl && \
    curl -sL --max-time 300 -o data/cpdescarga.txt \
    "https://raw.githubusercontent.com/d3249/mexico_zipcodes/master/CPdescarga.txt" && \
    node scripts/ingest.js && \
    rm -f data/cpdescarga.txt && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD ["node", "src/index.js"]
