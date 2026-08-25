export const SPECTRE_POINTS = [
  [0, 0], [1, 0], [2, 0], [2.5, 0.866], [3.366, 0.366], [4.232, 0.866], [3.732, 1.732],
  [2.732, 1.732], [2.732, 2.732], [1.866, 3.232], [1.366, 2.366], [0.366, 2.366], [0.366, 1.366], [-0.5, 0.866],
];

export function spectrePath(points = SPECTRE_POINTS, roundness = 0, lean = 1, weight = 0.5) {
  if (!points.length) return "";
  const commands = [`M ${points[0][0]} ${points[0][1]}`];
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy) || 1;
    const direction = index % 2 ? -1 : 1;
    const bulge = roundness * lean * direction * length;
    const controlX = start[0] + dx * weight - dy / length * bulge;
    const controlY = start[1] + dy * weight + dx / length * bulge;
    commands.push(`Q ${controlX.toFixed(4)} ${controlY.toFixed(4)} ${end[0]} ${end[1]}`);
  });
  return `${commands.join(" ")} Z`;
}
