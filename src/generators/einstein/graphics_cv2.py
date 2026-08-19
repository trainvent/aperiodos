import cv2
import numpy as np
from PIL import ImageColor

from .geometry import Vector

OUTPUT_IMAGE_DIMENSIONS = Vector(800, 800)
SCALAR = 50


def draw_tile(
    tile,
    image,
    offset_coord=Vector(0, 0),
    center_x=0,
    center_y=0,
    draw_outline=True,
    outline="black",
    stroke_width=2,
    coverage_mask=None,
):
    fill = tile[1][1]
    vertices = np.zeros((len(tile[0]), 2))

    for i in range(len(tile[0])):
        vertices[i][0] = (tile[0][i].x - center_x) * SCALAR - offset_coord.x * OUTPUT_IMAGE_DIMENSIONS.x
        vertices[i][1] = (tile[0][i].y - center_y) * SCALAR + OUTPUT_IMAGE_DIMENSIONS.y + offset_coord.y * OUTPUT_IMAGE_DIMENSIONS.y

    vertices = vertices.astype(int)
    if coverage_mask is not None:
        cv2.fillPoly(coverage_mask, pts=[vertices], color=255)
    output_image = image
    if fill is not None:
        output_image = cv2.fillPoly(image, pts=[vertices], color=fill)
    if draw_outline and stroke_width > 0 and str(outline).strip().lower() not in ("none", "transparent"):
        outline_bgr = tuple(reversed(ImageColor.getrgb(outline)))
        output_image = cv2.polylines(image, [vertices], True, outline_bgr, max(1, round(stroke_width)))
    return output_image
