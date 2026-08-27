# Contributing to Aperiodos

Thanks for helping improve Aperiodos. Small, focused changes are easiest to review and maintain.

## Set up the project

Install the web dependencies:

```bash
make install
```

The generators require a current Rust toolchain, cargo-nextest, wasm-bindgen,
and the `wasm32-unknown-unknown` target. Install the pinned tools and build the
workspace with:

```bash
make install-tools
make build-generators
make build-wasm
```

## Develop and verify

Run the local web service with `make dev`, or use `make dev-sandbox` when testing donations against Stripe's sandbox environment.

Before opening a pull request, run:

```bash
make check
```

Do not commit `.env`, local generator settings, generated images, build output, or editor-specific project files. Never put live Stripe credentials or webhook secrets in an issue, commit, or pull request.

## Pull requests

- Keep each pull request focused on one concern.
- Explain user-visible behavior changes and any new environment variables.
- Update `README.md`, `.env.example`, and `AGENTS.md` when setup or deployment behavior changes.
- Include verification steps and screenshots for meaningful interface changes.
