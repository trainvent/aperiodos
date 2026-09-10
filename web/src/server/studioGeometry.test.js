import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import initWasm, * as studioWasm from "../../public/wasm/aperiodos_render.js";
import { installStudioRuntime, studioCall } from "../features/studio/studioRuntime.js";

import {
  affineLengthScale,
  cartesianToLattice,
  circleHandlePoint,
  circleThroughVertex,
  circularPathGeometry,
  createEmptyDesign,
  elementMaterialColor,
  getDesignLayers,
  insertCircularPathTemplate,
  insertHexagonalizationTemplate,
  latticeToCartesian,
  nearestBoundaryPoint,
  snapCircleHandle,
  snapLatticePoint,
  setDefaultMaterialColor,
  validateDesign,
} from "../features/studio/einsteinGeometry.js";
import { getEinsteinStudioPatterns, getPenroseStudioPatterns, getPublicStudioDesigns, getSpectreStudioPatterns, readStudioLibrary, writeStudioLibrary } from "../features/studio/patternLibrary.js";
import { spectreEdgeControl, spectrePath } from "../features/studio/spectreGeometry.js";
import { cartesianGridLines, geometryAdapterFor, penroseTileEditorGeometry, snapCartesianPoint } from "../features/studio/studioGeometryAdapters.js";
import { transformedMaterialScale } from "../features/studio/previewGeometry.js";

await initWasm(await readFile(new URL("../../public/wasm/aperiodos_render_bg.wasm", import.meta.url)));
installStudioRuntime(studioWasm);

const HAT_CARTESIAN = geometryAdapterFor("einstein").points;
const SPECTRE_POINTS = geometryAdapterFor("spectre").points.map(({ x, y }) => [x, y]);

function createDesignWithCircularPath() {
  const design = createEmptyDesign();
  design.circularPaths = [{
    id: "test-circular-path",
    name: "Test circular path",
    width: 1.3,
    side: "left",
    points: [{ u: 4, v: -2 }, { u: 0, v: 0 }, { u: -2, v: 4 }],
  }];
  design.layerOrder = [{ kind: "circularPath", id: "test-circular-path" }];
  return design;
}

test("Einstein studio lattice coordinates round-trip", () => {
  const lattice = { u: 1.25, v: -0.75 };
  const result = cartesianToLattice(latticeToCartesian(lattice));
  assert.ok(Math.abs(result.u - lattice.u) < 1e-10);
  assert.ok(Math.abs(result.v - lattice.v) < 1e-10);
});

test("WASM family descriptors match the established Einstein and Spectre coordinate goldens", () => {
  assert.deepEqual(geometryAdapterFor("einstein").points, HAT_CARTESIAN);
  assert.deepEqual(
    geometryAdapterFor("spectre").points.map(({ x, y }) => [x, y]),
    SPECTRE_POINTS,
  );
});

test("Editor material sizes retain their proportions in every transformed preview tile", () => {
  const fitScale = 137;
  const circleRadius = 0.625;
  const pathWidth = 0.08;
  for (const family of ["einstein", "spectre"]) {
    for (const transform of geometryAdapterFor(family).previewTransforms) {
      const tileScale = affineLengthScale(transform);
      const materialScale = transformedMaterialScale(fitScale, transform);
      assert.ok(Math.abs(materialScale - fitScale * tileScale) < 1e-10);
      assert.ok(Math.abs(circleRadius * materialScale - circleRadius * fitScale * tileScale) < 1e-10);
      assert.ok(Math.abs(pathWidth * materialScale - pathWidth * fitScale * tileScale) < 1e-10);
    }
  }
});

test("Einstein studio endpoints bind to numbered tile edges", () => {
  const port = nearestBoundaryPoint({ u: -0.1, v: 1.2 });
  assert.ok(port.edge >= 0 && port.edge < 13);
  assert.ok(port.t >= 0 && port.t <= 1);
  assert.ok(port.distance >= 0);
});

test("Circle radius handles snap exactly to native tile corners", () => {
  for (const family of ["einstein", "spectre", "penrose-kite-dart", "penrose-rhombs", "penrose-p1"]) {
    const familyGeometry = geometryAdapterFor(family);
    const geometry = familyGeometry.tile === "penrose"
      ? penroseTileEditorGeometry(familyGeometry, familyGeometry.editorShapes[0].tileType)
      : familyGeometry;
    assert.ok(geometry.materialVertices.length > 0);
    const center = geometry.defaultElements?.circleCenter || { u: 1, v: 1 };
    for (const vertex of geometry.materialVertices) {
      const snapped = circleThroughVertex(geometry.family, geometry.activeTileType, center, vertex);
      assert.ok(snapped.radius >= 0.125);
      assert.ok(snapped.handleAngle >= 0 && snapped.handleAngle < 360);
    }
  }
});

