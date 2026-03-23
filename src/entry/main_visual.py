import subprocess
import sys
import threading
from pathlib import Path
from typing import cast

from PIL import ImageColor

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ModuleNotFoundError as exc:  # pragma: no cover - environment-specific
    raise SystemExit(
        "Tkinter is not available in this Python installation. "
        "Install python3-tk to use main_visual.py."
    ) from exc


LAUNCHER_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = LAUNCHER_DIR.parent.parent
MAIN_SCRIPT = LAUNCHER_DIR / "main.py"
DEFAULT_OUTPUT = PROJECT_ROOT / "output" / "custom-pattern.jpg"
COLOR_LABELS = ("H1", "H", "T", "P", "F")
AVAILABLE_COLORS = tuple(sorted(ImageColor.colormap))


class GeneratorLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("Aperiodic Monotiles Generator")
        self.root.resizable(False, False)

        self.iterations_var = tk.StringVar(value="6")
        self.width_var = tk.StringVar(value="7000")
        self.height_var = tk.StringVar(value="7000")
        self.scalar_var = tk.StringVar(value="24")
        self.output_var = tk.StringVar(value=str(DEFAULT_OUTPUT))
        self.show_window_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="Choose values and generate an image.")

        self.color_vars = {
            "H1": tk.StringVar(value="black"),
            "H": tk.StringVar(value="seagreen"),
            "T": tk.StringVar(value="white"),
            "P": tk.StringVar(value="sandybrown"),
            "F": tk.StringVar(value="gold"),
        }
        self.color_swatches = {}

        self._build_ui()

    def _build_ui(self):
        frame = ttk.Frame(self.root, padding=16)
        frame.grid(sticky="nsew")

        fields = (
            ("Iterations", self.iterations_var),
            ("Width", self.width_var),
            ("Height", self.height_var),
            ("Scalar", self.scalar_var),
        )

        for row, (label, variable) in enumerate(fields):
            ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=4)
            ttk.Entry(frame, textvariable=variable, width=16).grid(row=row, column=1, sticky="ew", pady=4)

        ttk.Label(frame, text="Colors").grid(row=4, column=0, sticky="nw", pady=(8, 4))
        colors_frame = ttk.Frame(frame)
        colors_frame.grid(row=4, column=1, sticky="ew", pady=(8, 4))

        for row, label in enumerate(COLOR_LABELS):
            ttk.Label(colors_frame, text=label, width=4).grid(row=row, column=0, sticky="w", pady=2)
            color_box = ttk.Combobox(
                colors_frame,
                textvariable=self.color_vars[label],
                values=AVAILABLE_COLORS,
                width=18,
            )
            color_box.grid(row=row, column=1, sticky="ew", pady=2)
            swatch = tk.Canvas(colors_frame, width=24, height=24, highlightthickness=0, bd=0)
            swatch.grid(row=row, column=2, padx=(8, 0), pady=2)
            self.color_swatches[label] = swatch
            self.color_vars[label].trace_add("write", lambda *_args, color_label=label: self._update_color_swatch(color_label))
            self._update_color_swatch(label)

        ttk.Label(
            colors_frame,
            text="Choose a named color or type a custom Pillow/CSS color value.",
            wraplength=320,
            justify="left",
        ).grid(row=len(COLOR_LABELS), column=0, columnspan=3, sticky="w", pady=(6, 0))

        ttk.Label(frame, text="Output").grid(row=5, column=0, sticky="w", pady=4)
        output_frame = ttk.Frame(frame)
        output_frame.grid(row=5, column=1, sticky="ew", pady=4)
        ttk.Entry(output_frame, textvariable=self.output_var, width=32).grid(row=0, column=0, sticky="ew")
        ttk.Button(output_frame, text="Browse", command=self._choose_output).grid(row=0, column=1, padx=(8, 0))
        output_frame.columnconfigure(0, weight=1)

        ttk.Checkbutton(frame, text="Open render preview window", variable=self.show_window_var).grid(
            row=6, column=0, columnspan=2, sticky="w", pady=(8, 4)
        )

        generate_button = ttk.Button(frame, text="Generate", command=self._start_generation)
        generate_button.grid(row=7, column=0, columnspan=2, sticky="ew", pady=(12, 6))
        self.generate_button = cast(ttk.Button, generate_button)

        ttk.Label(frame, textvariable=self.status_var, wraplength=420, justify="left").grid(
            row=8, column=0, columnspan=2, sticky="w"
        )

        frame.columnconfigure(1, weight=1)

    def _update_color_swatch(self, label):
        swatch = self.color_swatches[label]
        swatch.delete("all")

        color_value = self.color_vars[label].get().strip()
        try:
            rgb = ImageColor.getrgb(color_value)
            fill_color = "#%02x%02x%02x" % rgb
            swatch.create_oval(2, 2, 22, 22, fill=fill_color, outline="#333333", width=1)
        except ValueError:
            swatch.create_rectangle(2, 2, 22, 22, fill="#f8f8f8", outline="#cc3333", width=1)
            swatch.create_line(6, 6, 18, 18, fill="#cc3333", width=2)
            swatch.create_line(18, 6, 6, 18, fill="#cc3333", width=2)

    def _choose_output(self):
        selected = filedialog.asksaveasfilename(
            title="Choose output image",
            initialdir=str(PROJECT_ROOT / "output"),
            initialfile=Path(self.output_var.get()).name or DEFAULT_OUTPUT.name,
            defaultextension=".jpg",
            filetypes=[
                ("JPEG image", "*.jpg"),
                ("PNG image", "*.png"),
                ("All files", "*.*"),
            ],
        )
        if selected:
            self.output_var.set(selected)

    def _start_generation(self):
        try:
            command = self._build_command()
        except ValueError as exc:
            messagebox.showerror("Invalid input", str(exc))
            return

        self.generate_button.state(["disabled"])
        self.status_var.set("Generating image...")

        worker = threading.Thread(target=self._run_generation, args=(command,), daemon=True)
        worker.start()

    def _build_command(self):
        numeric_fields = {
            "--iterations": self.iterations_var.get(),
            "--width": self.width_var.get(),
            "--height": self.height_var.get(),
            "--scalar": self.scalar_var.get(),
        }

        command = [sys.executable, str(MAIN_SCRIPT)]
        for flag, value in numeric_fields.items():
            cleaned = value.strip()
            if not cleaned:
                raise ValueError(f"{flag} requires a value.")
            parsed = int(cleaned)
            if parsed <= 0:
                raise ValueError(f"{flag} must be a positive integer.")
            command.extend([flag, str(parsed)])

        colors = []
        for label in COLOR_LABELS:
            color = self.color_vars[label].get().strip()
            if not color:
                raise ValueError(f"Color {label} cannot be empty.")
            try:
                ImageColor.getrgb(color)
            except ValueError as exc:
                raise ValueError(f"Color {label} is not recognized: {color}") from exc
            colors.append(color)

        output = self.output_var.get().strip()
        if not output:
            raise ValueError("Output path cannot be empty.")

        command.extend(["--colors", *colors, "--output", output])
        if self.show_window_var.get():
            command.append("--show-window")

        return command

    def _run_generation(self, command):
        try:
            completed = subprocess.run(
                command,
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
        except Exception as exc:  # pragma: no cover - subprocess failures are environment-specific
            self.root.after(0, self._finish_generation, False, f"Failed to start generator: {exc}")
            return

        if completed.returncode == 0:
            output = completed.stdout.strip().splitlines()
            message = output[-1] if output else "Image generated successfully."
            self.root.after(0, self._finish_generation, True, message)
            return

        error_lines = [line for line in completed.stderr.strip().splitlines() if line]
        if not error_lines:
            error_lines = [line for line in completed.stdout.strip().splitlines() if line]
        message = error_lines[-1] if error_lines else "Generation failed."
        self.root.after(0, self._finish_generation, False, message)

    def _finish_generation(self, success, message):
        self.generate_button.state(["!disabled"])
        self.status_var.set(message)
        if success:
            messagebox.showinfo("Generation complete", message)
        else:
            messagebox.showerror("Generation failed", message)


def main():
    root = tk.Tk()
    GeneratorLauncher(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
