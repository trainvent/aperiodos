const H = Math.sqrt(3) / 2;

export const SPECTRE_POINTS = [
  [0, 0], [1, 0], [2, 0], [2.5, H], [2.5 + H, H - 0.5], [2.5 + H * 2, H], [2 + H * 2, H * 2],
  [1 + H * 2, H * 2], [1 + H * 2, 1 + H * 2], [1 + H, 1.5 + H * 2], [0.5 + H, 1.5 + H],
  [H - 0.5, 1.5 + H], [H - 0.5, 0.5 + H], [-0.5, H],
];

export function spectreEdgeControl(start, end, index, roundness = 0, lean = 1, weight = 0.5) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy) || 1;
  const direction = index % 2 ? -1 : 1;
  const progress = index % 2 ? 1 - weight : weight;
  const bulge = roundness * lean * direction * length;
  return [
    start[0] + dx * progress - dy / length * bulge,
    start[1] + dy * progress + dx / length * bulge,
  ];
}

export function spectrePath(points = SPECTRE_POINTS, roundness = 0, lean = 1, weight = 0.5, mapPoint = (point) => ({ x: point[0], y: point[1] })) {
  if (!points.length) return "";
  const first = mapPoint(points[0]);
  const commands = [`M ${first.x.toFixed(4)} ${first.y.toFixed(4)}`];
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const control = mapPoint(spectreEdgeControl(start, end, index, roundness, lean, weight));
    const mappedEnd = mapPoint(end);
    commands.push(`Q ${control.x.toFixed(4)} ${control.y.toFixed(4)} ${mappedEnd.x.toFixed(4)} ${mappedEnd.y.toFixed(4)}`);
  });
  return `${commands.join(" ")} Z`;
}
