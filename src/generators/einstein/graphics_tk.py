from pathlib import Path

from PIL import Image, ImageDraw

from .svg import save_tiles_svg


def is_no_color(color):
    return str(color).strip().lower() in ("none", "transparent")

try:
    from tkinter import Canvas, Tk
    TK_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    Canvas = object
    Tk = None
    TK_AVAILABLE = False


class EinsteinCanvas(Canvas):
    def __init__(self, master, *args, center_x=0, center_y=0, **kwargs):
        Canvas.__init__(self, master, *args, **kwargs)
        self.scalar = 1
        self.center_x = center_x
        self.center_y = center_y

    def set_scalar(self, scalar):
        self.scalar = scalar

    def draw_polygon(self, vertices, fill="blue", outline="black", outline_width=2):
        coordinates = []
        for vec in vertices:
            coordinates.append((vec.x - self.center_x) * self.scalar + self.winfo_reqwidth() / 2)
            coordinates.append((vec.y - self.center_y) * self.scalar + self.winfo_reqheight() / 2)

        canvas_fill = "" if str(fill).strip().lower() in ("none", "transparent") else fill
        self.create_polygon(coordinates, fill=canvas_fill, width=outline_width, outline=outline)


class EinsteinImage:
    def __init__(self, width, height, bg=(255, 255, 255), scalar=1, center_x=0, center_y=0):
        self.width = width
        self.height = height
        self.scalar = scalar
        self.center_x = center_x
        self.center_y = center_y
        self.img = Image.new("RGB", (width, height), bg)
        self.draw = ImageDraw.Draw(self.img)

    def set_scalar(self, scalar):
        self.scalar = scalar

    def project_vertices(self, vertices):
        cx = self.width / 2
        cy = self.height / 2
        return [
            ((vec.x - self.center_x) * self.scalar + cx, (vec.y - self.center_y) * self.scalar + cy)
            for vec in vertices
        ]

    def intersects_canvas(self, coords, margin=0):
        xs, ys = zip(*coords)
        return not (
            max(xs) < -margin
            or min(xs) > self.width + margin
            or max(ys) < -margin
            or min(ys) > self.height + margin
        )

    def draw_polygon(self, vertices, fill="blue", outline="black", outline_width=2):
        coords = self.project_vertices(vertices)

        if isinstance(fill, (list, tuple)):
            if len(fill) == 0:
                fill_val = None
            elif isinstance(fill[0], str):
                fill_val = fill[0]
            elif all(isinstance(c, int) for c in fill):
                fill_val = tuple(fill)
            elif len(fill) > 1 and isinstance(fill[1], (list, tuple)) and all(isinstance(c, int) for c in fill[1]):
                fill_val = tuple(fill[1])
            else:
                fill_val = str(fill[0])
        else:
            fill_val = fill

        if fill_val is None and outline is None:
            return

        line_width = max(1, round(outline_width)) if outline else 0
        if not self.intersects_canvas(coords, margin=line_width):
            return

        # Pillow's polygon(width > 1) creates several canvas-sized masks for
        # every polygon. Drawing the fill and stroke separately avoids that
        # cost while producing the same visible tile boundaries.
        if fill_val is not None:
            self.draw.polygon(coords, fill=fill_val)
        if outline is not None:
            self.draw.line(coords + [coords[0]], fill=outline, width=line_width, joint="curve")

    def save(self, filename):
        try:
            output_path = Path(filename)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            self.img.save(output_path)
            print("Saved successfully:", output_path)
        except Exception as e:
            print("SAVE FAILED:", e)

    def get_image(self):
        return self.img


def draw_tiles(
    tiles,
    width=1600,
    height=1600,
    scalar=20,
    center_x=0,
    center_y=0,
    filename="output/einstein_pattern.jpg",
    show_window=False,
    draw_outline=True,
    background="white",
    outline="black",
    stroke_width=2,
    material_mode="solid",
    pattern_base="white",
    pattern_color="#00c200",
):
    outline = outline if draw_outline and stroke_width > 0 and not is_no_color(outline) else None
    outline_width = stroke_width if outline else 0
    if filename:
        output_path = Path(filename)
        if output_path.suffix.lower() == ".svg":
            save_tiles_svg(
                tiles,
                width=width,
                height=height,
                scalar=scalar,
                center_x=center_x,
                center_y=center_y,
                filename=filename,
                background=background,
                outline=outline or "none",
                stroke_width=outline_width,
                material_mode=material_mode,
                pattern_base=pattern_base,
                pattern_color=pattern_color,
            )
        else:
            raster_background = "white" if is_no_color(background) else background
            img = EinsteinImage(
                width, height, bg=raster_background, scalar=scalar, center_x=center_x, center_y=center_y
            )
            for tile in tiles:
                img.draw_polygon(tile[0], fill=tile[1][1], outline=outline, outline_width=outline_width)

            img.save(filename)
    if show_window:
        if not TK_AVAILABLE:
            raise RuntimeError(
                "Tkinter is not available in this Python installation. "
                "Run with show_window=False or install a Python build with Tk support."
            )
        root = Tk()
        canvas_background = "white" if is_no_color(background) else background
        canvas = EinsteinCanvas(
            root, width=width, height=height, bg=canvas_background, center_x=center_x, center_y=center_y
        )
        canvas.set_scalar(scalar)

        for tile in tiles:
            canvas.draw_polygon(tile[0], fill=tile[1][0], outline=outline, outline_width=outline_width)

        canvas.pack()
        root.mainloop()
    return filename
