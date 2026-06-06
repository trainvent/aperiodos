import argparse

from .graphics_tk import draw_tiles
from .pattern_generator import (
    DEFAULT_COLORS,
    DEFAULT_FOUR_COLORS,
    apply_four_coloring,
    next_generation,
    reset_generator,
    vertices_to_draw,
)
from .seed_to_pattern import seed_to_pattern

DEFAULT_ITERATIONS = 5
DEFAULT_SCALAR = 20
DEFAULT_WIDTH = 5000
DEFAULT_HEIGHT = 5000
DEFAULT_OUTPUT = "output/einstein_pattern.jpg"


def render_pattern(
    iterations=DEFAULT_ITERATIONS,
    scalar=DEFAULT_SCALAR,
    width=DEFAULT_WIDTH,
    height=DEFAULT_HEIGHT,
    output=DEFAULT_OUTPUT,
    colors=DEFAULT_COLORS,
    color_mode="families",
    four_colors=DEFAULT_FOUR_COLORS,
    show_window=False,
    draw_outline=True,
):
    reset_generator()
    for _ in range(iterations):
        next_generation(colors)

    if color_mode == "four_color":
        apply_four_coloring(four_colors)

    return draw_tiles(
        vertices_to_draw,
        width=width,
        height=height,
        scalar=scalar,
        filename=output,
        show_window=show_window,
        draw_outline=draw_outline,
    )


def build_parser():
    parser = argparse.ArgumentParser(description="Generate aperiodic Einstein tile images from the Einstein backend.")
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS, help="Number of subdivision rounds to render.")
    parser.add_argument("--scalar", type=int, default=DEFAULT_SCALAR, help="Pixel scale for each tile coordinate.")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help="Output image width in pixels.")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help="Output image height in pixels.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Path for the generated image.")
    parser.add_argument(
        "--colors",
        nargs=5,
        metavar=("H1", "H", "T", "P", "F"),
        default=DEFAULT_COLORS,
        help="Five CSS-style colors for the H1, H, T, P, and F tile families.",
    )
    parser.add_argument(
        "--color-mode",
        choices=("families", "four_color"),
        default="families",
        help="Use the existing five-family palette or an article-inspired four-color mode.",
    )
    parser.add_argument(
        "--four-colors",
        nargs=4,
        metavar=("C1", "C2", "C3", "C4"),
        default=DEFAULT_FOUR_COLORS,
        help="Four CSS-style colors for the optional four-color Einstein mode.",
    )
    parser.add_argument("--show-window", action="store_true", help="Open a Tk window in addition to saving the image.")
    parser.add_argument("--no-outline", action="store_true", help="Render filled tiles without black outlines.")
    parser.add_argument("--seed", type=int, help="Generate a seed-based cropped pattern instead of the full centered render.")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.seed is not None:
        output = seed_to_pattern(
            seed=args.seed,
            output_file_name=args.output,
            draw_outline=not args.no_outline,
            colors=tuple(args.colors),
            color_mode=args.color_mode,
            four_colors=tuple(args.four_colors),
        )
    else:
        output = render_pattern(
            iterations=args.iterations,
            scalar=args.scalar,
            width=args.width,
            height=args.height,
            output=args.output,
            colors=tuple(args.colors),
            color_mode=args.color_mode,
            four_colors=tuple(args.four_colors),
            show_window=args.show_window,
            draw_outline=not args.no_outline,
        )

    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
