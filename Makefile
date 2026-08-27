.PHONY: install install-tools dev dev-sandbox build build-generators build-wasm check check-rust deploy

dev:
	cd web && npm run dev

dev-sandbox:
	@./scripts/dev-sandbox.sh

build: build-wasm
	cd web && npm run build

build-generators:
	cargo build --release --workspace

build-wasm:
	cargo build --release -p aperiodos-render-wasm --target wasm32-unknown-unknown
	mkdir -p web/public/wasm
	wasm-bindgen --target web --out-dir web/public/wasm --out-name aperiodos_render target/wasm32-unknown-unknown/release/aperiodos_render_wasm.wasm

check: check-rust build-wasm
	cd web && npm test
	cd web && npm run build

check-rust:
	cargo nextest run --workspace
	cargo test --workspace --doc

deploy:
	./deploy.sh

install:
	cd web && npm ci

install-tools:
	cargo install cargo-nextest --locked --version 0.9.143
	cargo install wasm-bindgen-cli --locked --version 0.2.127
	rustup target add wasm32-unknown-unknown
