# ebus-service: liest das Rohprotokoll von ebusd mit, hält die Telegramme 7 Tage in SQLite und zeigt sie im Browser (README.md).
# Ohne npm-Pakete: Node 24 führt TypeScript direkt aus und bringt SQLite (node:sqlite) und den Testlauf (node --test) mit.
# Node auf einen Patch gepinnt, dazu der Digest vom 2026-11-19 (Index, gilt für amd64 und arm64).
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

# npm und corepack braucht der Container nicht; ohne sie fehlen auch ihre Schwachstellen
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
 && install -d -o node -g node -m 750 /data

WORKDIR /app
COPY package.json ./
COPY src/ src/
COPY public/ public/

ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
