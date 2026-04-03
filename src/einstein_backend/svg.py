from pathlib import Path
from xml.sax.saxutils import escape


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


def save_tiles_svg(tiles, width, height, scalar, filename, draw_outline=True):
    cx = width / 2
    cy = height / 2
    stroke = "black" if draw_outline else "none"
    stroke_width = 2 if draw_outline else 0

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        '<rect width="100%" height="100%" fill="white" />',
    ]

    for tile in tiles:
        points = [(vec.x * scalar + cx, vec.y * scalar + cy) for vec in tile[0]]
        fill = _normalize_svg_color(tile[1])
        lines.append(_svg_polygon(points, fill, stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)


def save_seed_tiles_svg(tiles, width, height, scalar, offset_coord, filename, draw_outline=True):
    stroke = "black" if draw_outline else "none"
    stroke_width = 2 if draw_outline else 0

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        '<rect width="100%" height="100%" fill="white" />',
    ]

    for tile in tiles:
        points = [
            (
                vec.x * scalar - offset_coord.x * width,
                vec.y * scalar + height + offset_coord.y * height,
            )
            for vec in tile[0]
        ]
        fill = _normalize_svg_color(tile[1])
        lines.append(_svg_polygon(points, fill, stroke, stroke_width))

    lines.append("</svg>")

    output_path = Path(filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(output_path)
