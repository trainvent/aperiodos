# Contributing to Aperiodos

Thanks for helping improve Aperiodos. Small, focused changes are easiest to review and maintain.

## Set up the project

Install the web dependencies:

```bash
make install
```

For work on the Python Einstein generator, create a virtual environment and install its dependencies:

```bash
python3 -m venv .venv
. .venv/bin/activate
make install-python
```

The Rust generators require a current Rust toolchain. Build them with:

```bash
make build-generators
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
