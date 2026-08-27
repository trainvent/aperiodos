FROM rust:1.93-slim AS generators-build

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
COPY src/generators ./src/generators
RUN rustup target add wasm32-unknown-unknown \
    && cargo install wasm-bindgen-cli --locked --version 0.2.127 \
    && cargo build --release --workspace \
    && cargo build --release -p aperiodos-render-wasm --target wasm32-unknown-unknown \
    && mkdir -p /app/wasm \
    && wasm-bindgen --target web --out-dir /app/wasm --out-name aperiodos_render /app/target/wasm32-unknown-unknown/release/aperiodos_render_wasm.wasm

FROM node:24-slim AS web-build

WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web ./
COPY --from=generators-build /app/wasm ./public/wasm
RUN npm run build

FROM node:24-slim

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV EINSTEIN_BIN=/usr/local/bin/einstein
ENV SPECTRE_BIN=/usr/local/bin/spectre
ENV PENROSE_BIN=/usr/local/bin/penrose

WORKDIR /app

COPY --from=web-build /app/web/.next/standalone ./
COPY --from=web-build /app/web/.next/static ./.next/static
COPY --from=web-build /app/web/public ./public
COPY --from=generators-build /app/target/release/aperiodos-render /usr/local/bin/aperiodos-render
COPY --from=generators-build /app/target/release/einstein /usr/local/bin/einstein
COPY --from=generators-build /app/target/release/spectre /usr/local/bin/spectre
COPY --from=generators-build /app/target/release/penrose /usr/local/bin/penrose

WORKDIR /app

EXPOSE 8080

CMD ["node", "server.js"]
