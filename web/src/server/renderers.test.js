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

test("Einstein rejects malformed Studio pattern documents before rendering", async () => {
  await assert.rejects(
    renderEinstein({ material_mode: "pattern", studio_pattern: { schema: "something-else" } }),
    /must be a version 1 Einstein material design/,
  );
});

test("Einstein rejects Studio documents with invalid geometry before rendering", async () => {
  await assert.rejects(
    renderEinstein({
      material_mode: "pattern",
      studio_pattern: {
        schema: "aperiodos.material-design",
        version: 1,
        tile: "einstein-hat",
        paths: [{ id: "broken", width: 1, points: [{ u: 0, v: 0 }] }],
      },
    }),
    /invalid Bézier path/,
  );
});

test("Einstein accepts straight-line Studio material", async () => {
  const result = renderEinstein({
    width: 128,
    height: 128,
    iterations: 1,
    material_mode: "pattern",
    studio_pattern: {
      schema: "aperiodos.material-design",
      version: 1,
      tile: "einstein-hat",
      paths: [],
      lines: [{ id: "line", width: 0.7, points: [{ u: 0, v: 0 }, { u: 1, v: 1 }] }],
      layerOrder: [{ kind: "line", id: "line" }],
    },
  });
  await assert.doesNotReject(result);
});
