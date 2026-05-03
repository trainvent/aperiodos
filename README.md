# Aperiodic Monotiles Generator

Generate images based on aperiodic monotiles, with a Python Einstein backend and a Rust Spectre renderer.

The project currently focuses on offline image generation. The longer-term goal is to use this generator as the backend for a website where people can tweak colors, size, image dimensions, tile variants, and download finished artwork.

## What It Does

- Renders Einstein tile patterns from Python.
- Includes a seed-based Einstein export mode for generating a unique cropped section of the pattern.
- Includes a new Rust Spectre renderer that writes SVG snapshots.

## Project Structure

```text
.
├── aperiodic-generator      # Executable launcher for the Einstein Python generator
├── src/
│   ├── entry/               # Thin launcher scripts for CLI, GUI, and HTTP entrypoints
│   ├── einstein_backend/    # Einstein backend implementation in Python
│   └── spectre_rs/          # Rust Spectre renderer crate
├── output/                  # Generated images are written here by default
└── README.md
```

## Usage
### Web
https://www.aperiodos.com/

### Offline
Generate the default full pattern:

```bash
python3 src/entry/main.py
```

This writes an image to `output/einstein_pattern.jpg`.

Open a small Tk form to choose values visually and run the generator:

```bash
python3 src/entry/main_visual.py
```

The visual launcher remembers your last-used settings and includes one default preset plus three saveable preset slots.

Or launch it like a little desktop-style tool from the project root:

```bash
./aperiodic-generator
```

Pass normal CLI options to the same launcher and it renders directly without opening the GUI:

```bash
./aperiodic-generator \
  --iterations 6 \
  --width 7000 \
  --height 7000 \
  --scalar 24 \
  --colors black seagreen white sandybrown gold \
  --output output/custom-pattern.jpg
```

Generate a larger image with custom colors:

```bash
python3 src/entry/main.py \
  --iterations 6 \
  --width 7000 \
  --height 7000 \
  --scalar 24 \
  --no-outline \
  --colors black seagreen white sandybrown gold \
  --output output/custom-pattern.jpg
```

Generate a seed-based crop:

```bash
python3 src/entry/main.py --seed 6 --output output/seed-6.png
```

Open a Tk preview window while also saving the file:

```bash
python3 src/entry/main.py --show-window
```

Developer setup, API service usage, and deployment notes live in [dev/INSTRUCTIONS.md](dev/INSTRUCTIONS.md).

### Spectre (Rust)

Generate a Spectre SVG snapshot:

```bash
cargo run --manifest-path src/spectre_rs/Cargo.toml -- \
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
- The current codebase is aimed at experimentation and image generation, not yet a polished web app.
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
