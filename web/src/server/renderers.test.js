import assert from "node:assert/strict";
import test from "node:test";

import { renderEinstein, renderSpectre } from "./renderers.js";

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

test("Spectre repeats a Studio material design inside every generated tile", async () => {
  const result = await renderSpectre({
    width: 128,
    height: 128,
    iterations: 1,
    scale: 40,
    shape: "straight",
    material_mode: "pattern",
    studio_pattern: {
      schema: "aperiodos.material-design",
      version: 1,
      tile: "spectre",
      colors: { base: "#ffffff", ink: "#000000" },
      paths: [],
      lines: [{ id: "line", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }],
      circles: [],
      circularPaths: [],
      layerOrder: [{ kind: "line", id: "line" }],
    },
  });
  const svg = result.buffer.toString("utf8");
  assert.match(svg, /studio-spectre-tile-0/);
  assert.match(svg, /<path d="M [^"]+" fill="none" stroke="#000000"/);
});

test("Spectre render settings can override a Studio pattern's outline width", async () => {
  const result = await renderSpectre({
    width: 128,
    height: 128,
    iterations: 1,
    scale: 40,
    shape: "straight",
    material_mode: "pattern",
    stroke_width: 0,
    studio_pattern: {
      schema: "aperiodos.material-design",
      version: 1,
      tile: "spectre",
      strokeWidth: 7,
      colors: { base: "#ffffff", ink: "#000000" },
      paths: [],
      lines: [{ id: "line", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }],
      circles: [],
      circularPaths: [],
    },
  });
  const svg = result.buffer.toString("utf8");
  assert.match(svg, /stroke-width="0"/);
  assert.doesNotMatch(svg, /stroke-width="7"/);
});

test("Spectre rejects an Einstein Studio design", async () => {
  await assert.rejects(
    renderSpectre({ material_mode: "pattern", studio_pattern: { schema: "aperiodos.material-design", version: 1, tile: "einstein-hat" } }),
    /must be a version 1 Spectre material design/,
  );
});

test("Spectre Simple coloring does not fall back to the default palette", async () => {
  const result = await renderSpectre({
    width: 128,
    height: 128,
    iterations: 1,
    scale: 40,
    color_mode: "simple",
    simple_color: "#123456",
  });
  const svg = result.buffer.toString("utf8");
  assert.match(svg, /fill="#123456"/);
  assert.doesNotMatch(svg, /fill="#b4552d"|fill="#d8b24c"|fill="#17313b"/);
});
