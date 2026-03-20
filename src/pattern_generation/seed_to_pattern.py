from pathlib import Path

from .geometry import Vector
from .pattern_generator import next_generation, reset_generator, vertices_to_draw


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


def seed_to_pattern(seed=1, output_file_name="output/seed-pattern.png"):
    try:
        import cv2
        import numpy as np
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Seed-based rendering requires NumPy and OpenCV. Install dependencies from requirements.txt first."
        ) from exc
    from .graphics_cv2 import OUTPUT_IMAGE_DIMENSIONS, draw_tile

    output_path = Path(output_file_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    offset_coordinate = seed_to_coordinate(seed)

    reset_generator()
    next_generation()

    while True:
        output_image = np.full((OUTPUT_IMAGE_DIMENSIONS.y, OUTPUT_IMAGE_DIMENSIONS.x, 3), 255)
        for tile in vertices_to_draw:
            output_image = draw_tile(tile, output_image, offset_coord=offset_coordinate)

        if np.count_nonzero(output_image == 255) <= 9:
            cv2.imwrite(str(output_path), output_image)
            return str(output_path)

        next_generation()
