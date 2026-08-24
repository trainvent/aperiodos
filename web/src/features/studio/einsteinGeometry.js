export const SQRT3_OVER_2 = Math.sqrt(3) / 2;

export const HAT_LATTICE = [
  { u: 0, v: 0 },
  { u: -1, v: -1 },
  { u: 0, v: -2 },
  { u: 2, v: -2 },
  { u: 2, v: -1 },
  { u: 4, v: -2 },
  { u: 5, v: -1 },
  { u: 4, v: 0 },
  { u: 3, v: 0 },
  { u: 2, v: 2 },
  { u: 0, v: 3 },
  { u: 0, v: 2 },
  { u: -1, v: 2 },
];

export function latticeToCartesian(point) {
  return {
    x: point.u + point.v / 2,
    y: point.v * SQRT3_OVER_2,
  };
}

export function cartesianToLattice(point) {
  const v = point.y / SQRT3_OVER_2;
  return {
    u: point.x - v / 2,
    v,
  };
}

export const HAT_CARTESIAN = HAT_LATTICE.map(latticeToCartesian);

export function snapLatticePoint(point, step) {
  if (!step) return point;
  return {
    u: Math.round(point.u / step) * step,
    v: Math.round(point.v / step) * step,
  };
}

export function snapCircleHandle(centerPoint, handlePoint, latticeStep = 0, angleStep = 30) {
  const center = latticeToCartesian(centerPoint);
  const handle = latticeToCartesian(handlePoint);
  const dx = handle.x - center.x;
  const dy = handle.y - center.y;
  const rawRadius = Math.hypot(dx, dy);
  const rawAngle = Math.atan2(dy, dx) * 180 / Math.PI;
  const snappedAngle = angleStep ? Math.round(rawAngle / angleStep) * angleStep : rawAngle;
  const handleAngle = ((snappedAngle % 360) + 360) % 360;
  let radius = rawRadius;

  if (latticeStep) {
    const radians = handleAngle * Math.PI / 180;
    const direction = cartesianToLattice({ x: Math.cos(radians), y: Math.sin(radians) });
    const families = [
      [centerPoint.u, direction.u],
      [centerPoint.v, direction.v],
      [centerPoint.u + centerPoint.v, direction.u + direction.v],
    ];
    const candidates = [];

    families.forEach(([centerCoordinate, directionCoordinate]) => {
      if (Math.abs(directionCoordinate) < 1e-10) return;
      const rawCoordinate = centerCoordinate + rawRadius * directionCoordinate;
      const nearestLine = Math.round(rawCoordinate / latticeStep);
      for (let offset = -2; offset <= 2; offset += 1) {
        const lineCoordinate = (nearestLine + offset) * latticeStep;
        const candidate = (lineCoordinate - centerCoordinate) / directionCoordinate;
        if (candidate >= 0.125) candidates.push(candidate);
      }
    });

    if (candidates.length) {
      radius = candidates.reduce((nearest, candidate) => (
        Math.abs(candidate - rawRadius) < Math.abs(nearest - rawRadius) ? candidate : nearest
      ));
    }
  }

  return { radius: Math.max(0.125, radius), handleAngle };
}

export function circleHandlePoint(circle) {
  const center = latticeToCartesian(circle.center);
  const angle = (circle.handleAngle ?? 0) * Math.PI / 180;
  return cartesianToLattice({
    x: center.x + circle.radius * Math.cos(angle),
    y: center.y + circle.radius * Math.sin(angle),
  });
}

function directedAngleDelta(start, end, direction) {
  const fullTurn = Math.PI * 2;
  if (direction > 0) return ((end - start) % fullTurn + fullTurn) % fullTurn;
  return -(((start - end) % fullTurn + fullTurn) % fullTurn);
}

