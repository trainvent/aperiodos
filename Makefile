.PHONY: install install-python dev dev-sandbox build build-generators check deploy

PYTHON ?= python3

dev:
	cd web && npm run dev

dev-sandbox:
	cd web && npm run dev -- --sandbox

build:
	cd web && npm run build

build-generators:
	cargo build --release --manifest-path src/generators/spectre/Cargo.toml
	cargo build --release --manifest-path src/generators/penrose/Cargo.toml

check:
	$(PYTHON) -m compileall -q src/generators/einstein
	cargo test --manifest-path src/generators/spectre/Cargo.toml
	cargo test --manifest-path src/generators/penrose/Cargo.toml
	cd web && npm run build

deploy:
	./deploy.sh

install:
	cd web && npm ci

install-python:
	$(PYTHON) -m pip install -r requirements.txt
