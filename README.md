# Aperiodic Monotiles Generator

Generate images based on the "einstein" aperiodic monotile using a small Python CLI.

The project currently focuses on offline image generation. The longer-term goal is to use this generator as the backend for a website where people can tweak colors, size, image dimensions, tile variants, and download finished artwork.

## What It Does

- Renders a full monotile pattern as a JPG image.
- Supports custom output size, scale, subdivision depth, and colors.
- Includes a seed-based export mode for generating a unique cropped section of the pattern.

## Project Structure

```text
.
├── aperiodic-generator      # Executable launcher for GUI or direct CLI rendering
├── src/
│   ├── entry/               # Launcher scripts for CLI and GUI entrypoints
│   └── pattern_generation/  # Source package with the generator code
├── output/                  # Generated images are written here by default
└── README.md
```

## System Packages

On Debian/Ubuntu, install the needed Python packages with:

```bash
sudo apt update
sudo apt install -y python3 python3-pil python3-opencv python3-tk
```

Alternativly you can install the packages via pip:

```bash
pip install pillow tkinter
```

Package notes:

- `python3-pil` is used for the normal image renderer.
- `python3-opencv` is only needed for `--seed` mode.
- `python3-tk` is only needed for `--show-window`.

## Usage

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
- Earlier inspiration repository: https://github.com/asmoly/Einstein_Tile_Generator
-
