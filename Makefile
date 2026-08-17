.PHONY: install install-python dev dev-sandbox build build-generators check deploy

PYTHON ?= python3

dev:
	cd web && npm run dev

dev-sandbox:
	@set -eu; \
	webhook_secret_file="$$(mktemp)"; \
	listener_pid=""; \
	cleanup() { \
		if [ -n "$$listener_pid" ]; then kill "$$listener_pid" 2>/dev/null || true; fi; \
		rm -f "$$webhook_secret_file"; \
	}; \
	trap cleanup EXIT INT TERM; \
	chmod 600 "$$webhook_secret_file"; \
	stripe listen --print-secret > "$$webhook_secret_file"; \
	stripe listen \
		--events checkout.session.completed,checkout.session.async_payment_succeeded \
		--forward-to http://127.0.0.1:3000/api/stripe/webhook \
		>/dev/null 2>&1 & \
	listener_pid="$$!"; \
	cd web && \
		STRIPE_SANDBOX_WEBHOOK_SECRET_FILE="$$webhook_secret_file" \
		npm run dev -- --sandbox

build:
	cd web && npm run build

build-generators:
	cargo build --release --manifest-path src/generators/spectre/Cargo.toml
	cargo build --release --manifest-path src/generators/penrose/Cargo.toml

check:
	$(PYTHON) -m compileall -q src/generators/einstein
	cargo test --manifest-path src/generators/spectre/Cargo.toml
	cargo test --manifest-path src/generators/penrose/Cargo.toml
	cd web && npm test
	cd web && npm run build

deploy:
	./deploy.sh

install:
	cd web && npm ci

install-python:
	$(PYTHON) -m pip install -r requirements.txt
