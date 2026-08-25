import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cartesianToLattice,
  circleHandlePoint,
  circularPathGeometry,
  createEmptyDesign,
  elementMaterialColor,
  getDesignLayers,
  insertCircularPathTemplate,
  latticeToCartesian,
  nearestBoundaryPoint,
  snapCircleHandle,
  snapLatticePoint,
  validateDesign,
} from "../features/studio/einsteinGeometry.js";
import { getEinsteinStudioPatterns, getPublicStudioDesigns, getSpectreStudioPatterns } from "../features/studio/patternLibrary.js";
import { SPECTRE_POINTS, spectreEdgeControl, spectrePath } from "../features/studio/spectreGeometry.js";
import { cartesianGridLines, geometryAdapterFor } from "../features/studio/studioGeometryAdapters.js";

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

test("Einstein studio endpoints bind to numbered tile edges", () => {
  const port = nearestBoundaryPoint({ u: -0.1, v: 1.2 });
  assert.ok(port.edge >= 0 && port.edge < 13);
  assert.ok(port.t >= 0 && port.t <= 1);
  assert.ok(port.distance >= 0);
});

test("Studio can start with an empty editable document", () => {
  const design = createEmptyDesign();
  assert.equal(design.schema, "aperiodos.material-design");
  assert.deepEqual(getDesignLayers(design), []);
  assert.deepEqual(design.paths, []);
  assert.deepEqual(design.circles, []);
  assert.deepEqual(design.circularPaths, []);
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
});

test("GreenCurves public preset loads from its pattern asset", async () => {
  const json = JSON.parse(await readFile(new URL("../../public/patterns/einstein/greencurves.json", import.meta.url), "utf8"));
  const [design] = await getPublicStudioDesigns(async () => ({ ok: true, json: async () => json }));
  assert.equal(design.id, "builtin-green-curves");
  assert.deepEqual(design.circularPaths.map((path) => path.width), [0.7, 1.3]);
});

test("Studio elements can override the document color", () => {
  const design = createDesignWithCircularPath();
  const element = design.circularPaths[0];
  assert.equal(elementMaterialColor(design, element), design.colors.ink);

  element.color = "#123456";
  assert.equal(validateDesign(design).circularPaths[0].color, "#123456");
  assert.equal(elementMaterialColor(design, element), "#123456");
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
