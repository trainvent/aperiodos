from pathlib import Path

from .geometry import Vector
from .pattern_generator import (
    DEFAULT_COLORS,
    DEFAULT_FOUR_COLORS,
    apply_four_coloring,
    next_generation,
    reset_generator,
    vertices_to_draw,
)
from .svg import save_seed_tiles_svg


def seed_to_coordinate(seed):
    found_layer = False
    start_of_layer = 1
    layer = 0

    while not found_layer:
        if seed >= start_of_layer and seed < start_of_layer + (4 + 8 * layer):
            found_layer = True
        else:
            start_of_layer = start_of_layer + (4 + 8 * layer)
            layer += 1

    number_of_coords_in_layer = 4 + layer * 8
    output_coord = Vector(0, 0)

    if seed >= start_of_layer and seed <= start_of_layer + layer:
        output_coord.y = layer
        output_coord.x = seed - start_of_layer
    elif seed < start_of_layer + number_of_coords_in_layer and seed >= start_of_layer + number_of_coords_in_layer - layer - 1:
        output_coord.y = layer
        output_coord.x = seed - (start_of_layer + number_of_coords_in_layer)
    elif seed > start_of_layer + layer * 3 and seed <= start_of_layer + layer * 5 + 2:
        output_coord.y = -layer - 1
        output_coord.x = (start_of_layer + layer * 4 + 1) - seed
    elif seed > start_of_layer + layer and seed <= start_of_layer + layer * 3:
        output_coord.x = layer
        output_coord.y = (start_of_layer + layer * 2) - seed
    elif seed > start_of_layer + layer * 5 + 2 and seed < start_of_layer + number_of_coords_in_layer - layer - 1:
        output_coord.x = -layer - 1
        output_coord.y = seed - (start_of_layer + layer * 6 + 3)

    return output_coord


def seed_to_pattern(
    seed=1,
    output_file_name="output/seed-pattern.png",
    center_x=0,
    center_y=0,
    draw_outline=True,
    background="white",
    colors=DEFAULT_COLORS,
    color_mode="families",
    four_colors=DEFAULT_FOUR_COLORS,
    outline="black",
    stroke_width=2,
):
    try:
        import cv2
        import numpy as np
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Seed-based rendering requires NumPy and OpenCV. Install dependencies from requirements.txt first."
        ) from exc
    from PIL import ImageColor

    from .graphics_cv2 import OUTPUT_IMAGE_DIMENSIONS, SCALAR, draw_tile

    output_path = Path(output_file_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    offset_coordinate = seed_to_coordinate(seed)

    reset_generator()
    next_generation(colors)
    raster_background = "white" if str(background).strip().lower() in ("none", "transparent") else background
    background_bgr = tuple(reversed(ImageColor.getrgb(raster_background)))

    while True:
        output_image = np.full(
            (OUTPUT_IMAGE_DIMENSIONS.y, OUTPUT_IMAGE_DIMENSIONS.x, 3), background_bgr, dtype=np.uint8
        )
        coverage_mask = np.zeros((OUTPUT_IMAGE_DIMENSIONS.y, OUTPUT_IMAGE_DIMENSIONS.x), dtype=np.uint8)
        if color_mode == "four_color":
            apply_four_coloring(four_colors)
        for tile in vertices_to_draw:
            output_image = draw_tile(
                tile,
                output_image,
                offset_coord=offset_coordinate,
                center_x=center_x,
                center_y=center_y,
                draw_outline=draw_outline,
                outline=outline,
                stroke_width=stroke_width,
                coverage_mask=coverage_mask,
            )

        if np.count_nonzero(coverage_mask == 0) <= 3:
            if output_path.suffix.lower() == ".svg":
                save_seed_tiles_svg(
                    vertices_to_draw,
                    width=int(OUTPUT_IMAGE_DIMENSIONS.x),
                    height=int(OUTPUT_IMAGE_DIMENSIONS.y),
                    scalar=SCALAR,
                    offset_coord=offset_coordinate,
                    filename=str(output_path),
                    center_x=center_x,
                    center_y=center_y,
                    background=background,
                    outline=outline if draw_outline else "none",
                    stroke_width=stroke_width if draw_outline else 0,
                )
            else:
                cv2.imwrite(str(output_path), output_image)
            return str(output_path)

        next_generation(colors)
