# Aperiodic Monotiles Generator

Generate images based on aperiodic monotiles. The web application is Next.js; Python and Rust live only behind it as generator engines.

## What It Does

- Serves the Aperiodos web UI and API from Next.js.
- Renders Einstein tile patterns through the Python generator.
- Includes a seed-based Einstein export mode for generating a unique cropped section of the pattern.
- Includes Rust Spectre and Penrose renderers that write SVG snapshots.

## Project Structure

```text
.
├── aperiodic-generator      # Executable launcher for the Einstein Python generator
├── web/                     # Next.js web app, API routes, donations, and frontend UI
├── src/
│   ├── generators/          # Generator implementations only
│   │   ├── einstein_backend/ # Einstein backend implementation in Python
│   │   ├── penrose/         # Rust Penrose renderer crate
│   │   └── spectre_rs/      # Rust Spectre renderer crate
├── output/                  # Generated images are written here by default
└── README.md
```

## Usage
### Web
https://www.aperiodos.com/

### Offline
Generate the default full pattern:

```bash
./aperiodic-generator
```

This writes an image to `output/einstein_pattern.jpg`.

Pass normal CLI options to the same launcher:

```bash
./aperiodic-generator \
  --iterations 6 \
  --width 7000 \
  --height 7000 \
  --scalar 24 \
  --colors black seagreen white sandybrown gold \
  --output output/custom-pattern.jpg
```

Generate a seed-based crop:

```bash
./aperiodic-generator --seed 6 --output output/seed-6.png
```

Developer setup, API service usage, and deployment notes live in [dev/INSTRUCTIONS.md](dev/INSTRUCTIONS.md).

### Spectre (Rust)

Generate a Spectre SVG snapshot:

```bash
cargo run --manifest-path src/generators/spectre_rs/Cargo.toml -- \
  --output output/spectre.svg \
  --width 1600 \
  --height 1600 \
  --scale 40 \
  --level 5 \
  --palette '#17313b,#1f6a5d,#b4552d,#d8b24c,#f6f1e8'
```

Useful Spectre flags:

- `--center-x` and `--center-y` move the viewport in world coordinates.
- `--background`, `--outline`, and `--stroke-width` control the SVG styling.
- `--shape straight|curved` chooses straight polygon edges or a curved matching-rule variant.
- `--palette` accepts a comma-separated list of CSS-style colors.

## CLI Options

```text
--iterations    Number of subdivision rounds to render
--scalar        Pixel scale for each tile coordinate
--width         Output image width
--height        Output image height
--output        Output file path
--colors        Five colors for H1, H, T, P, and F tiles
--no-outline    Render filled tiles without black borders
--seed          Generate a seed-based crop instead of the default full render
--show-window   Display a Tk window while rendering
```

## Notes

- Very high iteration counts can become slow and memory-heavy.
- More than 8 iterations can be very heavy to load and render, especially at large output sizes.
- The web surface belongs to `web/`; Python and Rust code should stay in `src/generators/`.
- Generated files and Python cache files are intentionally ignored by git.

## References

- David Smith: https://en.wikipedia.org/wiki/David_Smith_(amateur_mathematician)
- Hat monotile reference page: https://cs.uwaterloo.ca/~csk/hat/h7h8.html
- inspiration repository for Einstein: https://github.com/asmoly/Einstein_Tile_Generator
- spectre reference implementation: https://github.com/necocen/spectre
- OpenAIs models where used for most of the technical work: https://openai.com/
- https://mathoverflow.net/questions/443377/how-can-one-construct-a-four-coloring-of-a-tiling-of-the-plane-with-smith-myers
- https://www.chiark.greenend.org.uk/%7Esgtatham/quasiblog/aperiodic-spectre/
- https://www.math.utah.edu/~treiberg/PenroseSlides.pdf
