import assert from "node:assert/strict";
import test from "node:test";

import {
  cartesianToLattice,
  circleHandlePoint,
  circularPathGeometry,
  createDefaultDesign,
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

test("built-in Studio design uses the versioned library format", () => {
  const design = validateDesign(createDefaultDesign());
  assert.equal(design.schema, "aperiodos.material-design");
  assert.equal(design.tile, "einstein-hat");
  assert.equal(design.paths.length, 0);
  assert.deepEqual(design.circles, []);
  assert.equal(design.circularPaths.length, 1);
  assert.deepEqual(design.circularPaths[0].points, [{ u: 4, v: -2 }, { u: 0, v: 0 }, { u: -2, v: 4 }]);
  assert.equal(design.circularPaths[0].width, 1.3);
  assert.equal(design.circularPaths[0].side, "left");
  assert.deepEqual(design.layerOrder, [{ kind: "circularPath", id: "reference-circular-path" }]);
});

test("Studio can start with an empty editable document", () => {
  const design = createEmptyDesign();
  assert.equal(design.schema, "aperiodos.material-design");
  assert.deepEqual(getDesignLayers(design), []);
  assert.deepEqual(design.paths, []);
  assert.deepEqual(design.circles, []);
  assert.deepEqual(design.circularPaths, []);
});

test("Studio elements can override the document color", () => {
  const design = createDefaultDesign();
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
  const design = createDefaultDesign();
  design.circles = [{ id: "disc", name: "Disc", center: { u: 0, v: 0 }, radius: 1, operation: "ink" }];
  delete design.layerOrder;
  const legacy = validateDesign(design);
  assert.deepEqual(getDesignLayers(legacy).map(({ kind }) => kind), ["circle", "circularPath"]);

  legacy.layerOrder = [
    { kind: "circularPath", id: "reference-circular-path" },
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
  const design = createDefaultDesign();
  design.paths = [];
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
  const design = createDefaultDesign();
  design.paths = [];
  design.circularPaths = [{
    id: "arc-chain",
    name: "Arc chain",
    width: 0.6,
    side: "left",
    points: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }],
  }];
  assert.equal(validateDesign(design).circularPaths[0].points.length, 3);
});
