from pathlib import Path

from PIL import Image, ImageDraw

from .svg import save_tiles_svg

try:
    from tkinter import Canvas, Tk
    TK_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    Canvas = object
    Tk = None
    TK_AVAILABLE = False


class EinsteinCanvas(Canvas):
    def __init__(self, master, *args, **kwargs):
        Canvas.__init__(self, master, *args, **kwargs)
        self.scalar = 1

    def set_scalar(self, scalar):
        self.scalar = scalar

    def draw_polygon(self, vertices, fill="blue", outline="black", outline_width=2):
        coordinates = []
        for vec in vertices:
            coordinates.append(vec.x * self.scalar + self.winfo_reqwidth() / 2)
            coordinates.append(vec.y * self.scalar + self.winfo_reqheight() / 2)

        self.create_polygon(coordinates, fill=fill, width=outline_width, outline=outline)


class EinsteinImage:
    def __init__(self, width, height, bg=(255, 255, 255), scalar=1):
        self.width = width
        self.height = height
        self.scalar = scalar
        self.img = Image.new("RGB", (width, height), bg)
        self.draw = ImageDraw.Draw(self.img)

    def set_scalar(self, scalar):
        self.scalar = scalar

    def draw_polygon(self, vertices, fill="blue", outline="black"):
        coords = []
        cx = self.width / 2
        cy = self.height / 2
        for vec in vertices:
            coords.append((vec.x * self.scalar + cx, vec.y * self.scalar + cy))

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

        self.draw.polygon(coords, fill=fill_val, outline=outline)

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
    width=500,
    height=500,
    scalar=20,
    filename="output/einstein_pattern.jpg",
    show_window=False,
    draw_outline=True,
):
    outline = "black" if draw_outline else None
    outline_width = 2 if draw_outline else 0
    if filename:
        output_path = Path(filename)
        if output_path.suffix.lower() == ".svg":
            save_tiles_svg(tiles, width=width, height=height, scalar=scalar, filename=filename, draw_outline=draw_outline)
        else:
            img = EinsteinImage(width, height, bg="white", scalar=scalar)
            for tile in tiles:
                img.draw_polygon(tile[0], fill=tile[1][1], outline=outline)

            img.save(filename)
    if show_window:
        if not TK_AVAILABLE:
            raise RuntimeError(
                "Tkinter is not available in this Python installation. "
                "Run with show_window=False or install a Python build with Tk support."
            )
        root = Tk()
        canvas = EinsteinCanvas(root, width=width, height=height)
        canvas.set_scalar(scalar)

        for tile in tiles:
            canvas.draw_polygon(tile[0], fill=tile[1][0], outline=outline, outline_width=outline_width)

        canvas.pack()
        root.mainloop()
    return filename
