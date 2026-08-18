import { useEffect, useState } from "react";

const HAT_POINTS = fitPoints([
  [0, 0],
  [-1.5, -0.866],
  [-1, -1.732],
  [1, -1.732],
  [1.5, -0.866],
  [3, -1.732],
  [4.5, -0.866],
  [4, 0],
  [3, 0],
  [3, 1.732],
  [1.5, 2.598],
  [1, 1.732],
  [0, 1.732]
]);

const SPECTRE_POINTS = fitPoints([
  [0, 0],
  [1, 0],
  [2, 0],
  [2.5, 0.866],
  [3.366, 0.366],
  [4.232, 0.866],
  [3.732, 1.732],
  [2.732, 1.732],
  [2.732, 2.732],
  [1.866, 3.232],
  [1.366, 2.366],
  [0.366, 2.366],
  [0.366, 1.366],
  [-0.5, 0.866]
]);

const STRAIGHT_SPECTRE_PATH = quadraticPath(SPECTRE_POINTS, 0);
const CURVED_SPECTRE_PATH = quadraticPath(SPECTRE_POINTS, 0.22);

export default function TileExample({ type }) {
  if (type === "einstein") return <EinsteinExample />;
  if (type === "spectre") return <SpectreExample />;
  if (type === "penrose") return <PenroseExample />;
  return null;
}

function EinsteinExample() {
  const points = svgPoints(HAT_POINTS);
  return (
    <div className="tile-example tile-example-einstein" aria-hidden="true">
      <svg viewBox="0 0 160 120">
        <g className="einstein-flip">
          <polygon className="tile-example-shadow" points={points} transform="translate(6 5)" />
          <polygon className="einstein-tile" points={points} />
        </g>
      </svg>
    </div>
  );
}

function SpectreExample() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="tile-example tile-example-spectre" aria-hidden="true">
      <svg viewBox="0 0 160 120">
        <path className="tile-example-shadow" d={STRAIGHT_SPECTRE_PATH} transform="translate(5 5)" />
        <path className="spectre-tile" d={STRAIGHT_SPECTRE_PATH}>
          {!reduceMotion ? (
            <animate
              attributeName="d"
              dur="7.5s"
              repeatCount="indefinite"
              values={`${STRAIGHT_SPECTRE_PATH};${CURVED_SPECTRE_PATH};${STRAIGHT_SPECTRE_PATH}`}
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1;0.4 0 0.2 1"
            />
          ) : null}
        </path>
      </svg>
    </div>
  );
}

function PenroseExample() {
  return (
    <div className="tile-example tile-example-penrose" aria-hidden="true">
      <svg viewBox="0 0 160 120">
        <polygon
          className="penrose-tile penrose-kite"
          points="31.63,70.86 50.10,14 79.99,35.72 91.40,70.86"
        />
        <polygon
          className="penrose-tile penrose-dart"
          points="79.99,106 128.38,70.86 79.99,35.72 91.40,70.86"
        />
      </svg>
    </div>
  );
}

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduceMotion;
}

function fitPoints(points) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(132 / (maxX - minX), 92 / (maxY - minY));
  const offsetX = (160 - (maxX - minX) * scale) / 2;
  const offsetY = (120 - (maxY - minY) * scale) / 2;
  return points.map(([x, y]) => [
    offsetX + (x - minX) * scale,
    offsetY + (y - minY) * scale
  ]);
}

function quadraticPath(points, bulge) {
  const commands = [`M ${pointValue(points[0])}`];
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    const sign = index % 2 === 0 ? 1 : -1;
    const control = [
      (start[0] + end[0]) / 2 + (dy / length) * length * bulge * sign,
      (start[1] + end[1]) / 2 - (dx / length) * length * bulge * sign
    ];
    commands.push(`Q ${pointValue(control)} ${pointValue(end)}`);
  });
  commands.push("Z");
  return commands.join(" ");
}

function svgPoints(points) {
  return points.map(pointValue).join(" ");
}

function pointValue([x, y]) {
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}
