from pathlib import Path
from math import atan2, ceil, cos, hypot, pi, sin, sqrt
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
        1.32,
        (
            Vector(0, 1.53286),
            Vector(0.45, 1.52),
            Vector(1.1, 1.95),
            Vector(1.6725, 2.49848),
        ),
    ),
    (
        1.62,
        (
            Vector(-1.1575, -1.45925),
            Vector(-1.15, -1.18),
            Vector(-0.25, -1.72),
            Vector(1.17, -1.36),
            Vector(1.91, 0.29),
            Vector(3.46, 0.31),
            Vector(4.429, -0.74305),
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


def _lattice_point(point):
    u = float(point["u"])
    v = float(point["v"])
    return (u + v / 2, v * sqrt(3) / 2)


def _circular_path_points(path, steps_per_turn=72):
    point1, point2, point3 = [_lattice_point(point) for point in path["points"]]
    vector12 = (point2[0] - point1[0], point2[1] - point1[1])
    vector23 = (point3[0] - point2[0], point3[1] - point2[1])
    radius = hypot(*vector12) / 2
    angle12 = atan2(vector12[1], vector12[0])
    angle23 = atan2(vector23[1], vector23[0])
    direction = -1 if path.get("side") == "right" else 1
    full_turn = pi * 2

    def directed_delta(start, end, arc_direction):
        if arc_direction > 0:
            return (end - start) % full_turn
        return -((start - end) % full_turn)

    segments = []
    arc_specs = [
        (point1, angle12 + pi, direction * pi),
        (point2, angle12 + pi, directed_delta(angle12 + pi, angle23, -direction)),
        (point3, angle23 + pi, direction * pi),
    ]
    for arc_index, (center, start, delta) in enumerate(arc_specs):
        steps = max(2, ceil(abs(delta) / full_turn * steps_per_turn))
        first_step = 0 if arc_index in (0, 2) else 1
        segments.append([
            (center[0] + radius * cos(start + delta * index / steps), center[1] + radius * sin(start + delta * index / steps))
            for index in range(first_step, steps + 1)
        ])
    return segments


def _studio_motif_elements(pattern, fallback_color):
    elements = []
    collections = {
        "path": {item["id"]: item for item in pattern.get("paths", [])},
        "line": {item["id"]: item for item in pattern.get("lines", [])},
        "circle": {item["id"]: item for item in pattern.get("circles", [])},
        "circularPath": {item["id"]: item for item in pattern.get("circularPaths", [])},
    }
    order = []
    seen = set()
    for entry in pattern.get("layerOrder", []):
        key = (entry.get("kind"), entry.get("id"))
        if key[0] in collections and key[1] in collections[key[0]] and key not in seen:
            order.append(key)
            seen.add(key)
    for kind in ("path", "line", "circle", "circularPath"):
        for item_id in collections[kind]:
            if (kind, item_id) not in seen:
                order.append((kind, item_id))

    for kind, item_id in order:
        item = collections[kind][item_id]
        item_color = escape(str(item.get("color") or fallback_color))
        if kind == "path":
            points = [_lattice_point(point) for point in item["points"]]
            elements.append(f'<path d="{_curve_path(points)}" stroke="{item_color}" stroke-width="{float(item["width"]):.4f}" />')
        elif kind == "line":
            points = [_lattice_point(point) for point in item["points"]]
            elements.append(f'<path d="M {points[0][0]:.4f} {points[0][1]:.4f} L {points[1][0]:.4f} {points[1][1]:.4f}" stroke="{item_color}" stroke-width="{float(item["width"]):.4f}" />')
        elif kind == "circle":
            center = _lattice_point(item["center"])
            fill = item_color if item.get("operation") == "ink" else "var(--einstein-tile-fill)"
            elements.append(
                f'<circle cx="{center[0]:.4f}" cy="{center[1]:.4f}" r="{float(item["radius"]):.4f}" fill="{fill}" stroke="none" />'
            )
        else:
            for segment in _circular_path_points(item):
                elements.append(f'<path d="{_curve_path([segment[0]])} ' + " ".join(f'L {x:.4f} {y:.4f}' for x, y in segment[1:]) + f'" stroke="{item_color}" stroke-width="{float(item["width"]):.4f}" />')
    return "".join(elements)


def _svg_pattern_defs(studio_pattern=None, fallback_color="#00c200"):
    if studio_pattern:
        paths = _studio_motif_elements(studio_pattern, fallback_color)
    else:
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


def _svg_pattern_tile(tile, project, tile_fill, curve_color, stroke, stroke_width):
    transform = tile[2]
    matrix = " ".join(f"{value:.6f}" for value in _screen_matrix(transform, project))
    return (
        f'<g transform="matrix({matrix})" style="--einstein-tile-fill:{escape(str(tile_fill))}">'
        f'<polygon points="{_HAT_POINTS}" fill="{escape(str(tile_fill))}" />'
        f'<g clip-path="url(#einstein-hat-clip)" stroke="{escape(str(curve_color))}" color="{escape(str(curve_color))}">'
        '<use href="#einstein-curves-motif" />'
        '</g>'
        f'<polygon points="{_HAT_POINTS}" fill="none" stroke="{escape(stroke)}" '
        f'stroke-width="{stroke_width}" stroke-linejoin="round" vector-effect="non-scaling-stroke" />'
        '</g>'
    )


def save_tiles_svg(
    tiles, width, height, scalar, filename, center_x=0, center_y=0, background="white", outline="black", stroke_width=2,
    material_mode="solid", pattern_base="white", pattern_color="#00c200", studio_pattern=None
):
    cx = width / 2
    cy = height / 2
    stroke = outline if stroke_width > 0 else "none"

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        f'<rect width="100%" height="100%" fill="{escape(str(background))}" />',
    ]
    project = lambda vec: ((vec.x - center_x) * scalar + cx, (vec.y - center_y) * scalar + cy)
    curve_color = str(studio_pattern.get("colors", {}).get("ink", pattern_color)) if studio_pattern else pattern_color
    tile_fill = str(studio_pattern.get("colors", {}).get("base", pattern_base)) if studio_pattern else pattern_base
    if material_mode == "pattern":
        lines.append(_svg_pattern_defs(studio_pattern, curve_color))
    for tile in tiles:
        points = [project(vec) for vec in tile[0]]
        if material_mode == "pattern":
            lines.append(_svg_pattern_tile(tile, project, tile_fill, curve_color, stroke, stroke_width))
        else:
            lines.append(_svg_polygon(points, _normalize_svg_color(tile[1]), stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)


def save_seed_tiles_svg(
    tiles, width, height, scalar, offset_coord, filename, center_x=0, center_y=0, background="white", outline="black", stroke_width=2,
    material_mode="solid", pattern_base="white", pattern_color="#00c200", studio_pattern=None
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
    curve_color = str(studio_pattern.get("colors", {}).get("ink", pattern_color)) if studio_pattern else pattern_color
    if material_mode == "pattern":
        lines.append(_svg_pattern_defs(studio_pattern, curve_color))
    for tile in tiles:
        points = [project(vec) for vec in tile[0]]
        if material_mode == "pattern":
            lines.append(_svg_pattern_tile(tile, project, curve_color, stroke, stroke_width))
        else:
            lines.append(_svg_polygon(points, _normalize_svg_color(tile[1]), stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)