export function circularPathGeometry(path, stepsPerTurn = 72) {
  const [point1, point2, point3] = path.points.map(latticeToCartesian);
  const vector12 = { x: point2.x - point1.x, y: point2.y - point1.y };
  const vector23 = { x: point3.x - point2.x, y: point3.y - point2.y };
  const distance12 = Math.hypot(vector12.x, vector12.y);
  const distance23 = Math.hypot(vector23.x, vector23.y);

  if (distance12 < 1e-9 || distance23 < 1e-9) {
    return { points: [], radius: 0, distance12, distance23, mismatch: true };
  }

  const radius = distance12 / 2;
  const angle12 = Math.atan2(vector12.y, vector12.x);
  const angle23 = Math.atan2(vector23.y, vector23.x);
  const direction = path.side === "right" ? -1 : 1;
  const firstStart = angle12 + Math.PI;
  const firstDelta = direction * Math.PI;
  const secondStart = angle12 + Math.PI;
  const secondDelta = directedAngleDelta(secondStart, angle23, -direction);
  const thirdStart = angle23 + Math.PI;
  const thirdDelta = direction * Math.PI;
  const firstAndSecond = [];
  const third = [];

  function appendArc(target, center, start, delta, includeStart) {
    const steps = Math.max(2, Math.ceil(Math.abs(delta) / (Math.PI * 2) * stepsPerTurn));
    for (let index = includeStart ? 0 : 1; index <= steps; index += 1) {
      const angle = start + delta * index / steps;
      target.push(cartesianToLattice({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      }));
    }
  }

  appendArc(firstAndSecond, point1, firstStart, firstDelta, true);
  appendArc(firstAndSecond, point2, secondStart, secondDelta, false);
  appendArc(third, point3, thirdStart, thirdDelta, true);

  return {
    points: [...firstAndSecond, ...third],
    segments: [firstAndSecond, third],
    radius,
    distance12,
    distance23,
    mismatch: Math.abs(distance12 - distance23) > 1e-4,
  };
}

export function nearestBoundaryPoint(point) {
  const target = latticeToCartesian(point);
  let nearest = null;

  HAT_CARTESIAN.forEach((start, edge) => {
    const end = HAT_CARTESIAN[(edge + 1) % HAT_CARTESIAN.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const rawT = lengthSquared ? ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const projected = { x: start.x + dx * t, y: start.y + dy * t };
    const distance = Math.hypot(projected.x - target.x, projected.y - target.y);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        point: cartesianToLattice(projected),
        edge,
        t,
        distance,
      };
    }
  });

  return nearest;
}

export function bindPathEndpoints(path) {
  const points = path.points.map((point) => ({ ...point }));
  if (!points.length) return { ...path, points };
  points[0] = nearestBoundaryPoint(points[0]).point;
  points[points.length - 1] = nearestBoundaryPoint(points[points.length - 1]).point;
  return { ...path, points };
}

export function createEmptyDesign() {
  return {
    schema: "aperiodos.material-design",
    version: 1,
    id: "builtin-empty-einstein-pattern",
    name: "Untitled Einstein pattern",
    tile: "einstein-hat",
    colors: { base: "#ffffff", ink: "#00c200" },
    paths: [],
    circles: [],
    circularPaths: [],
    layerOrder: [],
  };
}

export function insertCircularPathTemplate(design, { id, name } = {}) {
  if (!id || getDesignLayers(design).some((layer) => layer.id === id)) {
    throw new Error("A template element needs a unique identifier.");
  }
  const template = cloneDesign(createDefaultDesign().circularPaths[0]);
  const circularPath = { ...template, id, name: name || template.name };
  return {
    ...design,
    circularPaths: [...(design.circularPaths || []), circularPath],
    layerOrder: [...normalizeLayerOrder(design), { kind: "circularPath", id }],
  };
}

export function normalizeLayerOrder(design) {
  const collections = {
    path: design.paths || [],
    circle: design.circles || [],
    circularPath: design.circularPaths || [],
  };
  const available = new Set(Object.entries(collections).flatMap(([kind, items]) => items.map((item) => `${kind}:${item.id}`)));
  const seen = new Set();
  const order = [];
  (Array.isArray(design.layerOrder) ? design.layerOrder : []).forEach((entry) => {
    const key = `${entry?.kind}:${entry?.id}`;
    if (available.has(key) && !seen.has(key)) {
      order.push({ kind: entry.kind, id: entry.id });
      seen.add(key);
    }
  });
  ["path", "circle", "circularPath"].forEach((kind) => {
    collections[kind].forEach((item) => {
      const key = `${kind}:${item.id}`;
      if (!seen.has(key)) order.push({ kind, id: item.id });
    });
  });
  return order;
}

