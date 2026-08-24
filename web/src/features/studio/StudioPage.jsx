import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  HAT_CARTESIAN,
  bindPathEndpoints,
  cartesianToLattice,
  circleHandlePoint,
  circularPathGeometry,
  cloneDesign,
  createEmptyDesign,
  elementMaterialColor,
  getDesignLayers,
  insertCircularPathTemplate,
  latticeToCartesian,
  nearestBoundaryPoint,
  normalizeLayerOrder,
  snapCircleHandle,
  snapLatticePoint,
  validateDesign,
} from "./einsteinGeometry";
import { getStudioLibraryDesigns, writeStudioLibrary } from "./patternLibrary";

const CANVAS = { width: 760, height: 620, scale: 82, originX: 270, originY: 330 };
const H_CLUSTER_TRANSFORMS = [
  [0.25, 0.4330127019, 1.375, -0.4330127019, 0.25, -2.3815698598],
  [0.25, 0.4330127019, 2.875, -0.4330127019, 0.25, 0.2165063516],
  [-0.5, 0, 1.375, 0, -0.5, -0.6495190522],
  [-0.5, 0, 2.875, 0, 0.5, -1.5155444562],
];
const H_CLUSTER_VIEWBOX = { x: -65.5, y: -86, width: 540, height: 432 };

function toCanvas(point) {
  const cartesian = latticeToCartesian(point);
  return {
    x: CANVAS.width - (CANVAS.originX + cartesian.x * CANVAS.scale),
    y: CANVAS.height - (CANVAS.originY - cartesian.y * CANVAS.scale),
  };
}

