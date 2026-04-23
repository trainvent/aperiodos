Start the Python API
```
. .venv/bin/activate
set -a
source .env
set +a
python3 -m src.entry.web
```
In another terminal, start the frontend dev server
```
cd web
npm run dev
```
do
for refreshing rust backend:
```
cargo build --release --manifest-path src/spectre_rs/Cargo.toml
```
