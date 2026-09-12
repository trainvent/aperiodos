import assert from "node:assert/strict";
import test from "node:test";

import {
  paletteFromStudioPattern,
  penrosePaletteFields,
  studioPatternWithPalette,
} from "../features/generators/penrosePalette.js";

test("Penrose palette fields follow the selected prototile set", () => {
  assert.deepEqual(penrosePaletteFields("kite-dart"), ["palette_1", "palette_2"]);
  assert.deepEqual(penrosePaletteFields("rhombs"), ["palette_1", "palette_2"]);
  assert.deepEqual(penrosePaletteFields("p1"), ["palette_1", "palette_2", "palette_3", "palette_4"]);
});

test("Studio tile colors populate the matching Penrose palette fields", () => {
  const pattern = {
    colors: { base: "#ffffff" },
    tileColors: { dart: "#aa0000", kite: "#00aa00" },
  };
  assert.deepEqual(paletteFromStudioPattern(pattern, "kite-dart"), ["#aa0000", "#00aa00"]);
  assert.deepEqual(paletteFromStudioPattern({ colors: { base: "#123456" } }, "rhombs"), ["#123456", "#123456"]);
});

test("Edited generator colors override the selected Studio pattern", () => {
  const pattern = {
    id: "p1-pattern",
    colors: { base: "#ffffff", ink: "#000000" },
    tileColors: { pentagon: "#111111", star: "#222222", boat: "#333333", diamond: "#444444" },
  };
  const result = studioPatternWithPalette(pattern, "p1", {
    palette_1: "#a00000",
    palette_2: "#00a000",
    palette_3: "#0000a0",
    palette_4: "#a0a000",
  });

  assert.equal(result.id, pattern.id);
  assert.equal(result.colors.base, "#a00000");
  assert.deepEqual(result.tileColors, {
    pentagon: "#a00000",
    star: "#00a000",
    boat: "#0000a0",
    diamond: "#a0a000",
  });
});

test("P1 over P3 exposes and updates only its two rhomb colors", () => {
  const pattern = {
    colors: { base: "#ffffff" },
    penroseOverlay: {
      enabled: true,
      type: "rhombs",
      thinColor: "#204a87",
      thickColor: "#555753",
      edgeColor: "#edd400",
    },
  };
  assert.deepEqual(paletteFromStudioPattern(pattern, "p1"), ["#204a87", "#555753"]);
  const updated = studioPatternWithPalette(pattern, "p1", { palette_1: "#112233", palette_2: "#445566" });
  assert.equal(updated.penroseOverlay.thinColor, "#112233");
  assert.equal(updated.penroseOverlay.thickColor, "#445566");
  assert.equal(updated.penroseOverlay.edgeColor, "#edd400");
});
