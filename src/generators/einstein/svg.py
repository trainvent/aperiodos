from pathlib import Path
from xml.sax.saxutils import escape

from .geometry import Vector, hat_outline, mat_vec_mul


def _normalize_svg_color(fill):
    if fill is None:
        return "none"
    if isinstance(fill, (list, tuple)):
        if len(fill) == 0:
            return "none"
        if isinstance(fill[0], str):
            return fill[0]
        if all(isinstance(channel, int) for channel in fill):
            return f"rgb({fill[0]},{fill[1]},{fill[2]})"
        if len(fill) > 1 and isinstance(fill[1], (list, tuple)) and all(isinstance(channel, int) for channel in fill[1]):
            rgb = fill[1]
            return f"rgb({rgb[0]},{rgb[1]},{rgb[2]})"
        return str(fill[0])
    return str(fill)


def _svg_polygon(points, fill, stroke, stroke_width):
    point_string = " ".join(f"{x:.2f},{y:.2f}" for x, y in points)
    return (
        f'<polygon points="{point_string}" fill="{escape(fill)}" '
        f'stroke="{escape(stroke)}" stroke-width="{stroke_width}" stroke-linejoin="round" />'
    )


# The motif is authored once in the hat's own coordinate system. Every control
# point is transformed by the tile's matrix, so reflected hats get a reflected
# motif rather than a continuation of a page-wide pattern.
_CURVES_MOTIF = (
    (
        0.68,
        (
            Vector(-0.2, 0.95),
            Vector(0.55, 0.92),
            Vector(0.62, 1.62),
            Vector(1.2, 1.86),
            Vector(1.72, 2.08),
            Vector(2.08, 1.72),
            Vector(2.62, 1.95),
        ),
    ),
    (
        1.08,
        (
            Vector(-1.42, -1.15),
            Vector(-0.38, -1.62),
            Vector(0.02, -0.58),
            Vector(0.58, -0.2),
            Vector(1.12, 0.18),
            Vector(1.35, -0.72),
            Vector(1.82, -0.86),
            Vector(2.48, -1.08),
            Vector(2.72, -0.16),
            Vector(4.18, -0.42),
        ),
    ),
)


def _curve_path(points):
    commands = [f"M {points[0][0]:.2f} {points[0][1]:.2f}"]
    for index in range(1, len(points), 3):
        controls = points[index:index + 3]
        commands.append(
            "C " + " ".join(f"{x:.2f} {y:.2f}" for x, y in controls)
        )
    return " ".join(commands)


_HAT_POINTS = " ".join(f"{point.x:.4f},{point.y:.4f}" for point in hat_outline)


def _svg_pattern_defs():
    paths = "".join(
        f'<path d="{_curve_path([(point.x, point.y) for point in curve])}" stroke-width="{width:.4f}" />'
        for width, curve in _CURVES_MOTIF
    )
    return (
        '<defs>'
        f'<clipPath id="einstein-hat-clip" clipPathUnits="userSpaceOnUse"><polygon points="{_HAT_POINTS}" /></clipPath>'
        f'<g id="einstein-curves-motif" fill="none" stroke-linecap="round" stroke-linejoin="round">{paths}</g>'
        '</defs>'
    )


def _screen_matrix(transform, project):
    origin = project(mat_vec_mul(transform, Vector(0, 0)))
    x_axis = project(mat_vec_mul(transform, Vector(1, 0)))
    y_axis = project(mat_vec_mul(transform, Vector(0, 1)))
    return (
        x_axis[0] - origin[0],
        x_axis[1] - origin[1],
        y_axis[0] - origin[0],
        y_axis[1] - origin[1],
        origin[0],
        origin[1],
    )


def _svg_pattern_tile(tile, project, base_color, curve_color, stroke, stroke_width):
    transform = tile[2]
    matrix = " ".join(f"{value:.6f}" for value in _screen_matrix(transform, project))
    return (
        f'<g transform="matrix({matrix})">'
        f'<polygon points="{_HAT_POINTS}" fill="{escape(str(base_color))}" />'
        f'<g clip-path="url(#einstein-hat-clip)" stroke="{escape(str(curve_color))}">'
        '<use href="#einstein-curves-motif" />'
        '</g>'
        f'<polygon points="{_HAT_POINTS}" fill="none" stroke="{escape(stroke)}" '
        f'stroke-width="{stroke_width}" stroke-linejoin="round" vector-effect="non-scaling-stroke" />'
        '</g>'
    )


def save_tiles_svg(
    tiles, width, height, scalar, filename, center_x=0, center_y=0, background="white", outline="black", stroke_width=2,
    material_mode="solid", pattern_base="white", pattern_color="#00b51a"
):
    cx = width / 2
    cy = height / 2
    stroke = outline if stroke_width > 0 else "none"

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        f'<rect width="100%" height="100%" fill="{escape(str(background))}" />',
    ]
    project = lambda vec: ((vec.x - center_x) * scalar + cx, (vec.y - center_y) * scalar + cy)
    if material_mode == "pattern":
        lines.append(_svg_pattern_defs())
    for tile in tiles:
        points = [project(vec) for vec in tile[0]]
        if material_mode == "pattern":
            lines.append(_svg_pattern_tile(tile, project, pattern_base, pattern_color, stroke, stroke_width))
        else:
            lines.append(_svg_polygon(points, _normalize_svg_color(tile[1]), stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)


def save_seed_tiles_svg(
    tiles, width, height, scalar, offset_coord, filename, center_x=0, center_y=0, background="white", outline="black", stroke_width=2,
    material_mode="solid", pattern_base="white", pattern_color="#00b51a"
):
    stroke = outline if stroke_width > 0 else "none"

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        f'<rect width="100%" height="100%" fill="{escape(str(background))}" />',
    ]
    project = lambda vec: (
        (vec.x - center_x) * scalar - offset_coord.x * width,
        (vec.y - center_y) * scalar + height + offset_coord.y * height,
    )
    if material_mode == "pattern":
        lines.append(_svg_pattern_defs())
    for tile in tiles:
        points = [project(vec) for vec in tile[0]]
        if material_mode == "pattern":
            lines.append(_svg_pattern_tile(tile, project, pattern_base, pattern_color, stroke, stroke_width))
        else:
            lines.append(_svg_polygon(points, _normalize_svg_color(tile[1]), stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)
