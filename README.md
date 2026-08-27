# Aperiodos

Aperiodos is a free web tool for creating aperiodic tiling images.

Use it to explore Einstein, Spectre, and Penrose patterns, adjust the look, and export images for personal projects, study, design experiments, or simple curiosity.

Try it here:

https://www.aperiodos.com/

## What You Can Do

- Generate aperiodic patterns directly in the browser.
- Export images as SVG, PNG, or JPG.
- Adjust colors, size, scale, and pattern settings.
- Create repeat visits to new pattern variations without installing anything.
- Support the project through optional donations.

The tool is free to use. Donations help keep it online and support further development.

To keep the free service sustainable, generation endpoints share a small daily
allowance enforced server-side. The service stores only a keyed hash of the
requesting IP address, not the address itself. A separate service-wide daily
ceiling prevents distributed traffic from causing unbounded rendering costs.

## Offline Use

The Einstein generator can also run locally:

```bash
./aperiodic-generator
```

This writes a generated SVG to `output/einstein.svg`.

## For Developers

Development, setup, API, donation, and deployment notes live in [AGENTS.md](AGENTS.md).

The repository is organized by runtime responsibility:

```text
.
├── web/                         Next.js UI and API routes
│   ├── pages/                   Page and API route entry points
│   ├── public/                  Static browser assets
│   └── src/
│       ├── components/          Shared React controls
│       ├── features/            UI grouped by product feature
│       ├── lib/                 Shared browser-side utilities
│       ├── locales/             Translation resources
│       └── server/              Server-side services
├── src/generators/
│   ├── common/                  Shared Rust rendering primitives
│   ├── einstein/                Rust Einstein generator
│   ├── spectre/                 Rust Spectre generator
│   ├── penrose/                 Rust Penrose generator
│   ├── renderer/                Unified native renderer and JSON recipe API
│   └── wasm/                    Browser preview WebAssembly bindings
├── Dockerfile                   Production multi-stage image
└── Makefile                     Common development commands
```

Common commands:

```bash
make install
make install-tools
make dev
make dev-sandbox
make build
make build-generators
make build-wasm
make check
make deploy
```

All SVG exports embed a versioned `aperiodos.render` JSON recipe in their
metadata. The same recipe can be rendered through the unified binary:

```bash
cargo run --release -p aperiodos-render -- penrose \
  --config '{"width":800,"height":800,"iterations":4,"tile_mode":"rhombs"}' \
  --output output/penrose.svg
```

Generator pages use the same Rust code compiled to WebAssembly for debounced,
quota-free previews. Full-resolution SVG, PNG, and JPEG exports still go through
the server renderer.

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## Credits And References

Aperiodos builds on public mathematical work and open references around aperiodic monotiles, Spectre tilings, Penrose tilings, and related coloring techniques.

Useful starting points:

- Hat monotile reference page: https://cs.uwaterloo.ca/~csk/hat/h7h8.html
- Spectre reference implementation: https://github.com/necocen/spectre
- Simon Tatham on aperiodic Spectre: https://www.chiark.greenend.org.uk/%7Esgtatham/quasiblog/aperiodic-spectre/
- Penrose slides: https://www.math.utah.edu/~treiberg/PenroseSlides.pdf