test("Cartesian snapping units represent visible grid blocks", () => {
  for (const family of ["einstein", "spectre", "penrose-kite-dart", "penrose-rhombs", "penrose-p1"]) {
    const familyGeometry = geometryAdapterFor(family);
    const geometry = familyGeometry.tile === "penrose"
      ? penroseTileEditorGeometry(familyGeometry, familyGeometry.editorShapes[0].tileType)
      : familyGeometry;
    assert.equal(geometry.cartesianGridStep, 0.125);
    assert.ok(geometry.cartesianRadiusStep > 0);
  }
});

test("Studio can start with an empty editable document", () => {
  const design = createEmptyDesign();
  assert.equal(design.schema, "aperiodos.material-design");
  assert.deepEqual(getDesignLayers(design), []);
  assert.deepEqual(design.paths, []);
  assert.deepEqual(design.lines, []);
  assert.deepEqual(design.circles, []);
  assert.deepEqual(design.circularPaths, []);
});

test("Studio SVG exports are generated by the shared native material engine", () => {
  for (const [tile, tileMode, tileType] of [
    ["einstein-hat", undefined, undefined],
    ["spectre", undefined, undefined],
    ["penrose", "p1", "star"],
  ]) {
    const design = createEmptyDesign(tile);
    if (tileMode) design.tileMode = tileMode;
    design.lines = [{ id: "line", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }];
    const svg = studioCall("exportSvg", { design, tileType });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /<clipPath id="tile">/);
    assert.match(svg, /<path d="M /);
  }
});

test("Studio validates straight lines as first-class material layers", () => {
  const design = createEmptyDesign();
  design.lines = [{
    id: "straight-line",
    name: "Line 1",
    width: 0.7,
    color: "#123456",
    points: [{ u: 0, v: 0 }, { u: 2, v: 1 }],
  }];
  design.layerOrder = [{ kind: "line", id: "straight-line" }];
  const validated = validateDesign(design);
  assert.equal(validated.lines[0].points.length, 2);
  assert.equal(getDesignLayers(validated)[0].kind, "line");
  assert.equal(getDesignLayers(validated)[0].item.color, "#123456");
});

test("Spectre uses the shared material document with persistent curvature", () => {
  const design = createEmptyDesign("spectre");
  design.paths = [{
    id: "spectre-curve",
    name: "Curve 1",
    width: 0.7,
    points: [{ u: 0, v: 0 }, { u: 0.5, v: 0 }, { u: 1, v: 0 }, { u: 1.5, v: 0 }],
  }];
  const validated = validateDesign(design);
  assert.equal(validated.tile, "spectre");
  assert.deepEqual(validated.tileShape, { roundness: 0.18, weight: 0.5, lean: 1 });
});

test("Spectre outline supports the shared editor coordinate mapper", () => {
  const path = spectrePath(SPECTRE_POINTS, 0.2, 1, 0.5, ([x, y]) => ({ x: x * 10, y: y * 10 }));
  assert.match(path, /^M 0\.0000 0\.0000 Q /);
  assert.match(path, /10\.0000 0\.0000/);
  assert.match(path, / Z$/);
});

test("Spectre adapter exposes an edge-aligned construction canvas", () => {
  const adapter = geometryAdapterFor("spectre");
  assert.ok(adapter.gridLines.length >= 12);
  SPECTRE_POINTS.forEach(([x, y], index) => {
    const startVertex = { x, y };
    const [endX, endY] = SPECTRE_POINTS[(index + 1) % SPECTRE_POINTS.length];
    const endVertex = { x: endX, y: endY };
    assert.ok(adapter.gridLines.some(([start, end]) => {
      const a = latticeToCartesian(start);
      const b = latticeToCartesian(end);
      const crossStart = (b.x - a.x) * (startVertex.y - a.y) - (b.y - a.y) * (startVertex.x - a.x);
      const crossEnd = (b.x - a.x) * (endVertex.y - a.y) - (b.y - a.y) * (endVertex.x - a.x);
      return Math.abs(crossStart) < 1e-6 && Math.abs(crossEnd) < 1e-6;
    }));
  });
});

