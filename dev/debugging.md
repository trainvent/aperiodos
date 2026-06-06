Start the Next.js web/API server:

```bash
cd web
npm run dev
```

Load local environment variables first when testing Stripe or Firestore:

```bash
set -a
source .env
set +a
cd web
npm run dev
```

Rebuild Rust generators when API routes should use fresh release binaries:

```bash
cargo build --release --manifest-path src/generators/spectre_rs/Cargo.toml
cargo build --release --manifest-path src/generators/penrose/Cargo.toml
```
