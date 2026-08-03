FROM node:24-slim AS web-build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web ./
RUN npm run build

FROM rust:1.93-slim AS spectre-build

WORKDIR /app/src/generators/spectre

COPY src/generators/spectre/Cargo.toml src/generators/spectre/Cargo.lock ./
COPY src/generators/spectre/src ./src
RUN cargo build --release

FROM rust:1.93-slim AS penrose-build

WORKDIR /app/src/generators/penrose

COPY src/generators/penrose/Cargo.toml src/generators/penrose/Cargo.lock ./
COPY src/generators/penrose/src ./src
RUN cargo build --release

FROM node:24-slim

ENV NODE_ENV=production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV PYTHONPATH=/app/src
ENV SPECTRE_BIN=/usr/local/bin/spectre
ENV PENROSE_BIN=/usr/local/bin/penrose
ENV PATH=/opt/venv/bin:$PATH

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY --from=web-build /app/web/.next/standalone ./
COPY --from=web-build /app/web/.next/static ./.next/static
COPY --from=web-build /app/web/public ./public
COPY --from=spectre-build /app/src/generators/spectre/target/release/spectre /usr/local/bin/spectre
COPY --from=penrose-build /app/src/generators/penrose/target/release/penrose /usr/local/bin/penrose

WORKDIR /app

EXPOSE 8080

CMD ["node", "server.js"]