test("Studio Cartesian grid is regular, fine-grained, and anchored at the tile origin", () => {
  const lines = cartesianGridLines(-0.25, 0.25).map(([start, end]) => [latticeToCartesian(start), latticeToCartesian(end)]);
  assert.equal(lines.length, 10);
  assert.ok(lines.some(([start, end]) => start.x === 0 && end.x === 0));
  assert.ok(lines.some(([start, end]) => start.y === 0 && end.y === 0));
  const verticalCoordinates = lines
    .filter(([start, end]) => Math.abs(start.x - end.x) < 1e-9)
    .map(([start]) => Math.round(start.x * 8) / 8);
  assert.deepEqual(verticalCoordinates, [-0.25, -0.125, 0, 0.125, 0.25]);
});

test("Cartesian snapping lands exactly on visible mesh intersections", () => {
  const snapped = latticeToCartesian(snapCartesianPoint(cartesianToLattice({ x: 0.192, y: -0.311 })));
  assert.ok(Math.abs(snapped.x - 0.25) < 1e-9);
  assert.ok(Math.abs(snapped.y + 0.25) < 1e-9);
});

test("Spectre preview uses edge-matched rotations without reflections", () => {
  const adapter = geometryAdapterFor("spectre");
  assert.equal(adapter.previewReflectX, true);
  assert.equal(adapter.previewRotation, 150);
  const central = adapter.points;
  let sharedEdgeCount = 0;
  adapter.previewTransforms.slice(1).forEach(([a, b, x, c, d, y]) => {
    assert.ok(Math.abs(a * d - b * c - 1) < 1e-9);
    const transformed = adapter.points.map((point) => ({
      x: a * point.x + b * point.y + x,
      y: c * point.x + d * point.y + y,
    }));
    const sharedVertices = central.filter((point) => transformed.some((candidate) => (
      Math.hypot(candidate.x - point.x, candidate.y - point.y) < 1e-9
    )));
    assert.equal(sharedVertices.length, 5);
    sharedEdgeCount += central.filter((point, index) => {
      const next = central[(index + 1) % central.length];
      return transformed.some((candidate, candidateIndex) => {
        const candidateNext = transformed[(candidateIndex + 1) % transformed.length];
        const forward = Math.hypot(candidate.x - point.x, candidate.y - point.y) < 1e-9
          && Math.hypot(candidateNext.x - next.x, candidateNext.y - next.y) < 1e-9;
        const reverse = Math.hypot(candidate.x - next.x, candidate.y - next.y) < 1e-9
          && Math.hypot(candidateNext.x - point.x, candidateNext.y - point.y) < 1e-9;
        return forward || reverse;
      });
    }).length;
  });
  assert.equal(sharedEdgeCount, 12);
});

test("Spectre preview neighbors share curved edges at every parabolic weight", () => {
  const adapter = geometryAdapterFor("spectre");
  const close = (left, right) => Math.hypot(left[0] - right[0], left[1] - right[1]) < 1e-9;
  const transformPoint = ([x, y], [a, b, tx, c, d, ty]) => [a * x + b * y + tx, c * x + d * y + ty];
  adapter.previewTransforms.slice(1).forEach((transform) => {
    SPECTRE_POINTS.forEach((start, centralIndex) => {
      const end = SPECTRE_POINTS[(centralIndex + 1) % SPECTRE_POINTS.length];
      SPECTRE_POINTS.forEach((neighborStart, neighborIndex) => {
        const neighborEnd = SPECTRE_POINTS[(neighborIndex + 1) % SPECTRE_POINTS.length];
        if (!close(start, transformPoint(neighborEnd, transform)) || !close(end, transformPoint(neighborStart, transform))) return;
        const centralControl = spectreEdgeControl(start, end, centralIndex, 0.31, 1, 0.68);
        const neighborControl = transformPoint(spectreEdgeControl(neighborStart, neighborEnd, neighborIndex, 0.31, 1, 0.68), transform);
        assert.ok(close(centralControl, neighborControl));
      });
    });
  });
});

