Start the Next.js web/API server:

```bash
cd web
npm run dev
```

Run the web/API server against Stripe test-mode credentials:

```bash
cd web
npm run dev --sandbox
```

The sandbox runner loads `.env` from the repo root, sets `STRIPE_MODE=sandbox`,
uses `STRIPE_SANDBOX_SECRET_KEY`, and stores local sponsor entries in
`.sandbox/sponsors.json` instead of Firestore. Set `SANDBOX_PUBLIC_APP_URL` when
you need a tunnel URL for Stripe redirects; otherwise it uses `http://localhost:3000`.

Required sandbox variables:

```bash
STRIPE_SANDBOX_SECRET_KEY=sk_test_...
STRIPE_SANDBOX_WEBHOOK_SECRET=whsec_...
```

Rebuild Rust generators when API routes should use fresh release binaries:

```bash
cargo build --release --manifest-path src/generators/spectre_rs/Cargo.toml
cargo build --release --manifest-path src/generators/penrose/Cargo.toml
```
