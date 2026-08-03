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

## Offline Use

The original Einstein generator can also run locally:

```bash
./aperiodic-generator
```

This writes a generated image to `output/einstein_pattern.jpg`.

## For Developers

Development, setup, API, donation, and deployment notes live in [AGENTS.md](AGENTS.md).

The repository is organized by runtime responsibility:

```text
.
├── web/                         Next.js UI and API routes
│   ├── pages/                   Page and API route entry points
│   ├── public/                  Static browser assets
│   └── src/                     React UI and server-side services
├── src/generators/
│   ├── einstein/                Python Einstein generator
│   ├── spectre/                 Rust Spectre generator
│   └── penrose/                 Rust Penrose generator
├── Dockerfile                   Production multi-stage image
└── Makefile                     Common development commands
```

Common commands:

```bash
make install
make dev
make dev-sandbox
make build
make build-generators
make check
make deploy
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## Credits And References

Aperiodos builds on public mathematical work and open references around aperiodic monotiles, Spectre tilings, Penrose tilings, and related coloring techniques.

Useful starting points:

- Hat monotile reference page: https://cs.uwaterloo.ca/~csk/hat/h7h8.html
- Spectre reference implementation: https://github.com/necocen/spectre
- Simon Tatham on aperiodic Spectre: https://www.chiark.greenend.org.uk/%7Esgtatham/quasiblog/aperiodic-spectre/
- Penrose slides: https://www.math.utah.edu/~treiberg/PenroseSlides.pdf