test("Studio pattern consumers receive only their geometry family", async () => {
  const spectre = createEmptyDesign("spectre");
  spectre.id = "saved-spectre";
  spectre.paths = [{ id: "curve", width: 1, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 2, v: 0 }, { u: 3, v: 0 }] }];
  const storage = { getItem: () => JSON.stringify([spectre]) };
  const fetcher = async () => ({ ok: false });
  assert.deepEqual(await getEinsteinStudioPatterns(storage, fetcher), []);
  assert.equal((await getSpectreStudioPatterns(storage, fetcher))[0].tile, "spectre");
  assert.deepEqual(await getPenroseStudioPatterns(storage, fetcher), []);
});

test("Studio exposes all Penrose tile combinations", () => {
  for (const [family, tileMode, shapeCount] of [["penrose-kite-dart", "kite-dart", 2], ["penrose-rhombs", "rhombs", 2], ["penrose-p1", "p1", 4]]) {
    const adapter = geometryAdapterFor(family);
    assert.equal(adapter.tile, "penrose");
    assert.equal(adapter.tileMode, tileMode);
    assert.equal(adapter.shapes.length, shapeCount);
    assert.ok(adapter.shapes.every((shape) => shape.points.length >= 4));
  }
});

test("Penrose Studio P3 and P1 shapes retain their native unit edges", () => {
  for (const family of ["penrose-rhombs", "penrose-p1"]) {
    const adapter = geometryAdapterFor(family);
    adapter.shapes.forEach((shape) => {
      shape.points.forEach((point, index) => {
        const next = shape.points[(index + 1) % shape.points.length];
        assert.ok(Math.abs(Math.hypot(next.x - point.x, next.y - point.y) - 1) < 1e-9, `${family} ${shape.name} has a non-unit edge`);
      });
    });
  }

  const [thin, thick] = geometryAdapterFor("penrose-rhombs").shapes;
  assert.ok(Math.max(...thin.points.map((point) => point.x)) < Math.min(...thick.points.map((point) => point.x)));
});

