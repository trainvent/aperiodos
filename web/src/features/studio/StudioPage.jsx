import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  HAT_CARTESIAN,
  bindPathEndpoints,
  cartesianToLattice,
  circleHandlePoint,
  circularPathGeometry,
  cloneDesign,
  createDefaultDesign,
  latticeToCartesian,
  nearestBoundaryPoint,
  snapCircleHandle,
  snapLatticePoint,
  validateDesign,
} from "./einsteinGeometry";

const STORAGE_KEY = "aperiodos-studio-designs-v1";
const CANVAS = { width: 760, height: 620, scale: 82, originX: 270, originY: 330 };
const H_CLUSTER_TRANSFORMS = [
  [-0.25, 0.4330127019, 1, 0.4330127019, 0.25, -1.7320508076],
  [-0.25, 0.4330127019, 4, 0.4330127019, 0.25, -1.7320508076],
  [-0.25, -0.4330127019, 2.5, -0.4330127019, 0.25, -2.5980762114],
  [-0.25, 0.4330127019, 2.5, -0.4330127019, -0.25, -0.8660254038],
];

function toCanvas(point) {
  const cartesian = latticeToCartesian(point);
  return {
    x: CANVAS.originX + cartesian.x * CANVAS.scale,
    y: CANVAS.originY - cartesian.y * CANVAS.scale,
  };
}

function fromCanvas(point) {
  return cartesianToLattice({
    x: (point.x - CANVAS.originX) / CANVAS.scale,
    y: (CANVAS.originY - point.y) / CANVAS.scale,
  });
}

function pointsAttribute(points, mapper = toCanvas) {
  return points.map((point) => {
    const mapped = mapper(point);
    return `${mapped.x.toFixed(2)},${mapped.y.toFixed(2)}`;
  }).join(" ");
}

function bezierPath(points, mapper = toCanvas) {
  if (!points.length) return "";
  const start = mapper(points[0]);
  const commands = [`M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`];
  for (let index = 1; index < points.length; index += 3) {
    const segment = points.slice(index, index + 3).map(mapper);
    if (segment.length === 3) {
      commands.push(`C ${segment.map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ")}`);
    }
  }
  return commands.join(" ");
}

function circularPathD(path, mapper = toCanvas) {
  const segments = circularPathGeometry(path).segments || [];
  return segments.map((points) => points.map((point, index) => {
    const mapped = mapper(point);
    return `${index ? "L" : "M"} ${mapped.x.toFixed(2)} ${mapped.y.toFixed(2)}`;
  }).join(" ")).join(" ");
}

function latticeLines() {
  const lines = [];
  const low = -7;
  const high = 8;
  for (let index = low; index <= high; index += 1) {
    lines.push([{ u: index, v: low }, { u: index, v: high }]);
    lines.push([{ u: low, v: index }, { u: high, v: index }]);
    lines.push([{ u: low, v: index - low }, { u: high, v: index - high }]);
  }
  return lines;
}

function transformCartesian(point, transform) {
  const cartesian = latticeToCartesian(point);
  return {
    x: transform[0] * cartesian.x + transform[1] * cartesian.y + transform[2],
    y: transform[3] * cartesian.x + transform[4] * cartesian.y + transform[5],
  };
}

