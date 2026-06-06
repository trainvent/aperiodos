FROM node:24-slim AS frontend-build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web ./
RUN npm run build

FROM rust:1.93-slim AS spectre-build

WORKDIR /app/src/generators/spectre_rs

COPY src/generators/spectre_rs/Cargo.toml src/generators/spectre_rs/Cargo.lock ./
COPY src/generators/spectre_rs/src ./src
RUN cargo build --release

FROM rust:1.93-slim AS penrose-build

WORKDIR /app/src/generators/penrose

COPY src/generators/penrose/Cargo.toml src/generators/penrose/Cargo.lock ./
COPY src/generators/penrose/src ./src
RUN cargo build --release

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080
ENV PYTHONPATH=/app/src
ENV SPECTRE_BIN=/usr/local/bin/spectre_rs
ENV PENROSE_BIN=/usr/local/bin/penrose_rs

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY --from=frontend-build /app/web/dist ./web/dist
COPY --from=spectre-build /app/src/generators/spectre_rs/target/release/spectre_rs /usr/local/bin/spectre_rs
COPY --from=penrose-build /app/src/generators/penrose/target/release/penrose_rs /usr/local/bin/penrose_rs

EXPOSE 8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "entry.web:app"]