test("Penrose Studio isolates each prototile in the generator's coordinate system", () => {
  for (const family of ["penrose-kite-dart", "penrose-rhombs", "penrose-p1"]) {
    const adapter = geometryAdapterFor(family);
    adapter.editorShapes.forEach((shape) => {
      const editor = penroseTileEditorGeometry(adapter, shape.tileType);
      assert.equal(editor.shapes, null);
      assert.ok(Array.isArray(editor.gridLines));
      assert.ok(editor.gridLines.length > 0);
      const [origin, unit, third] = editor.points;
      const matches = (left, right) => Math.hypot(left.x - right.x, left.y - right.y) < 1e-9;
      assert.ok(matches(editor.shapeToMaterial(origin), { x: 0, y: 0 }));
      assert.ok(matches(editor.shapeToMaterial(unit), { x: 1, y: 0 }));
      assert.ok(matches(editor.shapeToMaterial(third), { x: 0.5, y: Math.sqrt(3) / 2 }));
      assert.ok(matches(editor.materialToShape({ x: 0, y: 0 }), origin));
      assert.ok(matches(editor.materialToShape({ x: 1, y: 0 }), unit));
      assert.ok(Math.abs(editor.materialScale - Math.hypot(unit.x - origin.x, unit.y - origin.y)) < 1e-9);
      assert.equal(editor.defaultElements.pathPoints.length, 4);
      assert.equal(editor.defaultElements.linePoints.length, 2);
      assert.equal(editor.defaultElements.circularPathPoints.length, 3);
      assert.ok(editor.defaultElements.circleRadius >= 0.125);
      assert.ok(matches(
        editor.materialToShape(latticeToCartesian(editor.defaultElements.linePoints[0])),
        editor.points[0],
      ));
      editor.materialVertices.forEach((vertex, index) => {
        assert.ok(matches(editor.materialToShape(latticeToCartesian(vertex)), editor.points[index]));
      });
      if (editor.points.length === 4) {
        const shapeConstructionLines = editor.gridLines.map((line) => line.map((point) => (
          editor.materialToShape(latticeToCartesian(point))
        )));
        if (shape.tileType === "dart") {
          assert.ok(matches(shapeConstructionLines[0][0], editor.points[0]));
          assert.ok(matches(shapeConstructionLines[0][1], editor.points[2]));
          assert.equal(editor.gridLines.length, 3);
          const rhombusCorner = {
            x: editor.points[1].x + editor.points[3].x - editor.points[2].x,
            y: editor.points[1].y + editor.points[3].y - editor.points[2].y,
          };
          assert.ok(matches(shapeConstructionLines[1][0], editor.points[3]));
          assert.ok(matches(shapeConstructionLines[1][1], rhombusCorner));
          assert.ok(matches(shapeConstructionLines[2][0], rhombusCorner));
          assert.ok(matches(shapeConstructionLines[2][1], editor.points[1]));
          const rhombus = [editor.points[1], editor.points[2], editor.points[3], rhombusCorner];
          const sideLengths = rhombus.map((point, index) => {
            const next = rhombus[(index + 1) % rhombus.length];
            return Math.hypot(next.x - point.x, next.y - point.y);
          });
          sideLengths.forEach((length) => assert.ok(Math.abs(length - sideLengths[0]) < 1e-8));
        } else if (shape.tileType === "kite") {
          assert.equal(editor.gridLines.length, 1);
          assert.ok(matches(shapeConstructionLines[0][0], editor.points[1]));
          assert.ok(matches(shapeConstructionLines[0][1], editor.points[3]));
          assert.equal(editor.constructionPoints.length, 2);
          const phi = (1 + Math.sqrt(5)) / 2;
          [1 / (phi * phi), 1 / phi].forEach((amount, index) => {
            const goldenPoint = editor.materialToShape(latticeToCartesian(editor.constructionPoints[index]));
            assert.ok(matches(goldenPoint, {
              x: editor.points[1].x + (editor.points[3].x - editor.points[1].x) * amount,
              y: editor.points[1].y + (editor.points[3].y - editor.points[1].y) * amount,
            }));
          });
        } else {
          assert.equal(editor.gridLines.length, 1);
          assert.ok(matches(shapeConstructionLines[0][0], editor.points[0]));
          assert.ok(matches(shapeConstructionLines[0][1], editor.points[2]));
        }

        const diagonalMidpoint = {
          x: (shapeConstructionLines[0][0].x + shapeConstructionLines[0][1].x) / 2,
          y: (shapeConstructionLines[0][0].y + shapeConstructionLines[0][1].y) / 2,
        };
        const nearMidpoint = editor.shapeToMaterial({
          x: diagonalMidpoint.x + 0.025,
          y: diagonalMidpoint.y - 0.025,
        });
        const snappedMidpoint = editor.materialToShape(latticeToCartesian(
          editor.snapPoint(cartesianToLattice(nearMidpoint), 0.5),
        ));
        assert.ok(matches(snappedMidpoint, diagonalMidpoint), `${family} ${shape.name} does not snap to its golden-triangle diagonal midpoint`);
      }
      editor.cartesianGridLines.forEach(([startPoint, endPoint]) => {
        const gridStart = editor.materialToShape(latticeToCartesian(startPoint));
        const gridEnd = editor.materialToShape(latticeToCartesian(endPoint));
        assert.ok(
          Math.abs(gridStart.x - gridEnd.x) < 1e-8 || Math.abs(gridStart.y - gridEnd.y) < 1e-8,
          `${family} ${shape.name} has a diagonal Cartesian grid line`,
        );
      });

      const gridOrigin = editor.cartesianGridOrigin;
      const expectedGridOrigin = shape.tileType === "kite"
        ? {
            x: (editor.points[0].x + editor.points[2].x) / 2,
            y: (editor.points[1].y + editor.points[3].y) / 2,
          }
        : editor.points[0];
      assert.ok(matches(gridOrigin, expectedGridOrigin));
      const shapeGridLines = editor.cartesianGridLines.map(([startPoint, endPoint]) => [
        editor.materialToShape(latticeToCartesian(startPoint)),
        editor.materialToShape(latticeToCartesian(endPoint)),
      ]);
      assert.ok(shapeGridLines.some(([startPoint, endPoint]) => (
        Math.abs(startPoint.x - gridOrigin.x) < 1e-8
        && Math.abs(endPoint.x - gridOrigin.x) < 1e-8
      )), `${family} ${shape.name} does not anchor a vertical grid line to its grid origin`);
      assert.ok(shapeGridLines.some(([startPoint, endPoint]) => (
        Math.abs(startPoint.y - gridOrigin.y) < 1e-8
        && Math.abs(endPoint.y - gridOrigin.y) < 1e-8
      )), `${family} ${shape.name} does not anchor a horizontal grid line to its grid origin`);

      const nearGridOrigin = editor.shapeToMaterial({
        x: gridOrigin.x + 0.04,
        y: gridOrigin.y - 0.04,
      });
      const snappedGridOrigin = editor.materialToShape(latticeToCartesian(
        editor.snapCartesianPoint(cartesianToLattice(nearGridOrigin), editor.cartesianGridStep),
      ));
      assert.ok(matches(snappedGridOrigin, gridOrigin), `${family} ${shape.name} snaps against a different grid phase`);

      const center = editor.points.reduce((sum, point) => ({ x: sum.x + point.x / editor.points.length, y: sum.y + point.y / editor.points.length }), { x: 0, y: 0 });
      assert.ok(matches(editor.materialToShape(latticeToCartesian(editor.defaultElements.circleCenter)), center));
      const centerMaterial = editor.shapeToMaterial(center);
      const nearest = editor.nearestBoundary(cartesianToLattice(centerMaterial));
      const snappedShape = editor.materialToShape(latticeToCartesian(nearest.point));
      const edgeStart = editor.points[nearest.edge];
      const edgeEnd = editor.points[(nearest.edge + 1) % editor.points.length];
      assert.ok(matches(snappedShape, {
        x: edgeStart.x + (edgeEnd.x - edgeStart.x) * nearest.t,
        y: edgeStart.y + (edgeEnd.y - edgeStart.y) * nearest.t,
      }));
    });
  }
});