function fromCanvas(point) {
  return cartesianToLattice({
    x: (CANVAS.width - point.x - CANVAS.originX) / CANVAS.scale,
    y: (point.y + CANVAS.originY - CANVAS.height) / CANVAS.scale,
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
  const layers = getDesignLayers(design).map(({ kind, item }) => {
    if (kind === "circle") {
      const center = toCanvas(item.center);
      const fill = item.operation === "ink" ? elementMaterialColor(design, item) : design.colors.base;
      return `<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${(item.radius * CANVAS.scale).toFixed(2)}" fill="${xmlEscape(fill)}" />`;
    }
    const pathData = kind === "path" ? bezierPath(item.points) : circularPathD(item);
    return `<path d="${pathData}" fill="none" stroke="${xmlEscape(elementMaterialColor(design, item))}" stroke-width="${(item.width * CANVAS.scale).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}" width="${CANVAS.width}" height="${CANVAS.height}"><title>${xmlEscape(design.name)}</title><defs><clipPath id="tile"><polygon points="${tilePoints}" /></clipPath></defs><rect width="100%" height="100%" fill="white"/><polygon points="${tilePoints}" fill="${xmlEscape(design.colors.base)}"/><g clip-path="url(#tile)">${layers}</g><polygon points="${tilePoints}" fill="none" stroke="#17313b" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

export default function StudioPage() {
  const { t } = useTranslation("common");
  const [design, setDesign] = useState(() => ({ ...createEmptyDesign(), name: t("studio.templates.untitled") }));
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [selectedCircularPathId, setSelectedCircularPathId] = useState(null);
  const [snapMode, setSnapMode] = useState("half");
  const [showGrid, setShowGrid] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [showEdgeNumbers, setShowEdgeNumbers] = useState(false);
  const [bindEndpoints, setBindEndpoints] = useState(true);
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [selectedExportId, setSelectedExportId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [status, setStatus] = useState("");
  const [treeMode, setTreeMode] = useState("categories");
  const [transformExpanded, setTransformExpanded] = useState(false);
  const importRef = useRef(null);
  const grid = useMemo(latticeLines, []);
  const selectedCircle = (design.circles || []).find((circle) => circle.id === selectedCircleId);
  const selectedCircularPath = (design.circularPaths || []).find((path) => path.id === selectedCircularPathId);
  const selectedPath = !selectedCircle && !selectedCircularPath
    ? design.paths.find((path) => path.id === selectedPathId) || (selectedPathId ? design.paths[0] : null)
    : null;
  const selectedExportDesign = savedDesigns.find((item) => item.id === selectedExportId) || null;

  useEffect(() => {
    let current = true;
    try {
      getStudioLibraryDesigns()
        .then((library) => { if (current) setSavedDesigns(library); })
        .catch(() => { if (current) setStatus(t("studio.status.libraryFailed")); });
    } catch {
      setStatus(t("studio.status.libraryFailed"));
    }
    return () => { current = false; };
  }, [t]);

  function persistLibrary(next) {
    writeStudioLibrary(next);
    getStudioLibraryDesigns().then(setSavedDesigns).catch(() => setStatus(t("studio.status.libraryFailed")));
  }

  function moveLayer(kind, id, direction) {
    setDesign((current) => {
      const order = normalizeLayerOrder(current);
      const index = order.findIndex((entry) => entry.kind === kind && entry.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, layerOrder: next };
    });
  }

  function selectLayer(kind, id) {
    setSelectedPathId(kind === "path" ? id : null);
    setSelectedCircleId(kind === "circle" ? id : null);
    setSelectedCircularPathId(kind === "circularPath" ? id : null);
    setDrag(null);
  }

  function applyTemplate(templateId) {
    if (templateId === "einstein-circular-path") {
      const id = `template-circular-path-${window.crypto?.randomUUID?.() || Date.now()}`;
      setDesign((current) => insertCircularPathTemplate(current, {
        id,
        name: t("studio.circularPaths.newName", { count: (current.circularPaths || []).length + 1 }),
      }));
      selectLayer("circularPath", id);
      setStatus(t("studio.status.templateApplied"));
    }
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
    setSelectedPathId(null);
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
    setSelectedPathId(null);
    setSelectedCircleId(id);
    setSelectedCircularPathId(null);
  }

  function removeCircle() {
    if (!selectedCircle) return;
    setDesign((current) => ({ ...current, circles: (current.circles || []).filter((circle) => circle.id !== selectedCircle.id) }));
    setSelectedCircleId(null);
    setStatus(t("studio.status.elementDeleted"));
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
    setDesign((current) => ({
      ...current,
      circularPaths: (current.circularPaths || []).filter((path) => path.id !== selectedCircularPath.id),
    }));
    setSelectedCircularPathId(null);
    setSelectedPathId(design.paths[0]?.id || null);
    setStatus(t("studio.status.elementDeleted"));
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
    if (!selectedPath) return;
    const remaining = design.paths.filter((path) => path.id !== selectedPathId);
    setDesign((current) => ({ ...current, paths: remaining }));
    setSelectedPathId(remaining[0]?.id || null);
    setStatus(t("studio.status.elementDeleted"));
  }

  function saveDesign() {
    if (!design.paths.length && !(design.circles || []).length && !(design.circularPaths || []).length) {
      setStatus(t("studio.status.emptyDesign"));
      return;
    }
    const now = new Date().toISOString();
    const currentId = design.id.startsWith("builtin-") ? null : design.id;
    const saved = {
      ...cloneDesign(design),
      id: currentId || window.crypto?.randomUUID?.() || `design-${Date.now()}`,
      createdAt: currentId ? design.createdAt : now,
      updatedAt: now,
    };
    const next = [...savedDesigns.filter((item) => !item.id.startsWith("builtin-") && item.id !== saved.id), saved];
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
    if (selectedExportId === id) setSelectedExportId(null);
    if (design.id === id) loadDesign({ ...createEmptyDesign(), name: t("studio.templates.untitled") });
    setStatus(t("studio.status.deleted"));
  }

  function resetDesign() {
    loadDesign({ ...createEmptyDesign(), name: t("studio.templates.untitled") });
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

  function renderPathControls() {
    if (!selectedPath) return null;
    return (
      <>
        <label><span>{t("studio.paths.pathName")}</span><input value={selectedPath.name} onChange={(event) => updateSelectedPath({ name: event.target.value })} /></label>
        {renderElementColorControl(selectedPath, updateSelectedPath)}
        <label className="studio-context-range"><span>{t("studio.paths.width")} {selectedPath.width.toFixed(2)}</span><input type="range" min="0.1" max="1.6" step="0.02" value={selectedPath.width} onChange={(event) => updateSelectedPath({ width: Number(event.target.value) })} /></label>
        <label className="studio-context-check"><input type="checkbox" checked={bindEndpoints} onChange={(event) => setBindEndpoints(event.target.checked)} /><span>{t("studio.controls.bindEndpoints")}</span></label>
        <button type="button" onClick={addSegment}>{t("studio.paths.addSegment")}</button>
        <button type="button" onClick={removeSegment} disabled={selectedPath.points.length <= 4}>{t("studio.paths.removeSegment")}</button>
        <button type="button" className="danger" onClick={removePath}>{t("studio.paths.removePath")}</button>
      </>
    );
  }

  function renderCircleControls() {
    if (!selectedCircle) return null;
    return (
      <>
        <label><span>{t("studio.circles.circleName")}</span><input value={selectedCircle.name} onChange={(event) => updateCircle(selectedCircle.id, { name: event.target.value })} /></label>
        {renderElementColorControl(selectedCircle, (changes) => updateCircle(selectedCircle.id, changes))}
        <label><span>{t("studio.circles.operation")}</span><select value={selectedCircle.operation} onChange={(event) => updateCircle(selectedCircle.id, { operation: event.target.value })}><option value="ink">{t("studio.circles.addColor")}</option><option value="base">{t("studio.circles.cutColor")}</option></select></label>
        <label className="studio-context-range"><span>{t("studio.circles.radius")} {selectedCircle.radius.toFixed(2)}</span><input type="range" min="0.125" max="5" step="0.125" value={selectedCircle.radius} onChange={(event) => updateCircle(selectedCircle.id, { radius: Number(event.target.value) })} /></label>
        <button type="button" className="danger" onClick={removeCircle}>{t("studio.circles.remove")}</button>
      </>
    );
  }

  function renderElementColorControl(element, update) {
    return (
      <label className="studio-context-color">
        <span>{t("studio.controls.elementColor")}</span>
        <input type="color" value={elementMaterialColor(design, element)} onChange={(event) => update({ color: event.target.value })} />
      </label>
    );
  }

  function renderCircularPathControls() {
    if (!selectedCircularPath) return null;
    const geometry = circularPathGeometry(selectedCircularPath);
    return (
      <>
        <label>
          <span>{t("studio.circularPaths.pathName")}</span>
          <input value={selectedCircularPath.name} onChange={(event) => updateCircularPath(selectedCircularPath.id, { name: event.target.value })} />
        </label>
        {renderElementColorControl(selectedCircularPath, (changes) => updateCircularPath(selectedCircularPath.id, changes))}
        <label className="studio-context-range">
          <span>{t("studio.circularPaths.width")} {selectedCircularPath.width.toFixed(2)}</span>
          <input type="range" min="0.1" max="1.6" step="0.02" value={selectedCircularPath.width} onChange={(event) => updateCircularPath(selectedCircularPath.id, { width: Number(event.target.value) })} />
        </label>
        <label>
          <span>{t("studio.circularPaths.side")}</span>
          <select value={selectedCircularPath.side} onChange={(event) => updateCircularPath(selectedCircularPath.id, { side: event.target.value })}>
            <option value="left">{t("studio.circularPaths.left")}</option>
            <option value="right">{t("studio.circularPaths.right")}</option>
          </select>
        </label>
        <span className={`studio-context-measure${geometry.mismatch ? " warning" : ""}`}>r {geometry.radius.toFixed(3)}</span>
        <button type="button" className="danger" onClick={removeCircularPath}>{t("studio.circularPaths.remove")}</button>
      </>
    );
  }

  const ports = design.paths.flatMap((path) => [
    { path, side: t("studio.ports.start"), port: nearestBoundaryPoint(path.points[0]) },
    { path, side: t("studio.ports.end"), port: nearestBoundaryPoint(path.points[path.points.length - 1]) },
  ]);
  const boundCount = ports.filter(({ port }) => port.distance < 0.0001).length;

  return (
    <section className="studio-page">
      <div className="panel studio-layout studio-builder-shell">
        <div className="studio-top-toolbar" role="toolbar" aria-label={t("studio.toolbar.aria")}>
          <div className="studio-toolbar-row studio-toolbar-main">
            <div className="studio-toolbar-identity">
              <span className="studio-product-mark">A</span>
              <div><strong>{t("studio.toolbar.studio")}</strong><small>{t("studio.toolbar.einsteinWorkspace")}</small></div>
            </div>
            <label className="studio-toolbar-name">
              <span>{t("studio.controls.name")}</span>
              <input value={design.name} onChange={(event) => setDesign((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <div className="studio-toolbar-group studio-toolbar-actions">
              <button type="button" className="primary" onClick={saveDesign}><span>⌘</span>{t("studio.actions.save")}</button>
              <button type="button" onClick={resetDesign}><span>↺</span>{t("studio.actions.reset")}</button>
            </div>
          </div>
          <div className="studio-toolbar-row studio-toolbar-ribbon">
            <div className="studio-toolbar-group studio-toolbar-create">
              <span className="studio-toolbar-label">{t("studio.toolbar.create")}</span>
              <button type="button" onClick={addCircularPath}><span>⌁</span>{t("studio.circularPaths.title")}</button>
              <button type="button" onClick={addPath}><span>⌇</span>{t("studio.paths.title")}</button>
              <button type="button" onClick={addCircle}><span>○</span>{t("studio.circles.title")}</button>
            </div>
            <div className="studio-toolbar-group studio-toolbar-templates">
              <span className="studio-toolbar-label">{t("studio.templates.title")}</span>
              <label>
                <span>▧</span>
                <select value="" onChange={(event) => applyTemplate(event.target.value)} aria-label={t("studio.templates.choose")}>
                  <option value="" disabled>{t("studio.templates.choose")}</option>
                  <option value="einstein-circular-path">{t("studio.templates.circularPath")}</option>
                </select>
              </label>
            </div>
            <div className="studio-toolbar-group studio-toolbar-settings">
              <span className="studio-toolbar-label">{t("studio.toolbar.appearance")}</span>
              <label className="studio-toolbar-color" title={t("studio.controls.baseColor")}><span>{t("studio.toolbar.tile")}</span><input type="color" value={design.colors.base} onChange={(event) => setDesign((current) => ({ ...current, colors: { ...current.colors, base: event.target.value } }))} /></label>
              <label className="studio-toolbar-color" title={t("studio.controls.curveColor")}><span>{t("studio.toolbar.material")}</span><input type="color" value={design.colors.ink} onChange={(event) => setDesign((current) => ({ ...current, colors: { ...current.colors, ink: event.target.value } }))} /></label>
            </div>
            <div className="studio-toolbar-group studio-toolbar-settings">
              <span className="studio-toolbar-label">{t("studio.toolbar.precision")}</span>
              <label className="studio-toolbar-snap"><span>{t("studio.controls.snapping")}</span><select value={snapMode} onChange={(event) => setSnapMode(event.target.value)}><option value="quarter">¼</option><option value="half">½</option><option value="grid">1</option><option value="free">{t("studio.controls.snapFree")}</option></select></label>
              <label className="studio-toolbar-toggle"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /><span>#</span><small>{t("studio.toolbar.grid")}</small></label>
              <label className="studio-toolbar-toggle"><input type="checkbox" checked={showHandles} onChange={(event) => setShowHandles(event.target.checked)} /><span>⌖</span><small>{t("studio.toolbar.handles")}</small></label>
              <label className="studio-toolbar-toggle"><input type="checkbox" checked={showEdgeNumbers} onChange={(event) => setShowEdgeNumbers(event.target.checked)} /><span className="studio-toolbar-edge-number"><span>1</span></span><small>{t("studio.toolbar.edges")}</small></label>
            </div>
          </div>
          <div className="studio-context-bar">
            <span className="studio-context-type">{selectedCircularPath ? "⌁" : selectedPath ? "⌇" : selectedCircle ? "○" : "◇"}</span>
            <strong>{selectedCircularPath ? t("studio.circularPaths.title") : selectedPath ? t("studio.paths.title") : selectedCircle ? t("studio.circles.title") : t("studio.toolbar.document")}</strong>
            {renderPathControls()}
            {renderCircleControls()}
            {renderCircularPathControls()}
            {!selectedPath && !selectedCircle && !selectedCircularPath ? <span className="studio-context-help">{t("studio.toolbar.selectHint")}</span> : null}
          </div>
        </div>

        <aside className="studio-controls studio-tool-menu" aria-label={t(treeMode === "categories" ? "studio.layers.categorized" : "studio.layers.layered")}>
          <div className="studio-tree-header">
            <div><span>{t("studio.toolbar.navigator")}</span><h2>{t(treeMode === "categories" ? "studio.layers.categorized" : "studio.layers.layered")}</h2></div>
            <div className="studio-tree-mode" role="group" aria-label={t("studio.layers.viewMode")}>
              <button type="button" className={treeMode === "categories" ? "active" : ""} onClick={() => setTreeMode("categories")} title={t("studio.layers.categories")}>▦</button>
              <button type="button" className={treeMode === "layers" ? "active" : ""} onClick={() => setTreeMode("layers")} title={t("studio.layers.layers")}>▤</button>
            </div>
          </div>
          <div className="studio-tree" role="tree">
            <button type="button" className={`studio-tree-root${!selectedPath && !selectedCircle && !selectedCircularPath ? " active" : ""}`} onClick={() => { setSelectedPathId(null); setSelectedCircleId(null); setSelectedCircularPathId(null); }}><span>◇</span><strong>{design.name}</strong><small>Einstein</small></button>
            {treeMode === "categories" ? (
              <>
                <details open>
                  <summary><span>⌁</span><strong>{t("studio.circularPaths.title")}</strong><small>{(design.circularPaths || []).length}</small></summary>
                  <div className="studio-tree-children">{(design.circularPaths || []).map((path) => <button key={path.id} type="button" className={path.id === selectedCircularPathId ? "active" : ""} onClick={() => selectLayer("circularPath", path.id)}><span>⌁</span><span>{path.name}</span><small>r {circularPathGeometry(path).radius.toFixed(2)}</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>⌇</span><strong>{t("studio.paths.title")}</strong><small>{design.paths.length}</small></summary>
                  <div className="studio-tree-children">{design.paths.map((path, index) => <button key={path.id} type="button" className={path.id === selectedPathId && !selectedCircleId && !selectedCircularPathId ? "active" : ""} onClick={() => selectLayer("path", path.id)}><span>⌇</span><span>{path.name || t("studio.paths.newName", { count: index + 1 })}</span><small>{(path.points.length - 1) / 3}C</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>○</span><strong>{t("studio.circles.title")}</strong><small>{(design.circles || []).length}</small></summary>
                  <div className="studio-tree-children">{(design.circles || []).map((circle) => <button key={circle.id} type="button" className={circle.id === selectedCircleId ? "active" : ""} onClick={() => selectLayer("circle", circle.id)}><span>○</span><span>{circle.name}</span><small>r {circle.radius.toFixed(2)}</small></button>)}</div>
                </details>
              </>
            ) : (
              <div className="studio-layer-stack">
                <div className="studio-layer-stack-label"><span>{t("studio.layers.top")}</span><small>{t("studio.layers.orderHelp")}</small></div>
                {[...getDesignLayers(design)].reverse().map(({ kind, id, item }, displayIndex, layers) => {
                  const active = (kind === "path" && id === selectedPathId && !selectedCircle && !selectedCircularPath)
                    || (kind === "circle" && id === selectedCircleId)
                    || (kind === "circularPath" && id === selectedCircularPathId);
                  return (
                    <div className={`studio-layer-row${active ? " active" : ""}`} key={`${kind}:${id}`}>
                      <button type="button" className="studio-layer-select" onClick={() => selectLayer(kind, id)}><span>{kind === "path" ? "⌇" : kind === "circle" ? "○" : "⌁"}</span><span>{item.name}</span><small>{t(`studio.layers.${kind}`)}</small></button>
                      <div className="studio-layer-actions">
                        <button type="button" onClick={() => moveLayer(kind, id, 1)} disabled={displayIndex === 0} title={t("studio.layers.moveUp")}>↑</button>
                        <button type="button" onClick={() => moveLayer(kind, id, -1)} disabled={displayIndex === layers.length - 1} title={t("studio.layers.moveDown")}>↓</button>
                      </div>
                    </div>
                  );
                })}
                <div className="studio-layer-stack-label bottom"><span>{t("studio.layers.bottom")}</span></div>
              </div>
            )}
          </div>
          <div className="studio-tree-footer">
            {design.paths.length ? <div className="studio-port-summary"><strong>{boundCount}/{ports.length}</strong><span>{t("studio.ports.bound")}</span></div> : null}
            {status ? <p className="studio-status" role="status">{status}</p> : <p>{t("studio.toolbar.ready")}</p>}
          </div>
        </aside>

        <main className="studio-workbench">
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
              <DesignLayerShapes
                design={design}
                mapper={toCanvas}
                strokeScale={CANVAS.scale}
                onSelect={selectLayer}
                selectedPathId={selectedPathId}
                selectedCircleId={selectedCircleId}
                selectedCircularPathId={selectedCircularPathId}
              />
            </g>
            <polygon className="studio-tile-outline" points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} />
            {showEdgeNumbers ? HAT_CARTESIAN.map((point, index) => {
              const next = HAT_CARTESIAN[(index + 1) % HAT_CARTESIAN.length];
              const label = toCanvas(cartesianToLattice({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }));
              return <g className="studio-edge-label" key={index}><circle cx={label.x} cy={label.y} r="11" /><text x={label.x} y={label.y + 3.5}>{index + 1}</text></g>;
            }) : null}
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
          <div
            className={`studio-transform-dock${transformExpanded ? " expanded" : ""}`}
            onPointerDown={(event) => {
              if (transformExpanded && event.target === event.currentTarget) setTransformExpanded(false);
            }}
          >
            <section className="studio-transform-widget" onClick={() => { if (!transformExpanded) setTransformExpanded(true); }}>
              <button type="button" className="studio-transform-toggle" onClick={() => setTransformExpanded((current) => !current)} aria-expanded={transformExpanded} aria-label={t(transformExpanded ? "studio.preview.collapse" : "studio.preview.expand")}>
                <span aria-hidden="true">{transformExpanded ? "↙" : "↗"}</span>
              </button>
              <ClusterPreview design={design} />
              <span className="studio-flip-key"><b>M</b>: {t("studio.preview.flipped")}</span>
            </section>
          </div>
          <div className="studio-canvas-legend">
            <span><i className="legend-anchor" />{t("studio.canvas.anchor")}</span>
            <span><i className="legend-control" />{t("studio.canvas.control")}</span>
            <span><i className="legend-port" />{t("studio.canvas.port")}</span>
          </div>
        </main>
      </div>

      <section className="studio-lower-grid">
        <div className="panel studio-library-panel">
          <div className="studio-panel-heading">
            <div><h2>{t("studio.library.title")}</h2></div>
          </div>
          <p className="studio-library-note">{t("studio.library.localNote")}</p>
          <div className="studio-library-grid">
            {savedDesigns.map((item) => (
              <article
                className={`studio-design-card${selectedExportId === item.id ? " selected" : ""}`}
                key={item.id}
                role="button"
                tabIndex="0"
                aria-pressed={selectedExportId === item.id}
                onClick={() => setSelectedExportId(item.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || !["Enter", " "].includes(event.key)) return;
                  event.preventDefault();
                  setSelectedExportId(item.id);
                }}
              >
                <MiniDesign design={item} />
                <div><strong>{item.name}</strong><small>{item.id.startsWith("builtin-") ? t("studio.library.builtin") : t("studio.library.local")}</small></div>
                <div className="studio-card-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); loadDesign(item); }}>{t("studio.library.load")}</button>
                  {!item.id.startsWith("builtin-") ? <button type="button" onClick={(event) => { event.stopPropagation(); deleteDesign(item.id); }}>{t("studio.library.delete")}</button> : null}
                </div>
              </article>
            ))}
            {!savedDesigns.length ? <p className="studio-library-empty">{t("studio.library.empty")}</p> : null}
          </div>
          <div className="studio-library-actions">
            <button className="button button-green small" type="button" disabled={!selectedExportDesign} onClick={() => downloadBlob(`${safeFilename(selectedExportDesign.name)}.json`, JSON.stringify(selectedExportDesign, null, 2), "application/json")}>{t("studio.actions.exportJson")}</button>
            <button className="button button-ink small" type="button" disabled={!selectedExportDesign} onClick={() => downloadBlob(`${safeFilename(selectedExportDesign.name)}.svg`, exportSvg(selectedExportDesign), "image/svg+xml")}>{t("studio.actions.exportSvg")}</button>
            <button className="button button-muted small" type="button" onClick={() => importRef.current?.click()}>{t("studio.actions.import")}</button>
            <input ref={importRef} className="studio-file-input" type="file" accept="application/json,.json" onChange={handleImport} />
          </div>
        </div>
      </section>
    </section>
  );
}

function DesignLayerShapes({ design, mapper, strokeScale, onSelect, selectedPathId, selectedCircleId, selectedCircularPathId }) {
  return getDesignLayers(design).map(({ kind, id, item }) => {
    if (kind === "circle") {
      const center = mapper(item.center);
      return <circle key={`${kind}:${id}`} className="studio-material-circle" cx={center.x} cy={center.y} r={item.radius * strokeScale} fill={item.operation === "ink" ? elementMaterialColor(design, item) : design.colors.base} onPointerDown={onSelect ? () => onSelect(kind, id) : undefined} />;
    }
    const isSelected = kind === "path" ? id === selectedPathId : id === selectedCircularPathId;
    return (
      <path
        key={`${kind}:${id}`}
        className={`studio-material-path${kind === "circularPath" ? " studio-circular-material-path" : ""}${isSelected ? " selected" : ""}`}
        d={kind === "path" ? bezierPath(item.points, mapper) : circularPathD(item, mapper)}
        fill="none"
        stroke={elementMaterialColor(design, item)}
        strokeWidth={item.width * strokeScale}
        strokeLinecap="round"
        strokeLinejoin="round"
        onPointerDown={onSelect ? () => onSelect(kind, id) : undefined}
      />
    );
  });
}

function ClusterPreview({ design }) {
  return (
    <svg className="studio-cluster-preview" viewBox={`${H_CLUSTER_VIEWBOX.x} ${H_CLUSTER_VIEWBOX.y} ${H_CLUSTER_VIEWBOX.width} ${H_CLUSTER_VIEWBOX.height}`} aria-label="Transformed Einstein material preview">
      <rect {...H_CLUSTER_VIEWBOX} fill="#fffdf8" />
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
              <DesignLayerShapes design={design} mapper={mapper} strokeScale={Math.sqrt(Math.abs(determinant)) * 78} />
            </g>
            <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice), mapper)} fill="none" stroke="#17313b" strokeWidth="1.5" strokeLinejoin="round" />
            {determinant > 0 ? <text className="studio-mirror-label" x={mapper({ u: 1.5, v: 0 }).x} y={mapper({ u: 1.5, v: 0 }).y}>M</text> : null}
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
        <DesignLayerShapes design={design} mapper={toCanvas} strokeScale={CANVAS.scale} />
      </g>
      <polygon points={pointsAttribute(HAT_CARTESIAN.map(cartesianToLattice))} fill="none" stroke="#17313b" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}