export function getDesignLayers(design) {
  const collections = {
    path: new Map((design.paths || []).map((item) => [item.id, item])),
    circle: new Map((design.circles || []).map((item) => [item.id, item])),
    circularPath: new Map((design.circularPaths || []).map((item) => [item.id, item])),
  };
  return normalizeLayerOrder(design).map((entry) => ({ ...entry, item: collections[entry.kind].get(entry.id) }));
}

export function elementMaterialColor(design, element) {
  return typeof element?.color === "string" && element.color.trim() ? element.color : design.colors.ink;
}

export function validateDesign(value) {
  if (!value || value.schema !== "aperiodos.material-design" || value.version !== 1) {
    throw new Error("This is not a supported Aperiodos material design.");
  }
  const circles = Array.isArray(value.circles) ? value.circles : [];
  const circularPaths = Array.isArray(value.circularPaths) ? value.circularPaths : [];
  if (value.tile !== "einstein-hat" || !Array.isArray(value.paths) || (!value.paths.length && !circles.length && !circularPaths.length)) {
    throw new Error("The design must contain Einstein tile material geometry.");
  }
  value.paths.forEach((path) => {
    if (!Array.isArray(path.points) || path.points.length < 4 || (path.points.length - 1) % 3 !== 0) {
      throw new Error("Every path must contain complete cubic Bézier segments.");
    }
    if (!Number.isFinite(Number(path.width)) || Number(path.width) <= 0) {
      throw new Error("Every path needs a positive width.");
    }
    path.points.forEach((point) => {
      if (!Number.isFinite(Number(point.u)) || !Number.isFinite(Number(point.v))) {
        throw new Error("Path points must use finite lattice coordinates.");
      }
    });
    if (path.color !== undefined && (typeof path.color !== "string" || !path.color.trim())) {
      throw new Error("Path colors must be non-empty color values.");
    }
  });
  circles.forEach((circle) => {
    if (!circle.center || !Number.isFinite(Number(circle.center.u)) || !Number.isFinite(Number(circle.center.v))) {
      throw new Error("Circle centers must use finite lattice coordinates.");
    }
    if (!Number.isFinite(Number(circle.radius)) || Number(circle.radius) <= 0) {
      throw new Error("Every circle needs a positive radius.");
    }
    if (!['ink', 'base'].includes(circle.operation)) {
      throw new Error("Circle operations must use the curve or tile color.");
    }
    if (circle.handleAngle !== undefined && !Number.isFinite(Number(circle.handleAngle))) {
      throw new Error("Circle handle angles must be finite degrees.");
    }
    if (circle.color !== undefined && (typeof circle.color !== "string" || !circle.color.trim())) {
      throw new Error("Circle colors must be non-empty color values.");
    }
  });
  circularPaths.forEach((path) => {
    if (!Array.isArray(path.points) || path.points.length !== 3) {
      throw new Error("Every circular path must contain exactly three ordered points.");
    }
    if (!Number.isFinite(Number(path.width)) || Number(path.width) <= 0) {
      throw new Error("Every circular path needs a positive width.");
    }
    if (!['left', 'right'].includes(path.side)) {
      throw new Error("Circular paths must use the left or right arc side.");
    }
    path.points.forEach((point) => {
      if (!Number.isFinite(Number(point.u)) || !Number.isFinite(Number(point.v))) {
        throw new Error("Circular path points must use finite lattice coordinates.");
      }
    });
    if (path.color !== undefined && (typeof path.color !== "string" || !path.color.trim())) {
      throw new Error("Circular path colors must be non-empty color values.");
    }
  });
  if (!Array.isArray(value.circles)) value.circles = circles;
  if (!Array.isArray(value.circularPaths)) value.circularPaths = circularPaths;
  value.layerOrder = normalizeLayerOrder(value);
  return value;
}

export function cloneDesign(design) {
  return JSON.parse(JSON.stringify(design));
}