test("Penrose Studio designs retain their tile combination and per-tool tile scopes", () => {
  const design = createEmptyDesign("penrose");
  design.tileMode = "p1";
  design.paths = [{ id: "path", tileType: "star", width: 0.2, points: [{ u: 0, v: 0 }, { u: 0.25, v: 0 }, { u: 0.75, v: 0 }, { u: 1, v: 0 }] }];
  design.lines = [{ id: "line", tileType: "pentagon", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }];
  design.circles = [{ id: "circle", tileType: "boat", center: { u: 0, v: 0 }, radius: 0.25, operation: "ink" }];
  design.circularPaths = [{ id: "arc", tileType: "diamond", width: 0.2, side: "left", points: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 2, v: 0 }] }];
  const validated = validateDesign(design);
  assert.equal(validated.tileMode, "p1");
  assert.equal(validated.paths[0].tileType, "star");
  assert.equal(validated.lines[0].tileType, "pentagon");
  assert.equal(validated.circles[0].tileType, "boat");
  assert.equal(validated.circularPaths[0].tileType, "diamond");
});

test("Spectre designs persist in the local Studio library", () => {
  const design = createEmptyDesign("spectre");
  design.id = "saved-spectre";
  design.outline = "#123456";
  design.lines = [{ id: "line", width: 0.2, points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }];
  design.layerOrder = [{ kind: "line", id: "line" }];
  const storage = {
    value: null,
    getItem: () => storage.value,
    setItem: (_key, value) => { storage.value = value; },
  };
  writeStudioLibrary([design], storage);
  const saved = readStudioLibrary(storage)[0];
  assert.equal(saved.tile, "spectre");
  assert.equal(saved.outline, "#123456");
});

test("Public Studio presets load from their pattern assets", async () => {
  const assets = await Promise.all([
    readFile(new URL("../../public/patterns/einstein/greencurves.json", import.meta.url), "utf8"),
    readFile(new URL("../../public/patterns/spectre/hexagonalization.json", import.meta.url), "utf8"),
    readFile(new URL("../../public/patterns/penrose/p2-bicircular.json", import.meta.url), "utf8"),
  ]);
  let index = 0;
  const designs = await getPublicStudioDesigns(async () => ({ ok: true, json: async () => JSON.parse(assets[index++]) }));
  const greenCurves = designs.find((design) => design.id === "builtin-green-curves");
  const hexagonalization = designs.find((design) => design.id === "builtin-spectre-hexagonalization");
  const p2Bicircular = designs.find((design) => design.id === "builtin-penrose-p2-bicircular");
  assert.deepEqual(greenCurves.circularPaths.map((path) => path.width), [0.7, 1.3]);
  assert.equal(greenCurves.outline, "#17313b");
  assert.equal(hexagonalization.tile, "spectre");
  assert.equal(hexagonalization.outline, "#000000");
  assert.equal(hexagonalization.lines.length, 7);
  assert.equal(p2Bicircular.tile, "penrose");
  assert.equal(p2Bicircular.tileMode, "kite-dart");
  assert.deepEqual(p2Bicircular.circles.map((circle) => circle.tileType), ["dart", "dart", "kite", "kite"]);
  assert.deepEqual(p2Bicircular.circles.map((circle) => circle.width), [0.05, 0.025, 0.05, 0.025]);
  assert.deepEqual(p2Bicircular.circles.map((circle) => circle.radius), [
    0.6180339887406862,
    0.38196601127165514,
    0.6180339888005829,
    0.38196601128143226,
  ]);
  assert.ok(p2Bicircular.circles.every((circle) => circle.hollow === true));
});

