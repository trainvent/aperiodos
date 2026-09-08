import { studioCall } from "./studioRuntime.js";

export function spectreEdgeControl(start, end, index, roundness = 0, lean = 1, weight = 0.5) {
  const result = studioCall("spectreEdgeControl", {
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    index,
    roundness,
    lean,
    weight,
  });
  return [result.x, result.y];
}

export function spectrePath(points, roundness = 0, lean = 1, weight = 0.5, mapPoint) {
  const resolvedPoints = points || studioCall("geometryAdapter", { family: "spectre" }).points.map(({ x, y }) => [x, y]);
  const cartesian = resolvedPoints.map(([x, y]) => ({ x, y }));
  if (!mapPoint) {
    return studioCall("spectrePath", { points: cartesian, roundness, lean, weight });
  }
  if (!cartesian.length) return "";
  const segments = studioCall("spectreSegments", { points: cartesian, roundness, lean, weight });
  const first = mapPoint([segments[0].start.x, segments[0].start.y]);
  const commands = [`M ${first.x.toFixed(4)} ${first.y.toFixed(4)}`];
  segments.forEach((segment) => {
    const control = mapPoint([segment.control.x, segment.control.y]);
    const mappedEnd = mapPoint([segment.end.x, segment.end.y]);
    commands.push(`Q ${control.x.toFixed(4)} ${control.y.toFixed(4)} ${mappedEnd.x.toFixed(4)} ${mappedEnd.y.toFixed(4)}`);
  });
  return `${commands.join(" ")} Z`;
}
