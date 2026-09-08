import { cartesianToLattice } from "./einsteinGeometry.js";
import { spectrePath } from "./spectreGeometry.js";
import { studioCall } from "./studioRuntime.js";

export const CARTESIAN_GRID_STEP = 0.125;

export function cartesianGridLines(min = -10, max = 10, step = CARTESIAN_GRID_STEP) {
  return studioCall("cartesianGridLines", { min, max, step });
}

export function snapCartesianPoint(point, step = CARTESIAN_GRID_STEP) {
  return studioCall("snapCartesianPoint", { point, step });
}

function applyTransform(transform, point) {
  const [a, b, x, c, d, y] = transform;
  return { x: a * point.x + b * point.y + x, y: c * point.x + d * point.y + y };
}

function hydrateGeometry(raw) {
  const geometry = { ...raw };
  geometry.nearestBoundary = (point) => studioCall("nearestBoundary", {
    family: geometry.family,
    point,
  });
  if (geometry.family === "einstein") {
    geometry.snapPoint = (point, step) => studioCall("snapLatticePoint", { point, step });
  } else if (geometry.family === "spectre") {
    geometry.snapPoint = (point, step) => studioCall("snapSpectreConstruction", { point, step });
    geometry.outlineD = (design, mapper) => spectrePath(
      geometry.points.map(({ x, y }) => [x, y]),
      design.tileShape?.roundness ?? 0.18,
      design.tileShape?.lean ?? 1,
      design.tileShape?.weight ?? 0.5,
      ([x, y]) => mapper(cartesianToLattice({ x, y })),
    );
  } else {
    geometry.snapPoint = snapCartesianPoint;
  }
  return geometry;
}

export function penroseTileEditorGeometry(geometry, tileType) {
  if (geometry.tile !== "penrose") return geometry;
  const raw = studioCall("penroseEditorGeometry", { family: geometry.family, tileType });
  const hydrated = hydrateGeometry(raw);
  hydrated.materialToShape = (point) => applyTransform(raw.materialTransform, point);
  hydrated.shapeToMaterial = (point) => applyTransform(raw.shapeTransform, point);
  hydrated.nearestBoundary = (point) => studioCall("penroseNearestBoundary", {
    family: geometry.family,
    tileType: raw.activeTileType,
    point,
  });
  hydrated.snapCartesianPoint = (point, step) => studioCall("snapPenroseCartesian", {
    family: geometry.family,
    tileType: raw.activeTileType,
    point,
    step,
  });
  return hydrated;
}

export function geometryAdapterFor(family) {
  const supported = ["einstein", "spectre", "penrose-kite-dart", "penrose-rhombs", "penrose-p1"];
  return hydrateGeometry(studioCall("geometryAdapter", {
    family: supported.includes(family) ? family : "einstein",
  }));
}