test("Studio elements can override the document color", () => {
  const design = createDesignWithCircularPath();
  const element = design.circularPaths[0];
  assert.equal(elementMaterialColor(design, element), design.colors.ink);

  element.color = "#123456";
  assert.equal(validateDesign(design).circularPaths[0].color, "#123456");
  assert.equal(elementMaterialColor(design, element), "#123456");
});

test("Changing the default material color preserves existing element colors", () => {
  const design = createDesignWithCircularPath();
  design.lines = [{ id: "line", width: 0.2, color: "#123456", points: [{ u: 0, v: 0 }, { u: 1, v: 0 }] }];
  design.circles = [{ id: "circle", center: { u: 0, v: 0 }, radius: 1, operation: "ink" }];

  const updated = setDefaultMaterialColor(design, "#abcdef");

  assert.equal(updated.colors.ink, "#abcdef");
  assert.equal(updated.circularPaths[0].color, "#00c200");
  assert.equal(updated.circles[0].color, "#00c200");
  assert.equal(updated.lines[0].color, "#123456");
});

test("Studio templates append without replacing existing canvas elements", () => {
  const design = createEmptyDesign();
  design.circles.push({ id: "existing-circle", name: "Existing", center: { u: 0, v: 0 }, radius: 1, operation: "ink", color: "#123456" });
  design.layerOrder.push({ kind: "circle", id: "existing-circle" });

  const result = insertCircularPathTemplate(design, { id: "inserted-template", name: "Inserted template" });
  assert.equal(result.circles[0].id, "existing-circle");
  assert.equal(result.circles[0].color, "#123456");
  assert.equal(result.circularPaths[0].id, "inserted-template");
  assert.deepEqual(result.layerOrder, [
    { kind: "circle", id: "existing-circle" },
    { kind: "circularPath", id: "inserted-template" },
  ]);
});

test("Studio templates are scoped to their geometry family", () => {
  const einstein = createEmptyDesign();
  const spectre = createEmptyDesign("spectre");

  assert.throws(
    () => insertCircularPathTemplate(spectre, { id: "wrong-family" }),
    /needs an Einstein design/,
  );
  assert.throws(
    () => insertHexagonalizationTemplate(einstein, { idPrefix: "wrong-family" }),
    /needs a Spectre design/,
  );

  spectre.circles.push({ id: "existing-circle", name: "Existing", center: { u: 0, v: 0 }, radius: 1, operation: "ink" });
  spectre.layerOrder.push({ kind: "circle", id: "existing-circle" });
  const result = insertHexagonalizationTemplate(spectre, { idPrefix: "hex", name: "Hexagonalization" });
  assert.equal(result.circles[0].id, "existing-circle");
  assert.equal(result.lines.length, 7);
  assert.deepEqual(result.layerOrder.slice(0, 2), [
    { kind: "circle", id: "existing-circle" },
    { kind: "line", id: "hex-1" },
  ]);
});

test("Studio layer order remains backward compatible and controls the draw stack", () => {
  const design = createDesignWithCircularPath();
  design.circles = [{ id: "disc", name: "Disc", center: { u: 0, v: 0 }, radius: 1, operation: "ink" }];
  delete design.layerOrder;
  const legacy = validateDesign(design);
  assert.deepEqual(getDesignLayers(legacy).map(({ kind }) => kind), ["circle", "circularPath"]);

  legacy.layerOrder = [
    { kind: "circularPath", id: "test-circular-path" },
    { kind: "circle", id: "disc" },
  ];
  assert.deepEqual(getDesignLayers(legacy).map(({ kind }) => kind), ["circularPath", "circle"]);
});

test("anchors can snap before binding to a tile edge", () => {
  const snapped = snapLatticePoint({ u: -0.38, v: 1.12 }, 0.25);
  const port = nearestBoundaryPoint(snapped);
  assert.equal(snapped.u, -0.5);
  assert.equal(snapped.v, 1);
  assert.ok(port.distance >= 0);
});