function clusterMapper(transform) {
  return (point) => {
    const transformed = transformCartesian(point, transform);
    return { x: 68 + transformed.x * 78, y: 282 + transformed.y * 78 };
  };
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(name) {
  return String(name || "material-design").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "material-design";
}

function exportSvg(design) {
  const tilePoints = pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice));
  const paths = design.paths.map((path) => (
    `<path d="${bezierPath(path.points)}" fill="none" stroke="${xmlEscape(design.colors.ink)}" stroke-width="${(path.width * CANVAS.scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`
  )).join("");
  const circles = (design.circles || []).map((circle) => {
    const center = toCanvas(circle.center);
    const fill = circle.operation === "ink" ? design.colors.ink : design.colors.base;
    return `<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${(circle.radius * CANVAS.scale).toFixed(2)}" fill="${xmlEscape(fill)}" />`;
  }).join("");
  const circularPaths = (design.circularPaths || []).map((path) => (
    `<path d="${circularPathD(path)}" fill="none" stroke="${xmlEscape(design.colors.ink)}" stroke-width="${(path.width * CANVAS.scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`
  )).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" width="${CANVAS.width}" height="${CANVAS.height}"><title>${xmlEscape(design.name)}</title><defs><clipPath id="tile"><polygon points="${tilePoints}" /></clipPath></defs><rect width="100%" height="100%" fill="white"/><polygon points="${tilePoints}" fill="${xmlEscape(design.colors.base)}"/><g clip-path="url(#tile)">${paths}${circles}${circularPaths}</g><polygon points="${tilePoints}" fill="none" stroke="#17313b" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

export default function StudioPage() {
  const { t } = useTranslation("common");
  const [design, setDesign] = useState(createDefaultDesign);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [selectedCircularPathId, setSelectedCircularPathId] = useState("reference-circular-path");
  const [snapMode, setSnapMode] = useState("half");
  const [showGrid, setShowGrid] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [bindEndpoints, setBindEndpoints] = useState(true);
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [drag, setDrag] = useState(null);
  const [status, setStatus] = useState("");
  const importRef = useRef(null);
  const grid = useMemo(latticeLines, []);
  const selectedPath = design.paths.find((path) => path.id === selectedPathId) || (selectedPathId ? design.paths[0] : null);
  const selectedCircle = (design.circles || []).find((circle) => circle.id === selectedCircleId);
  const selectedCircularPath = (design.circularPaths || []).find((path) => path.id === selectedCircularPathId);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) setSavedDesigns(stored.map(validateDesign));
    } catch {
      setStatus(t("studio.status.libraryFailed"));
    }
  }, [t]);

  function persistLibrary(next) {
    setSavedDesigns(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function updatePoint(pathId, pointIndex, point) {
    setDesign((current) => ({
      ...current,
      paths: current.paths.map((path) => {
        if (path.id !== pathId) return path;
        const points = path.points.map((existing, index) => index === pointIndex ? point : existing);
        return { ...path, points };
      }),
    }));
  }

  function updateCircle(circleId, changes) {
    setDesign((current) => ({
      ...current,
      circles: (current.circles || []).map((circle) => circle.id === circleId ? { ...circle, ...changes } : circle),
    }));
  }

  function updateCircularPath(pathId, changes) {
    setDesign((current) => ({
      ...current,
      circularPaths: (current.circularPaths || []).map((path) => path.id === pathId ? { ...path, ...changes } : path),
    }));
  }

  function pointerPosition(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * CANVAS.width / rect.width,
      y: (event.clientY - rect.top) * CANVAS.height / rect.height,
    };
  }

  function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    let point = fromCanvas(pointerPosition(event));
    const snapStep = snapMode === "grid" ? 1 : snapMode === "half" ? 0.5 : snapMode === "quarter" ? 0.25 : 0;
    if (drag.kind === "circle-center") {
      updateCircle(drag.circleId, { center: snapLatticePoint(point, snapStep) });
      return;
    }
    if (drag.kind === "circle-radius") {
      const circle = (design.circles || []).find((candidate) => candidate.id === drag.circleId);
      const latticeStep = snapMode === "grid" ? 1 : snapMode === "half" ? 0.5 : snapMode === "quarter" ? 0.25 : 0;
      const angleStep = snapMode === "free" ? 0 : 30;
      updateCircle(drag.circleId, snapCircleHandle(circle.center, point, latticeStep, angleStep));
      return;
    }
    if (drag.kind === "circular-path") {
      const circularPath = (design.circularPaths || []).find((candidate) => candidate.id === drag.pathId);
      const points = circularPath.points.map((existing, index) => index === drag.pointIndex ? snapLatticePoint(point, snapStep) : existing);
      updateCircularPath(drag.pathId, { points });
      return;
    }
    const path = design.paths.find((candidate) => candidate.id === drag.pathId);
    const isEndpoint = drag.pointIndex === 0 || drag.pointIndex === path.points.length - 1;
    point = snapLatticePoint(point, snapStep);
    if (bindEndpoints && isEndpoint) {
      point = nearestBoundaryPoint(point).point;
    }
    updatePoint(drag.pathId, drag.pointIndex, point);
  }

  function stopDragging(event) {
    if (drag && event.pointerId === drag.pointerId) setDrag(null);
  }

  function beginDragging(event, pathId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPathId(pathId);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
    setDrag({ kind: "path", pathId, pointIndex, pointerId: event.pointerId });
  }

  function beginCircleDragging(event, kind, circleId) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedCircleId(circleId);
    setSelectedCircularPathId(null);
    setDrag({ kind, circleId, pointerId: event.pointerId });
  }

  function beginCircularPathDragging(event, pathId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPathId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(pathId);
    setDrag({ kind: "circular-path", pathId, pointIndex, pointerId: event.pointerId });
  }

  function updateSelectedPath(changes) {
    setDesign((current) => ({
      ...current,
      paths: current.paths.map((path) => path.id === selectedPathId ? { ...path, ...changes } : path),
    }));
  }

  function addPath() {
    const id = `curve-${Date.now()}`;
    const path = bindPathEndpoints({
      id,
      name: t("studio.paths.newName", { count: design.paths.length + 1 }),
      width: 0.7,
      points: [
        { u: -0.5, v: 1 },
        { u: 0.5, v: 1 },
        { u: 1.5, v: 0 },
        { u: 2.5, v: -1 },
      ],
    });
    setDesign((current) => ({ ...current, paths: [...current.paths, path] }));
    setSelectedPathId(id);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
  }

  function addCircle() {
    const id = `circle-${Date.now()}`;
    const circle = {
      id,
      name: t("studio.circles.newName", { count: (design.circles || []).length + 1 }),
      center: { u: 1, v: 1 },
      radius: 1,
      handleAngle: 0,
      operation: "ink",
    };
    setDesign((current) => ({ ...current, circles: [...(current.circles || []), circle] }));
    setSelectedCircleId(id);
    setSelectedCircularPathId(null);
  }

  function removeCircle() {
    if (!selectedCircle) return;
    if (!design.paths.length && (design.circles || []).length <= 1 && !(design.circularPaths || []).length) return;
    setDesign((current) => ({ ...current, circles: (current.circles || []).filter((circle) => circle.id !== selectedCircle.id) }));
    setSelectedCircleId(null);
  }

  function addCircularPath() {
    const id = `circular-path-${Date.now()}`;
    const circularPath = {
      id,
      name: t("studio.circularPaths.newName", { count: (design.circularPaths || []).length + 1 }),
      width: 0.7,
      side: "left",
      points: [{ u: 0, v: 1 }, { u: 1, v: 1 }, { u: 1, v: 0 }],
    };
    setDesign((current) => ({ ...current, circularPaths: [...(current.circularPaths || []), circularPath] }));
    setSelectedPathId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(id);
  }

  function removeCircularPath() {
    if (!selectedCircularPath) return;
    if (!design.paths.length && !(design.circles || []).length && (design.circularPaths || []).length <= 1) return;
    setDesign((current) => ({
      ...current,
      circularPaths: (current.circularPaths || []).filter((path) => path.id !== selectedCircularPath.id),
    }));
    setSelectedCircularPathId(null);
    setSelectedPathId(design.paths[0]?.id || null);
  }

  function addSegment() {
    if (!selectedPath) return;
    const points = selectedPath.points;
    const anchor = points[points.length - 1];
    const previous = points[points.length - 2];
    const next = [
      { u: anchor.u + (anchor.u - previous.u), v: anchor.v + (anchor.v - previous.v) },
      { u: anchor.u + 0.75, v: anchor.v + 0.25 },
      nearestBoundaryPoint({ u: anchor.u + 1.5, v: anchor.v + 0.5 }).point,
    ];
    updateSelectedPath({ points: [...points, ...next] });
  }

  function removeSegment() {
    if (!selectedPath || selectedPath.points.length <= 4) return;
    updateSelectedPath({ points: selectedPath.points.slice(0, -3) });
  }

  function removePath() {
    if (design.paths.length <= 1 && !(design.circles || []).length && !(design.circularPaths || []).length) return;
    const remaining = design.paths.filter((path) => path.id !== selectedPathId);
    setDesign((current) => ({ ...current, paths: remaining }));
    setSelectedPathId(remaining[0]?.id || null);
  }

  function saveDesign() {
    const now = new Date().toISOString();
    const currentId = design.id.startsWith("builtin-") ? null : design.id;
    const saved = {
      ...cloneDesign(design),
      id: currentId || window.crypto?.randomUUID?.() || `design-${Date.now()}`,
      createdAt: currentId ? design.createdAt : now,
      updatedAt: now,
    };
    const next = [...savedDesigns.filter((item) => item.id !== saved.id), saved];
    persistLibrary(next);
    setDesign(saved);
    setStatus(t("studio.status.saved"));
  }

  function loadDesign(nextDesign) {
    const loaded = cloneDesign(nextDesign);
    setDesign(loaded);
    setSelectedPathId(loaded.paths[0]?.id || null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(loaded.paths.length ? null : loaded.circularPaths?.[0]?.id || null);
    setStatus(t("studio.status.loaded"));
  }

  function deleteDesign(id) {
    persistLibrary(savedDesigns.filter((item) => item.id !== id));
    if (design.id === id) loadDesign(createDefaultDesign());
    setStatus(t("studio.status.deleted"));
  }

  function resetDesign() {
    loadDesign(createDefaultDesign());
    setStatus(t("studio.status.reset"));
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const imported = validateDesign(JSON.parse(text));
      loadDesign({ ...cloneDesign(imported), id: `imported-${Date.now()}` });
      setStatus(t("studio.status.imported"));
    }).catch(() => setStatus(t("studio.status.importFailed")));
    event.target.value = "";
  }

  const ports = design.paths.flatMap((path) => [
    { path, side: t("studio.ports.start"), port: nearestBoundaryPoint(path.points[0]) },
    { path, side: t("studio.ports.end"), port: nearestBoundaryPoint(path.points[path.points.length - 1]) },
  ]);
  const boundCount = ports.filter(({ port }) => port.distance < 0.0001).length;

  return (
    <section className="studio-page">
      <header className="studio-intro">
        <div>
          <p className="eyebrow">{t("studio.hero.eyebrow")}</p>
          <h2>{t("studio.hero.title")}</h2>
        </div>
        <p>{t("studio.hero.lede")}</p>
      </header>

      <div className="panel studio-layout studio-builder-shell">
        <div className="studio-top-toolbar" role="toolbar" aria-label={t("studio.toolbar.aria")}>
          <div className="studio-toolbar-group studio-toolbar-create">
            <span className="studio-toolbar-label">{t("studio.toolbar.add")}</span>
            <button type="button" className="primary" onClick={addCircularPath}><span>⌁</span>{t("studio.circularPaths.title")}</button>
            <button type="button" onClick={addPath}><span>⌇</span>{t("studio.paths.title")}</button>
            <button type="button" onClick={addCircle}><span>○</span>{t("studio.circles.title")}</button>
          </div>
          <div className="studio-toolbar-group studio-toolbar-settings">
            <label className="studio-toolbar-name">
              <span>{t("studio.controls.name")}</span>
              <input value={design.name} onChange={(event) => setDesign((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="studio-toolbar-color" title={t("studio.controls.baseColor")}>
              <span>{t("studio.toolbar.tile")}</span>
              <input type="color" value={design.colors.base} onChange={(event) => setDesign((current) => ({ ...current, colors: { ...current.colors, base: event.target.value } }))} />
            </label>
            <label className="studio-toolbar-color" title={t("studio.controls.curveColor")}>
              <span>{t("studio.toolbar.material")}</span>
              <input type="color" value={design.colors.ink} onChange={(event) => setDesign((current) => ({ ...current, colors: { ...current.colors, ink: event.target.value } }))} />
            </label>
            <label className="studio-toolbar-snap">
              <span>{t("studio.controls.snapping")}</span>
              <select value={snapMode} onChange={(event) => setSnapMode(event.target.value)}>
                <option value="quarter">¼</option>
                <option value="half">½</option>
                <option value="grid">1</option>
                <option value="free">{t("studio.controls.snapFree")}</option>
              </select>
            </label>
          </div>
          <details className="studio-view-options studio-toolbar-view">
            <summary><span>{t("studio.controls.view")}</span><small>2</small></summary>
            <div className="studio-toggles">
              <label className="checkbox"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /><span>{t("studio.controls.showGrid")}</span></label>
              <label className="checkbox"><input type="checkbox" checked={showHandles} onChange={(event) => setShowHandles(event.target.checked)} /><span>{t("studio.controls.showHandles")}</span></label>
            </div>
          </details>
          <div className="studio-toolbar-group studio-toolbar-actions">
            <button type="button" onClick={saveDesign}>{t("studio.actions.save")}</button>
            <button type="button" onClick={resetDesign}>{t("studio.actions.reset")}</button>
          </div>
        </div>

        <aside className="studio-controls studio-tool-menu" aria-label={t("studio.controls.objects")}>
          <div className="studio-panel-heading">
            <div>
              <h2>{t("studio.controls.objects")}</h2>
            </div>
            <span className="studio-coordinate-badge">u · v · √3</span>
          </div>

          <div className="studio-section studio-path-section studio-secondary-section">
            <div className="studio-section-title">
              <h3>{t("studio.paths.title")}</h3>
              <span className="studio-tree-count">{design.paths.length}</span>
            </div>
            {design.paths.length ? <div className="studio-path-list">
              {design.paths.map((path, index) => (
                <button key={path.id} type="button" className={`studio-path-button${path.id === selectedPathId && !selectedCircleId && !selectedCircularPathId ? " active" : ""}`} onClick={() => { setSelectedPathId(path.id); setSelectedCircleId(null); setSelectedCircularPathId(null); }}>
                  <span className="studio-path-swatch" style={{ background: design.colors.ink }} />
                  <span>{path.name || t("studio.paths.newName", { count: index + 1 })}</span>
                  <small>{(path.points.length - 1) / 3}× C</small>
                </button>
              ))}
            </div> : null}
            {selectedPath && !selectedCircle && !selectedCircularPath ? (
              <div className="studio-path-editor">
                <label>
                  <span>{t("studio.paths.pathName")}</span>
                  <input value={selectedPath.name} onChange={(event) => updateSelectedPath({ name: event.target.value })} />
                </label>
                <label>
                  <span>{t("studio.paths.width")}: {selectedPath.width.toFixed(2)}</span>
                  <input type="range" min="0.1" max="1.6" step="0.02" value={selectedPath.width} onChange={(event) => updateSelectedPath({ width: Number(event.target.value) })} />
                </label>
                <label className="checkbox studio-inline-option"><input type="checkbox" checked={bindEndpoints} onChange={(event) => setBindEndpoints(event.target.checked)} /><span>{t("studio.controls.bindEndpoints")}</span></label>
                <div className="studio-compact-actions">
                  <button type="button" onClick={addSegment}>{t("studio.paths.addSegment")}</button>
                  <button type="button" onClick={removeSegment} disabled={selectedPath.points.length <= 4}>{t("studio.paths.removeSegment")}</button>
                  <button type="button" onClick={removePath} disabled={design.paths.length <= 1 && !(design.circles || []).length && !(design.circularPaths || []).length}>{t("studio.paths.removePath")}</button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="studio-section studio-circle-section studio-secondary-section">
            <div className="studio-section-title">
              <h3>{t("studio.circles.title")}</h3>
              <span className="studio-tree-count">{(design.circles || []).length}</span>
            </div>
            {(design.circles || []).length ? (
              <div className="studio-path-list">
                {design.circles.map((circle) => (
                  <button key={circle.id} type="button" className={`studio-path-button${circle.id === selectedCircleId ? " active" : ""}`} onClick={() => { setSelectedCircleId(circle.id); setSelectedCircularPathId(null); }}>
                    <span className={`studio-circle-swatch ${circle.operation}`} />
                    <span>{circle.name}</span>
                    <small>r {circle.radius.toFixed(2)}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedCircle ? (
              <div className="studio-path-editor">
                <label>
                  <span>{t("studio.circles.circleName")}</span>
                  <input value={selectedCircle.name} onChange={(event) => updateCircle(selectedCircle.id, { name: event.target.value })} />
                </label>
                <label>
                  <span>{t("studio.circles.operation")}</span>
                  <select value={selectedCircle.operation} onChange={(event) => updateCircle(selectedCircle.id, { operation: event.target.value })}>
                    <option value="ink">{t("studio.circles.addColor")}</option>
                    <option value="base">{t("studio.circles.cutColor")}</option>
                  </select>
                </label>
                <label>
                  <span>{t("studio.circles.radius")}: {selectedCircle.radius.toFixed(3)}</span>
                  <input type="range" min="0.125" max="5" step="0.125" value={selectedCircle.radius} onChange={(event) => updateCircle(selectedCircle.id, { radius: Number(event.target.value) })} />
                </label>
                <div className="studio-compact-actions"><button type="button" onClick={removeCircle} disabled={!design.paths.length && (design.circles || []).length <= 1 && !(design.circularPaths || []).length}>{t("studio.circles.remove")}</button></div>
              </div>
            ) : null}
          </div>

          <div className="studio-section studio-circular-path-section studio-primary-section">
            <div className="studio-section-title">
              <h3>{t("studio.circularPaths.title")}</h3>
              <span className="studio-tree-count">{(design.circularPaths || []).length}</span>
            </div>
            {(design.circularPaths || []).length ? (
              <div className="studio-path-list">
                {design.circularPaths.map((path) => {
                  const geometry = circularPathGeometry(path);
                  return (
                    <button key={path.id} type="button" className={`studio-path-button${path.id === selectedCircularPathId ? " active" : ""}`} onClick={() => { setSelectedPathId(null); setSelectedCircleId(null); setSelectedCircularPathId(path.id); }}>
                      <span className="studio-circular-path-swatch">⌁</span>
                      <span>{path.name}</span>
                      <small>r {geometry.radius.toFixed(2)}</small>
                    </button>
                  );
                })}
              </div>
            ) : <p className="studio-empty-note">{t("studio.circularPaths.empty")}</p>}
            {selectedCircularPath ? (() => {
              const geometry = circularPathGeometry(selectedCircularPath);
              return (
                <div className="studio-path-editor">
                  <label>
                    <span>{t("studio.circularPaths.pathName")}</span>
                    <input value={selectedCircularPath.name} onChange={(event) => updateCircularPath(selectedCircularPath.id, { name: event.target.value })} />
                  </label>
                  <label>
                    <span>{t("studio.circularPaths.width")}: {selectedCircularPath.width.toFixed(2)}</span>
                    <input type="range" min="0.1" max="1.6" step="0.02" value={selectedCircularPath.width} onChange={(event) => updateCircularPath(selectedCircularPath.id, { width: Number(event.target.value) })} />
                  </label>
                  <label>
                    <span>{t("studio.circularPaths.side")}</span>
                    <select value={selectedCircularPath.side} onChange={(event) => updateCircularPath(selectedCircularPath.id, { side: event.target.value })}>
                      <option value="left">{t("studio.circularPaths.left")}</option>
                      <option value="right">{t("studio.circularPaths.right")}</option>
                    </select>
                  </label>
                  <div className="studio-circular-measurements">
                    <span>1–2: {geometry.distance12.toFixed(3)}</span>
                    <span>2–3: {geometry.distance23.toFixed(3)}</span>
                    <span>r: {geometry.radius.toFixed(3)}</span>
                  </div>
                  {geometry.mismatch ? <p className="studio-geometry-warning" role="status">{t("studio.circularPaths.warning")}</p> : null}
                  <div className="studio-compact-actions"><button type="button" onClick={removeCircularPath} disabled={!design.paths.length && !(design.circles || []).length && (design.circularPaths || []).length <= 1}>{t("studio.circularPaths.remove")}</button></div>
                </div>
              );
            })() : null}
          </div>

          {design.paths.length ? <div className="studio-port-report">
            <div><strong>{boundCount}/{ports.length}</strong><span>{t("studio.ports.bound")}</span></div>
            <ul>
              {ports.map(({ path, side, port }) => (
                <li key={`${path.id}-${side}`}><span>{path.name} · {side}</span><strong>E{port.edge + 1} · {Math.round(port.t * 100)}%</strong></li>
              ))}
            </ul>
          </div> : null}

          {status ? <p className="studio-status" role="status">{status}</p> : null}
        </aside>

        <main className="studio-workbench">
          <div className="studio-panel-heading">
            <div>
              <span className="studio-live-badge">{t("studio.canvas.live")}</span>
              <h2>{t("studio.canvas.title")}</h2>
            </div>
            <p>{t("studio.canvas.help")}</p>
          </div>
          <svg
            className="studio-canvas"
            viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
            role="img"
            aria-label={t("studio.canvas.aria")}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <defs><clipPath id="studio-hat-clip"><polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} /></clipPath></defs>
            <rect width={CANVAS.width} height={CANVAS.height} className="studio-canvas-bg" />
            {showGrid ? (
              <g className="studio-lattice">
                {grid.map(([start, end], index) => {
                  const a = toCanvas(start);
                  const b = toCanvas(end);
                  return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                })}
                {Array.from({ length: 15 }, (_, uIndex) => Array.from({ length: 14 }, (_, vIndex) => {
                  const point = toCanvas({ u: uIndex - 6, v: vIndex - 6 });
                  return <circle key={`${uIndex}-${vIndex}`} cx={point.x} cy={point.y} r="2.1" />;
                }))}
              </g>
            ) : null}
            <polygon className="studio-tile-fill" points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} style={{ fill: design.colors.base }} />
            <g clipPath="url(#studio-hat-clip)">
              {design.paths.map((path) => (
                <path key={path.id} className={`studio-material-path${path.id === selectedPathId && !selectedCircleId && !selectedCircularPathId ? " selected" : ""}`} d={bezierPath(path.points)} style={{ stroke: design.colors.ink }} strokeWidth={path.width * CANVAS.scale} onPointerDown={() => { setSelectedPathId(path.id); setSelectedCircleId(null); setSelectedCircularPathId(null); }} />
              ))}
              {(design.circles || []).map((circle) => {
                const center = toCanvas(circle.center);
                return <circle key={circle.id} className="studio-material-circle" cx={center.x} cy={center.y} r={circle.radius * CANVAS.scale} fill={circle.operation === "ink" ? design.colors.ink : design.colors.base} onPointerDown={() => { setSelectedCircleId(circle.id); setSelectedCircularPathId(null); }} />;
              })}
              {(design.circularPaths || []).map((path) => (
                <path key={path.id} className={`studio-material-path studio-circular-material-path${path.id === selectedCircularPathId ? " selected" : ""}`} d={circularPathD(path)} stroke={design.colors.ink} strokeWidth={path.width * CANVAS.scale} onPointerDown={() => { setSelectedPathId(null); setSelectedCircleId(null); setSelectedCircularPathId(path.id); }} />
              ))}
            </g>
            <polygon className="studio-tile-outline" points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} />
            {HAT_CARTESIAN.map((point, index) => {
              const next = HAT_CARTESIAN[(index + 1) % HAT_CARTESIAN.length];
              const label = toCanvas(cartesianToLattice({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }));
              return <g className="studio-edge-label" key={index}><circle cx={label.x} cy={label.y} r="11" /><text x={label.x} y={label.y + 3.5}>{index + 1}</text></g>;
            })}
            {showHandles && selectedPath && !selectedCircle && !selectedCircularPath ? (
              <g className="studio-handles">
                {Array.from({ length: (selectedPath.points.length - 1) / 3 }, (_, segment) => {
                  const index = segment * 3;
                  const anchorA = toCanvas(selectedPath.points[index]);
                  const controlA = toCanvas(selectedPath.points[index + 1]);
                  const controlB = toCanvas(selectedPath.points[index + 2]);
                  const anchorB = toCanvas(selectedPath.points[index + 3]);
                  return <g key={segment}><line x1={anchorA.x} y1={anchorA.y} x2={controlA.x} y2={controlA.y} /><line x1={controlB.x} y1={controlB.y} x2={anchorB.x} y2={anchorB.y} /></g>;
                })}
                {selectedPath.points.map((point, index) => {
                  const screen = toCanvas(point);
                  const anchor = index % 3 === 0;
                  return <circle key={index} className={anchor ? "anchor" : "control"} cx={screen.x} cy={screen.y} r={anchor ? 8 : 6} onPointerDown={(event) => beginDragging(event, selectedPath.id, index)} />;
                })}
              </g>
            ) : null}
            {showHandles && selectedCircle ? (() => {
              const center = toCanvas(selectedCircle.center);
              const radiusHandle = toCanvas(circleHandlePoint(selectedCircle));
              return (
                <g className="studio-handles studio-circle-handles">
                  <line x1={center.x} y1={center.y} x2={radiusHandle.x} y2={radiusHandle.y} />
                  <circle className="anchor" cx={center.x} cy={center.y} r="8" onPointerDown={(event) => beginCircleDragging(event, "circle-center", selectedCircle.id)} />
                  <circle className="control" cx={radiusHandle.x} cy={radiusHandle.y} r="6" onPointerDown={(event) => beginCircleDragging(event, "circle-radius", selectedCircle.id)} />
                </g>
              );
            })() : null}
            {showHandles && selectedCircularPath ? (
              <g className="studio-handles studio-circular-path-handles">
                <polyline points={pointsAttribute(selectedCircularPath.points)} />
                {selectedCircularPath.points.map((point, index) => {
                  const screen = toCanvas(point);
                  return (
                    <g key={index}>
                      <circle className="anchor" cx={screen.x} cy={screen.y} r="9" onPointerDown={(event) => beginCircularPathDragging(event, selectedCircularPath.id, index)} />
                      <text x={screen.x} y={screen.y + 3.5}>{index + 1}</text>
                    </g>
                  );
                })}
              </g>
            ) : null}
          </svg>
          <div className="studio-canvas-legend">
            <span><i className="legend-anchor" />{t("studio.canvas.anchor")}</span>
            <span><i className="legend-control" />{t("studio.canvas.control")}</span>
            <span><i className="legend-port" />{t("studio.canvas.port")}</span>
          </div>
        </main>
      </div>

      <section className="studio-lower-grid">
        <div className="panel studio-cluster-panel">
          <div className="studio-panel-heading">
            <div><h2>{t("studio.preview.title")}</h2></div>
            <p>{t("studio.preview.help")}</p>
          </div>
          <ClusterPreview design={design} />
        </div>

        <div className="panel studio-library-panel">
          <div className="studio-panel-heading">
            <div><h2>{t("studio.library.title")}</h2></div>
            <span className="studio-library-count">{savedDesigns.length + 1}</span>
          </div>
          <p className="studio-library-note">{t("studio.library.localNote")}</p>
          <div className="studio-library-grid">
            {[createDefaultDesign(), ...savedDesigns].map((item) => (
              <article className="studio-design-card" key={item.id}>
                <MiniDesign design={item} />
                <div><strong>{item.name}</strong><small>{item.id.startsWith("builtin-") ? t("studio.library.builtin") : t("studio.library.local")}</small></div>
                <div className="studio-card-actions">
                  <button type="button" onClick={() => loadDesign(item)}>{t("studio.library.load")}</button>
                  {!item.id.startsWith("builtin-") ? <button type="button" onClick={() => deleteDesign(item.id)}>{t("studio.library.delete")}</button> : null}
                </div>
              </article>
            ))}
          </div>
          <div className="studio-library-actions">
            <button className="button button-green small" type="button" onClick={() => downloadBlob(`${safeFilename(design.name)}.json`, JSON.stringify(design, null, 2), "application/json")}>{t("studio.actions.exportJson")}</button>
            <button className="button button-ink small" type="button" onClick={() => downloadBlob(`${safeFilename(design.name)}.svg`, exportSvg(design), "image/svg+xml")}>{t("studio.actions.exportSvg")}</button>
            <button className="button button-muted small" type="button" onClick={() => importRef.current?.click()}>{t("studio.actions.import")}</button>
            <input ref={importRef} className="studio-file-input" type="file" accept="application/json,.json" onChange={handleImport} />
          </div>
        </div>
      </section>
    </section>
  );
}

function ClusterPreview({ design }) {
  return (
    <svg className="studio-cluster-preview" viewBox="0 0 540 360" aria-label="Transformed Einstein material preview">
      <rect width="540" height="360" fill="#fffdf8" />
      <defs>
        {H_CLUSTER_TRANSFORMS.map((transform, index) => <clipPath id={`cluster-clip-${index}`} key={index}><polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice), clusterMapper(transform))} /></clipPath>)}
      </defs>
      {H_CLUSTER_TRANSFORMS.map((transform, index) => {
        const mapper = clusterMapper(transform);
        const determinant = transform[0] * transform[4] - transform[1] * transform[3];
        return (
          <g key={index}>
            <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice), mapper)} fill={design.colors.base} />
            <g clipPath={`url(#cluster-clip-${index})`}>
              {design.paths.map((path) => <path key={path.id} d={bezierPath(path.points, mapper)} fill="none" stroke={design.colors.ink} strokeWidth={path.width * Math.sqrt(Math.abs(determinant)) * 78} strokeLinecap="round" strokeLinejoin="round" />)}
              {(design.circles || []).map((circle) => {
                const center = mapper(circle.center);
                return <circle key={circle.id} cx={center.x} cy={center.y} r={circle.radius * Math.sqrt(Math.abs(determinant)) * 78} fill={circle.operation === "ink" ? design.colors.ink : design.colors.base} />;
              })}
              {(design.circularPaths || []).map((path) => <path key={path.id} d={circularPathD(path, mapper)} fill="none" stroke={design.colors.ink} strokeWidth={path.width * Math.sqrt(Math.abs(determinant)) * 78} strokeLinecap="round" strokeLinejoin="round" />)}
            </g>
            <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice), mapper)} fill="none" stroke="#17313b" strokeWidth="1.5" strokeLinejoin="round" />
            {determinant < 0 ? <text className="studio-mirror-label" x={mapper({ u: 1.5, v: 0 }).x} y={mapper({ u: 1.5, v: 0 }).y}>M</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

function MiniDesign({ design }) {
  return (
    <svg className="studio-mini-design" viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} aria-hidden="true">
      <defs><clipPath id={`mini-${design.id}`}><polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} /></clipPath></defs>
      <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} fill={design.colors.base} />
      <g clipPath={`url(#mini-${design.id})`}>
        {design.paths.map((path) => <path key={path.id} d={bezierPath(path.points)} fill="none" stroke={design.colors.ink} strokeWidth={path.width * CANVAS.scale} strokeLinecap="round" />)}
        {(design.circles || []).map((circle) => {
          const center = toCanvas(circle.center);
          return <circle key={circle.id} cx={center.x} cy={center.y} r={circle.radius * CANVAS.scale} fill={circle.operation === "ink" ? design.colors.ink : design.colors.base} />;
        })}
        {(design.circularPaths || []).map((path) => <path key={path.id} d={circularPathD(path)} fill="none" stroke={design.colors.ink} strokeWidth={path.width * CANVAS.scale} strokeLinecap="round" strokeLinejoin="round" />)}
      </g>
      <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} fill="none" stroke="#17313b" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
