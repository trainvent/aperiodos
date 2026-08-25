import {
  HAT_CARTESIAN,
  cartesianToLattice,
  latticeToCartesian,
  nearestBoundaryPoint,
  snapLatticePoint,
} from "./einsteinGeometry.js";
import { SPECTRE_POINTS, spectrePath } from "./spectreGeometry.js";

const SPECTRE_CARTESIAN = SPECTRE_POINTS.map(([x, y]) => ({ x, y }));

export function cartesianGridLines(min = -10, max = 10, step = 0.125) {
  const lines = [];
  for (let value = min; value <= max + 1e-9; value += step) {
    const coordinate = Math.round(value / step) * step;
    lines.push([
      cartesianToLattice({ x: coordinate, y: min }),
      cartesianToLattice({ x: coordinate, y: max }),
    ]);
    lines.push([
      cartesianToLattice({ x: min, y: coordinate }),
      cartesianToLattice({ x: max, y: coordinate }),
    ]);
  }
  return lines;
}

function spectrePreviewTransforms() {
  const h = Math.sqrt(3) / 2;
  return [
    [1, 0, 0, 0, 1, 0],
    // The tight three-tile surround from the straight-edge reference. Each
    // neighbor follows four consecutive center edges (twelve altogether).
    [h, -0.5, -0.5 - h, 0.5, h, h - 0.5],
    [0, -1, 2.5 + 3 * h, 1, 0, 0.5 + h],
    [h, 0.5, 1, -0.5, h, -1],
  ];
}

function spectreConstructionLines() {
  const families = new Map();
  SPECTRE_CARTESIAN.forEach((start, index) => {
    const end = SPECTRE_CARTESIAN[(index + 1) % SPECTRE_CARTESIAN.length];
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    if (dx < -1e-6 || (Math.abs(dx) < 1e-6 && dy < 0)) {
      dx *= -1;
      dy *= -1;
    }
    const nx = -dy;
    const ny = dx;
    const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    const offset = nx * start.x + ny * start.y;
    const family = families.get(angle) || { dx, dy, nx, ny, offsets: [] };
    if (!family.offsets.some((candidate) => Math.abs(candidate - offset) < 1e-6)) family.offsets.push(offset);
    families.set(angle, family);
  });

  return [...families.values()].flatMap(({ dx, dy, nx, ny, offsets }) => offsets.map((offset) => {
      const center = { x: nx * offset, y: ny * offset };
      return [
        cartesianToLattice({ x: center.x - dx * 12, y: center.y - dy * 12 }),
        cartesianToLattice({ x: center.x + dx * 12, y: center.y + dy * 12 }),
      ];
  }));
}

function snapToSpectreConstruction(point, step) {
  if (!step) return point;
  const target = latticeToCartesian(point);
  let nearest = null;
  SPECTRE_CARTESIAN.forEach((start, index) => {
    const end = SPECTRE_CARTESIAN[(index + 1) % SPECTRE_CARTESIAN.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const along = (target.x - start.x) * ux + (target.y - start.y) * uy;
    const snappedAlong = Math.round(along / step) * step;
    const candidate = { x: start.x + ux * snappedAlong, y: start.y + uy * snappedAlong };
    const distance = Math.hypot(candidate.x - target.x, candidate.y - target.y);
    if (!nearest || distance < nearest.distance) nearest = { ...candidate, distance };
  });
  return cartesianToLattice(nearest);
}

function nearestPolygonBoundary(point, cartesianPoints) {
  const target = latticeToCartesian(point);
  let nearest = null;
  cartesianPoints.forEach((start, edge) => {
    const end = cartesianPoints[(edge + 1) % cartesianPoints.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const rawT = lengthSquared ? ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected = { x: start.x + dx * t, y: start.y + dy * t };
    const distance = Math.hypot(projected.x - target.x, projected.y - target.y);
    if (!nearest || distance < nearest.distance) nearest = { point: cartesianToLattice(projected), edge, t, distance };
  });
  return nearest;
}

const GEOMETRY_ADAPTERS = {
  einstein: {
    family: "einstein",
    tile: "einstein-hat",
    label: "Einstein",
    points: HAT_CARTESIAN,
    nearestBoundary: nearestBoundaryPoint,
    snapPoint: snapLatticePoint,
    cartesianGridLines: cartesianGridLines(),
    outlineD: null,
  },
  spectre: {
    family: "spectre",
    tile: "spectre",
    label: "Spectre",
    points: SPECTRE_CARTESIAN,
    centerCanvas: true,
    nearestBoundary: (point) => nearestPolygonBoundary(point, SPECTRE_CARTESIAN),
    snapPoint: snapToSpectreConstruction,
    gridLines: spectreConstructionLines(),
    cartesianGridLines: cartesianGridLines(),
    previewTransforms: spectrePreviewTransforms(),
    previewReflectX: true,
    previewRotation: 150,
    previewStroke: "#050806",
    outlineD: (design, mapper) => spectrePath(
      SPECTRE_POINTS,
      design.tileShape?.roundness ?? 0.18,
      design.tileShape?.lean ?? 1,
      design.tileShape?.weight ?? 0.5,
      ([x, y]) => mapper(cartesianToLattice({ x, y })),
    ),
  },
};

export function geometryAdapterFor(family) {
  return GEOMETRY_ADAPTERS[family] || GEOMETRY_ADAPTERS.einstein;
}