test("Studio accepts circle-only material designs", () => {
  const design = createEmptyDesign();
  design.circles = [{ id: "disc", name: "Disc", center: { u: 0.5, v: 1 }, radius: 1.25, operation: "ink" }];
  assert.equal(validateDesign(design).circles[0].radius, 1.25);
});

test("Studio validates hollow circles with centered stroke widths", () => {
  const design = createEmptyDesign();
  design.circles = [{
    id: "ring",
    name: "Ring",
    center: { u: 0.5, v: 1 },
    radius: 1.25,
    hollow: true,
    width: 0.25,
    operation: "ink",
  }];
  const validated = validateDesign(design);
  assert.equal(validated.circles[0].hollow, true);
  assert.equal(validated.circles[0].width, 0.25);

  design.circles[0].width = 1.5;
  assert.throws(() => validateDesign(design), /stroke widths/);
});

test("circle radius handles snap to 30 degree spokes around their center", () => {
  const center = { u: 0, v: 0 };
  const nearTop = cartesianToLattice({ x: 0.08, y: 2.04 });
  const snapped = snapCircleHandle(center, nearTop, 0.5, 30);
  assert.ok(Math.abs(snapped.radius - 5 * Math.sqrt(3) / 4) < 1e-10);
  assert.equal(snapped.handleAngle, 90);

  const handle = latticeToCartesian(circleHandlePoint({ center, ...snapped }));
  assert.ok(Math.abs(handle.x) < 1e-10);
  assert.ok(Math.abs(handle.y - 5 * Math.sqrt(3) / 4) < 1e-10);
  const latticeHandle = cartesianToLattice(handle);
  assert.equal(latticeHandle.v, 2.5);
});

test("circle handles snap to the nearest line from every lattice family", () => {
  const center = { u: 0.5, v: 0.5 };
  const targetAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  targetAngles.forEach((angle) => {
    const radians = (angle + 2) * Math.PI / 180;
    const pointer = cartesianToLattice({ x: 2.13 * Math.cos(radians), y: 2.13 * Math.sin(radians) });
    const snapped = snapCircleHandle(center, pointer, 0.5, 30);
    const point = circleHandlePoint({ center, ...snapped });
    const onLine = [point.u, point.v, point.u + point.v].some((coordinate) => (
      Math.abs(coordinate / 0.5 - Math.round(coordinate / 0.5)) < 1e-9
    ));
    assert.equal(onLine, true, `expected ${angle}° handle to land on a lattice line`);
  });
});

test("circular paths hand over between equal-radius center arcs", () => {
  const path = {
    points: [
      cartesianToLattice({ x: 0, y: 0 }),
      cartesianToLattice({ x: 2, y: 0 }),
      cartesianToLattice({ x: 2, y: 2 }),
    ],
    side: "left",
  };
  const geometry = circularPathGeometry(path);
  const start = latticeToCartesian(geometry.points[0]);
  const handover = latticeToCartesian(geometry.points[36]);
  const end = latticeToCartesian(geometry.points.at(-1));

  assert.equal(geometry.radius, 1);
  assert.equal(geometry.mismatch, false);
  assert.ok(Math.abs(start.x + 1) < 1e-9 && Math.abs(start.y) < 1e-9);
  assert.ok(Math.abs(handover.x - 1) < 1e-9 && Math.abs(handover.y) < 1e-9);
  assert.ok(Math.abs(end.x - 2) < 1e-9 && Math.abs(end.y - 3) < 1e-9);
});

test("circular paths warn but remain drawable when center spacing differs", () => {
  const geometry = circularPathGeometry({
    points: [
      cartesianToLattice({ x: 0, y: 0 }),
      cartesianToLattice({ x: 2, y: 0 }),
      cartesianToLattice({ x: 2, y: 3 }),
    ],
    side: "left",
  });
  const end = latticeToCartesian(geometry.points.at(-1));
  assert.equal(geometry.mismatch, true);
  assert.ok(Math.abs(end.y - 4) < 1e-9);
  assert.equal(geometry.segments.length, 2);
});

test("Studio accepts circular-path-only material designs", () => {
  const design = createEmptyDesign();
  design.circularPaths = [{
    id: "arc-chain",
    name: "Arc chain",
    width: 0.6,
    side: "left",
    points: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }],
  }];
  assert.equal(validateDesign(design).circularPaths[0].points.length, 3);
});
