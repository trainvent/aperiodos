import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from .geometry import hat_outline, identity, mat_vec_mul
from .svg import save_tiles_svg


class CurvesPatternTest(unittest.TestCase):
    def test_pattern_is_clipped_and_transformed_per_tile(self):
        reflected = [-1, 0, 5, 0, 1, 0]
        tiles = [
            [[mat_vec_mul(identity, point) for point in hat_outline], "red", identity],
            [[mat_vec_mul(reflected, point) for point in hat_outline], "blue", reflected],
        ]

        with TemporaryDirectory() as directory:
            output = Path(directory) / "pattern.svg"
            save_tiles_svg(
                tiles,
                width=240,
                height=160,
                scalar=10,
                filename=output,
                material_mode="pattern",
                pattern_base="ivory",
                pattern_color="navy",
            )
            svg = output.read_text(encoding="utf-8")

        self.assertIn('id="einstein-hat-clip"', svg)
        self.assertIn('id="einstein-curves-motif"', svg)
        self.assertEqual(svg.count('fill="ivory"'), 2)
        self.assertEqual(svg.count('stroke="navy"'), 2)
        self.assertIn('matrix(10.000000 0.000000 0.000000 10.000000 120.000000 80.000000)', svg)
        self.assertIn('matrix(-10.000000 0.000000 0.000000 10.000000 170.000000 80.000000)', svg)
        self.assertNotIn('fill="red"', svg)
        self.assertNotIn('fill="blue"', svg)

    def test_solid_material_keeps_family_fill(self):
        tile = [[mat_vec_mul(identity, point) for point in hat_outline], ["red", (255, 0, 0)], identity]
        with TemporaryDirectory() as directory:
            output = Path(directory) / "solid.svg"
            save_tiles_svg([tile], 160, 160, 10, output)
            svg = output.read_text(encoding="utf-8")

        self.assertIn('fill="red"', svg)
        self.assertNotIn("clipPath", svg)


if __name__ == "__main__":
    unittest.main()
