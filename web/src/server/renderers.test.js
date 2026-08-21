import assert from "node:assert/strict";
import test from "node:test";

import { renderEinstein } from "./renderers.js";

test("Einstein rejects unknown material modes before rendering", async () => {
  await assert.rejects(
    renderEinstein({ material_mode: "fabric" }),
    /'material_mode' must be one of: solid, pattern/,
  );
});

test("Einstein rejects unknown pattern styles before rendering", async () => {
  await assert.rejects(
    renderEinstein({ material_mode: "pattern", pattern_style: "stripes" }),
    /'pattern_style' must be one of: curves/,
  );
});
