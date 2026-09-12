import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { disintegrateStudioPattern, integrateStudioPattern, studioPatternSlug } from "./studioPatterns.js";

function lineDesign(overrides = {}) {
  return {
    schema: "aperiodos.material-design",
    version: 1,
    id: "local-design",
    name: "My Pattern",
    tile: "spectre",
    colors: { base: "#ffffff", ink: "#000000" },
    outline: "#17313b",
    strokeWidth: 1,
    paths: [],
    lines: [{ id: "line-1", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 1 }] }],
    circles: [],
    circularPaths: [],
    layerOrder: [{ kind: "line", id: "line-1" }],
    ...overrides,
  };
}

test("Studio pattern slugs are safe and stable", () => {
  assert.equal(studioPatternSlug("  Héxagonalization ++ "), "hexagonalization");
});

test("development integration creates and then updates a registered built-in design", async () => {
  const patternsRoot = await mkdtemp(path.join(os.tmpdir(), "aperiodos-patterns-"));
  try {
    await writeFile(path.join(patternsRoot, "library.json"), "[]\n", "utf8");
    const created = await integrateStudioPattern(lineDesign(), { patternsRoot });
    assert.equal(created.asset, "/patterns/spectre/my-pattern.json");
    assert.equal(created.design.id, "builtin-spectre-my-pattern");
    assert.deepEqual(JSON.parse(await readFile(path.join(patternsRoot, "library.json"), "utf8")), [created.asset]);

    const updated = await integrateStudioPattern(lineDesign({ outline: "#abcdef" }), { patternsRoot });
    assert.equal(updated.design.id, created.design.id);
    assert.equal(updated.design.outline, "#abcdef");
    assert.deepEqual(JSON.parse(await readFile(path.join(patternsRoot, "library.json"), "utf8")), [created.asset]);

    const removed = await disintegrateStudioPattern(created.design.id, { patternsRoot });
    assert.equal(removed.design.id, created.design.id);
    assert.deepEqual(JSON.parse(await readFile(path.join(patternsRoot, "library.json"), "utf8")), []);
    await assert.rejects(
      readFile(path.join(patternsRoot, "spectre", "my-pattern.json"), "utf8"),
      (error) => error.code === "ENOENT",
    );
  } finally {
    await rm(patternsRoot, { recursive: true, force: true });
  }
});
