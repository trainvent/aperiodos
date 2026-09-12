import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  cartesianToLattice,
  circleHandlePoint,
  circleThroughVertex,
  commonTileBaseColor,
  circularPathGeometry,
  cloneDesign,
  createEmptyDesign,
  elementMaterialColor,
  getDesignLayers,
  latticeToCartesian,
  normalizeLayerOrder,
  setDefaultMaterialColor,
  setTileBaseColor,
  setTileBaseColors,
  snapCircleHandle,
  tileBaseColor,
  validateDesign,
} from "./einsteinGeometry";
import { getStudioLibraryDesigns, writeStudioLibrary } from "./patternLibrary";
import { renderBrowserPreview } from "../../lib/rendererPreview";
import StudioFamilySwitch from "./StudioFamilySwitch";
import MaterialLayerShapes from "./MaterialLayerShapes";
import { geometryAdapterFor, penroseTileEditorGeometry, snapCartesianPoint } from "./studioGeometryAdapters";
import {
  InspectorActions,
  InspectorGroup,
  InspectorMetric,
  InspectorPanel,
} from "./widgets/InspectorPanel";
import {
  InspectorColorField,
  InspectorRangeField,
  InspectorSelectField,
  InspectorTextField,
  InspectorToggleField,
} from "./widgets/InspectorFields";
import StudioSurface from "./widgets/StudioSurface";
import { loadStudioRuntime, studioCall } from "./studioRuntime";
import { transformedMaterialScale } from "./previewGeometry";

const CANVAS = { width: 760, height: 620, scale: 82, originX: 270, originY: 330 };
const H_CLUSTER_VIEWBOX = { x: -65.5, y: -86, width: 540, height: 432 };

function canvasScaleFor(geometry) {
  if (!geometry.fitCanvas) return CANVAS.scale;
  const points = geometry.allPoints || geometry.points;
  const bounds = points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y),
    maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const padding = 120;
  return Math.min(
    (CANVAS.width - padding * 2) / Math.max(bounds.maxX - bounds.minX, 0.5),
    (CANVAS.height - padding * 2) / Math.max(bounds.maxY - bounds.minY, 0.5),
  );
}

function toCanvasCartesian(cartesian, scale = CANVAS.scale) {
  return {
    x: CANVAS.width - (CANVAS.originX + cartesian.x * scale),
    y: CANVAS.height - (CANVAS.originY - cartesian.y * scale),
  };
}

function toCanvas(point, scale = CANVAS.scale, geometry) {
  const materialPoint = latticeToCartesian(point);
  return toCanvasCartesian(geometry?.materialToShape ? geometry.materialToShape(materialPoint) : materialPoint, scale);
}

function canvasOffsetFor(geometry) {
  if (!geometry.centerCanvas) return { x: 0, y: 0 };
  const scale = canvasScaleFor(geometry);
  const points = (geometry.allPoints || geometry.points).map((point) => toCanvasCartesian(point, scale));
  const bounds = points.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y),
    maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  return {
    x: CANVAS.width / 2 - (bounds.minX + bounds.maxX) / 2,
    y: CANVAS.height / 2 - (bounds.minY + bounds.maxY) / 2,
  };
}

function canvasMapperFor(geometry) {
  const offset = canvasOffsetFor(geometry);
  const scale = canvasScaleFor(geometry);
  const mapper = (point) => {
    const mapped = toCanvas(point, scale, geometry);
    return { x: mapped.x + offset.x, y: mapped.y + offset.y };
  };
  mapper.scale = scale * (geometry.materialScale || 1);
  return mapper;
}

function fromGeometryCanvas(point, geometry) {
  const offset = canvasOffsetFor(geometry);
  const scale = canvasScaleFor(geometry);
  const shapePoint = {
    x: (CANVAS.width - (point.x - offset.x) - CANVAS.originX) / scale,
    y: (point.y - offset.y + CANVAS.originY - CANVAS.height) / scale,
  };
  const materialPoint = geometry.shapeToMaterial ? geometry.shapeToMaterial(shapePoint) : shapePoint;
  return cartesianToLattice(materialPoint);
}

function circleHandleCanvas(circle, geometry, mapper) {
  if (!geometry.materialToShape) return mapper(circleHandlePoint(circle));
  const center = mapper(circle.center);
  const angle = (circle.handleAngle ?? 0) * Math.PI / 180;
  return {
    x: center.x - Math.cos(angle) * circle.radius * mapper.scale,
    y: center.y + Math.sin(angle) * circle.radius * mapper.scale,
  };
}

function pointsAttribute(points, mapper = toCanvas) {
  return points.map((point) => {
    const mapped = mapper(point);
    return `${mapped.x.toFixed(2)},${mapped.y.toFixed(2)}`;
  }).join(" ");
}

function cartesianPointsAttribute(points, mapper) {
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

function linePath(points, mapper = toCanvas) {
  if (points.length !== 2) return "";
  const [start, end] = points.map(mapper);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function circularPathD(path, mapper = toCanvas) {
  const segments = circularPathGeometry(path).segments || [];
  return segments.map((points) => points.map((point, index) => {
    const mapped = mapper(point);
    return `${index ? "L" : "M"} ${mapped.x.toFixed(2)} ${mapped.y.toFixed(2)}`;
  }).join(" ")).join(" ");
}

function transformCartesian(point, transform) {
  const cartesian = latticeToCartesian(point);
  return {
    x: transform[0] * cartesian.x + transform[1] * cartesian.y + transform[2],
    y: transform[3] * cartesian.x + transform[4] * cartesian.y + transform[5],
  };
}

function clusterMapper(transform) {
  const mapper = (point) => {
    const transformed = transformCartesian(point, transform);
    return { x: 68 + transformed.x * 78, y: 282 + transformed.y * 78 };
  };
  mapper.scale = transformedMaterialScale(78, transform);
  return mapper;
}

function fittedClusterMappers(transforms, geometry) {
  const previewAngle = (geometry.previewRotation || 0) * Math.PI / 180;
  const previewCos = Math.cos(previewAngle);
  const previewSin = Math.sin(previewAngle);
  const project = (point) => {
    const reflected = geometry.previewReflectX ? { ...point, x: -point.x } : point;
    return {
      x: previewCos * reflected.x - previewSin * reflected.y,
      y: previewSin * reflected.x + previewCos * reflected.y,
    };
  };
  const transformedPoints = transforms.flatMap((transform) => (geometry.allPoints || geometry.points).map((point) => (
    project(transformCartesian(cartesianToLattice(point), transform))
  )));
  const bounds = transformedPoints.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minY: Math.min(result.minY, point.y),
    maxY: Math.max(result.maxY, point.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const padding = 18;
  const scale = Math.min(
    (H_CLUSTER_VIEWBOX.width - padding * 2) / (bounds.maxX - bounds.minX),
    (H_CLUSTER_VIEWBOX.height - padding * 2) / (bounds.maxY - bounds.minY),
  );
  const contentWidth = (bounds.maxX - bounds.minX) * scale;
  const contentHeight = (bounds.maxY - bounds.minY) * scale;
  const startX = H_CLUSTER_VIEWBOX.x + (H_CLUSTER_VIEWBOX.width - contentWidth) / 2;
  const startY = H_CLUSTER_VIEWBOX.y + (H_CLUSTER_VIEWBOX.height - contentHeight) / 2;
  return transforms.map((transform) => {
    const mapper = (point) => {
      const transformed = project(transformCartesian(point, transform));
      return {
        x: startX + (transformed.x - bounds.minX) * scale,
        y: startY + (transformed.y - bounds.minY) * scale,
      };
    };
    mapper.scale = transformedMaterialScale(scale, transform);
    return mapper;
  });
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

function materialMatchesTile(item, tileType) {
  return !item.tileType
    || item.tileType === tileType
    || (item.tileType === "pentagon" && tileType?.startsWith("pentagon-"));
}

function exportSvg(design, geometry = geometryAdapterFor(design.tile === "spectre" ? "spectre" : "einstein")) {
  return studioCall("exportSvg", { design, tileType: geometry.activeTileType });
}

export default function StudioPage() {
  const [runtimeState, setRuntimeState] = useState("loading");
  useEffect(() => {
    let active = true;
    loadStudioRuntime().then(
      () => { if (active) setRuntimeState("ready"); },
      () => { if (active) setRuntimeState("failed"); },
    );
    return () => { active = false; };
  }, []);
  if (runtimeState === "loading") return <div className="studio-preview-loading">Loading Studio geometry…</div>;
  if (runtimeState === "failed") return <div className="studio-preview-loading">Studio geometry could not be loaded.</div>;
  return <LoadedStudioPage />;
}

function LoadedStudioPage() {
  const [family, setFamily] = useState("einstein");
  const [drafts, setDrafts] = useState({});
  const [lineWidths, setLineWidths] = useState({ einstein: 0.7, spectre: 0.7, "penrose-kite-dart": 0.7, "penrose-rhombs": 0.7, "penrose-p1": 0.7 });
  const cacheDraft = useCallback((draftFamily, design) => {
    setDrafts((current) => current[draftFamily] === design ? current : { ...current, [draftFamily]: design });
  }, []);
  const cacheLineWidth = useCallback((draftFamily, width) => {
    setLineWidths((current) => current[draftFamily] === width ? current : { ...current, [draftFamily]: width });
  }, []);
  return <MaterialStudioEditor key={family} family={family} onFamilyChange={setFamily} cachedDesign={drafts[family]} onDraftChange={cacheDraft} cachedLineWidth={lineWidths[family]} onLineWidthChange={cacheLineWidth} />;
}

function MaterialStudioEditor({ family, onFamilyChange, cachedDesign, onDraftChange, cachedLineWidth, onLineWidthChange }) {
  const { t } = useTranslation("common");
  const familyGeometry = useMemo(() => geometryAdapterFor(family), [family]);
  const [activePenroseTileType, setActivePenroseTileType] = useState(() => familyGeometry.editorShapes?.[0]?.tileType || "");
  const geometry = useMemo(() => familyGeometry.tile === "penrose"
    ? penroseTileEditorGeometry(familyGeometry, activePenroseTileType)
    : familyGeometry, [familyGeometry, activePenroseTileType]);
  const mapToCanvas = useMemo(() => canvasMapperFor(geometry), [geometry]);
  const emptyDesign = () => {
    const empty = {
      ...createEmptyDesign(geometry.tile),
      ...(geometry.tileMode ? { tileMode: geometry.tileMode } : {}),
      name: family === "spectre" ? t("studio.spectre.untitled") : geometry.tile === "penrose" ? `Untitled ${familyGeometry.label} pattern` : t("studio.templates.untitled"),
    };
    if (geometry.tile === "penrose") {
      empty.tileColors = Object.fromEntries(
        familyGeometry.editorShapes.map((shape) => [shape.tileType, empty.colors.base]),
      );
    }
    return empty;
  };
  const [design, setDesign] = useState(() => cachedDesign ? cloneDesign(cachedDesign) : emptyDesign());
  const [selectedPolygonId, setSelectedPolygonId] = useState(null);
  const [selectedPathId, setSelectedPathId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [selectedCircleId, setSelectedCircleId] = useState(null);
  const [selectedCircularPathId, setSelectedCircularPathId] = useState(null);
  const [snapMode, setSnapMode] = useState("half");
  const [showGrid, setShowGrid] = useState(true);
  const [gridMode, setGridMode] = useState(geometry.defaultGridMode || (family === "spectre" ? "cartesian" : "construction"));
  const [showHandles, setShowHandles] = useState(true);
  const [showEdgeNumbers, setShowEdgeNumbers] = useState(false);
  const [bindEndpoints, setBindEndpoints] = useState(true);
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [selectedExportId, setSelectedExportId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [status, setStatus] = useState("");
  const [treeMode, setTreeMode] = useState("layers");
  const [transformExpanded, setTransformExpanded] = useState(false);
  const [tileColorScope, setTileColorScope] = useState("current");
  const [integratingId, setIntegratingId] = useState(null);
  const importRef = useRef(null);
  const snapStep = snapMode === "grid" ? 1 : snapMode === "half" ? 0.5 : snapMode === "quarter" ? 0.25 : 0;
  const grid = useMemo(() => (gridMode === "cartesian"
    ? geometry.cartesianGridLines
    : geometry.gridLines) || [], [geometry, gridMode]);
  const constructionSnapFractions = gridMode !== "construction"
    || family === "einstein"
    || (geometry.constructionPoints || []).length > 0
    ? []
    : snapMode === "quarter"
      ? [0.25, 0.5, 0.75]
      : snapMode === "half"
        ? [0.5]
        : [];
  const constructionLatticeSnapPoints = useMemo(() => {
    if (family !== "einstein" || gridMode !== "construction" || !snapStep) return [];
    const corners = [
      fromGeometryCanvas({ x: 0, y: 0 }, geometry),
      fromGeometryCanvas({ x: CANVAS.width, y: 0 }, geometry),
      fromGeometryCanvas({ x: 0, y: CANVAS.height }, geometry),
      fromGeometryCanvas({ x: CANVAS.width, y: CANVAS.height }, geometry),
    ];
    const minU = Math.floor(Math.min(...corners.map((point) => point.u)) / snapStep) - 1;
    const maxU = Math.ceil(Math.max(...corners.map((point) => point.u)) / snapStep) + 1;
    const minV = Math.floor(Math.min(...corners.map((point) => point.v)) / snapStep) - 1;
    const maxV = Math.ceil(Math.max(...corners.map((point) => point.v)) / snapStep) + 1;
    const points = [];
    for (let uIndex = minU; uIndex <= maxU; uIndex += 1) {
      for (let vIndex = minV; vIndex <= maxV; vIndex += 1) {
        const point = mapToCanvas({ u: uIndex * snapStep, v: vIndex * snapStep });
        if (point.x >= 0 && point.x <= CANVAS.width && point.y >= 0 && point.y <= CANVAS.height) {
          points.push({ ...point, key: `${uIndex}:${vIndex}` });
        }
      }
    }
    return points;
  }, [family, geometry, gridMode, mapToCanvas, snapStep]);
  const selectedCircle = (design.circles || []).find((circle) => circle.id === selectedCircleId);
  const selectedCircularPath = (design.circularPaths || []).find((path) => path.id === selectedCircularPathId);
  const selectedLine = (design.lines || []).find((line) => line.id === selectedLineId);
  const selectedPolygon = (design.polygons || []).find((polygon) => polygon.id === selectedPolygonId);
  const selectedPath = !selectedPolygon && !selectedLine && !selectedCircle && !selectedCircularPath
    ? design.paths.find((path) => path.id === selectedPathId) || (selectedPathId ? design.paths[0] : null)
    : null;
  const visibleMaterialLayers = useMemo(() => getDesignLayers(design).filter(({ item }) => (
    geometry.tile !== "penrose" || materialMatchesTile(item, activePenroseTileType)
  )), [design, geometry.tile, activePenroseTileType]);
  const navigatorLayersByKind = useMemo(() => Object.fromEntries(
    ["polygon", "path", "line", "circle", "circularPath"].map((kind) => [kind, visibleMaterialLayers.filter((layer) => layer.kind === kind)]),
  ), [visibleMaterialLayers]);
  const penroseTileLayerCounts = useMemo(() => Object.fromEntries(
    (familyGeometry.editorShapes || []).map((shape) => [
      shape.tileType,
      getDesignLayers(design).filter(({ item }) => materialMatchesTile(item, shape.tileType)).length,
    ]),
  ), [design, familyGeometry.editorShapes]);
  const familyDesigns = savedDesigns.filter((item) => item.tile === geometry.tile && (geometry.tile !== "penrose" || item.tileMode === geometry.tileMode));
  const selectedExportDesign = familyDesigns.find((item) => item.id === selectedExportId) || null;
  const penroseTileTypes = familyGeometry.editorShapes?.map((shape) => shape.tileType) || [];
  const activeTileName = familyGeometry.editorShapes?.find((shape) => shape.tileType === activePenroseTileType)?.name || activePenroseTileType;
  const activeTileBaseColor = geometry.tile === "penrose"
    ? tileBaseColor(design, activePenroseTileType)
    : design.colors.base;
  const editAllPenroseTiles = geometry.tile === "penrose" && tileColorScope === "all";
  const commonPenroseTileColor = geometry.tile === "penrose"
    ? commonTileBaseColor(design, penroseTileTypes)
    : design.colors.base;
  const displayedTileBaseColor = editAllPenroseTiles ? commonPenroseTileColor : activeTileBaseColor;
  const updateDisplayedTileBaseColor = (color) => setDesign((current) => (
    editAllPenroseTiles
      ? setTileBaseColors(current, penroseTileTypes, color)
      : geometry.tile === "penrose"
      ? setTileBaseColor(current, activePenroseTileType, color)
      : { ...current, colors: { ...current.colors, base: color } }
  ));
  const scopeNewElement = (element) => geometry.tile === "penrose" && activePenroseTileType
    ? { ...element, tileType: activePenroseTileType }
    : element;

  function selectPenroseTileType(tileType) {
    setActivePenroseTileType(tileType);
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
    setDrag(null);
  }

  useEffect(() => {
    onDraftChange(family, design);
  }, [design, family, onDraftChange]);

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

  function swapLayerPositions(kind, id, neighborKind, neighborId) {
    setDesign((current) => {
      const order = normalizeLayerOrder(current);
      const index = order.findIndex((entry) => entry.kind === kind && entry.id === id);
      const target = order.findIndex((entry) => entry.kind === neighborKind && entry.id === neighborId);
      if (index < 0 || target < 0) return current;
      const next = [...order];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, layerOrder: next };
    });
  }

  function selectLayer(kind, id) {
    setSelectedPolygonId(kind === "polygon" ? id : null);
    setSelectedPathId(kind === "path" ? id : null);
    setSelectedLineId(kind === "line" ? id : null);
    setSelectedCircleId(kind === "circle" ? id : null);
    setSelectedCircularPathId(kind === "circularPath" ? id : null);
    setDrag(null);
  }

  function clearSelection() {
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
    setDrag(null);
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

  function updatePolygon(polygonId, changes) {
    setDesign((current) => ({
      ...current,
      polygons: (current.polygons || []).map((polygon) => polygon.id === polygonId ? { ...polygon, ...changes } : polygon),
    }));
  }

  function updateCircle(circleId, changes) {
    setDesign((current) => ({
      ...current,
      circles: (current.circles || []).map((circle) => {
        if (circle.id !== circleId) return circle;
        const updated = { ...circle, ...changes };
        if (updated.width != null) updated.width = Math.min(updated.width, updated.radius);
        return updated;
      }),
    }));
  }

  function updateLine(lineId, changes) {
    setDesign((current) => ({
      ...current,
      lines: (current.lines || []).map((line) => line.id === lineId ? { ...line, ...changes } : line),
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

  function snapEditorPoint(point, step) {
    if (!step) return point;
    return gridMode === "cartesian"
      ? (geometry.snapCartesianPoint || snapCartesianPoint)(point, step * geometry.cartesianGridStep)
      : geometry.snapPoint(point, step);
  }

  function radiusSnapStep(step) {
    return gridMode === "cartesian" ? step * geometry.cartesianRadiusStep : step;
  }

  function tileVertexSnap(point, canvasPoint) {
    if (!geometry.materialVertices?.length) return { point, snapped: false };
    const nearest = geometry.materialVertices
      .map((vertex) => ({ vertex, screen: mapToCanvas(vertex) }))
      .map(({ vertex, screen }) => ({ vertex, distance: Math.hypot(screen.x - canvasPoint.x, screen.y - canvasPoint.y) }))
      .reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
    return nearest.distance <= 18
      ? { point: nearest.vertex, snapped: true }
      : { point, snapped: false };
  }

  function snapTileVertex(point, canvasPoint) {
    return tileVertexSnap(point, canvasPoint).point;
  }

  function handlePointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const canvasPoint = pointerPosition(event);
    let point = fromGeometryCanvas(canvasPoint, geometry);
    if (drag.kind === "circle-center") {
      updateCircle(drag.circleId, { center: snapTileVertex(snapEditorPoint(point, snapStep), canvasPoint) });
      return;
    }
    if (drag.kind === "circle-radius") {
      const circle = (design.circles || []).find((candidate) => candidate.id === drag.circleId);
      const latticeStep = radiusSnapStep(snapStep);
      const angleStep = snapMode === "free" ? 0 : 30;
      const corner = tileVertexSnap(point, canvasPoint);
      if (corner.snapped) {
        updateCircle(drag.circleId, circleThroughVertex(
          geometry.family,
          geometry.activeTileType,
          circle.center,
          corner.point,
        ));
        return;
      }
      if (gridMode === "construction" && geometry.materialToShape && snapStep) {
        const constructionPoint = snapEditorPoint(point, snapStep);
        updateCircle(drag.circleId, circleThroughVertex(
          geometry.family,
          geometry.activeTileType,
          circle.center,
          constructionPoint,
        ));
        return;
      }
      if (geometry.materialToShape) {
        const center = mapToCanvas(circle.center);
        const rawRadius = Math.hypot(canvasPoint.x - center.x, canvasPoint.y - center.y) / mapToCanvas.scale;
        const rawAngle = Math.atan2(canvasPoint.y - center.y, center.x - canvasPoint.x) * 180 / Math.PI;
        const handleAngle = ((angleStep ? Math.round(rawAngle / angleStep) * angleStep : rawAngle) % 360 + 360) % 360;
        const radius = latticeStep ? Math.round(rawRadius / latticeStep) * latticeStep : rawRadius;
        updateCircle(drag.circleId, { radius: Math.max(0.125, radius), handleAngle });
        return;
      }
      updateCircle(drag.circleId, snapCircleHandle(circle.center, point, latticeStep, angleStep));
      return;
    }
    if (drag.kind === "circular-path") {
      const circularPath = (design.circularPaths || []).find((candidate) => candidate.id === drag.pathId);
      point = snapTileVertex(snapEditorPoint(point, snapStep), canvasPoint);
      const points = circularPath.points.map((existing, index) => index === drag.pointIndex ? point : existing);
      updateCircularPath(drag.pathId, { points });
      return;
    }
    if (drag.kind === "polygon") {
      const polygon = (design.polygons || []).find((candidate) => candidate.id === drag.polygonId);
      point = snapTileVertex(snapEditorPoint(point, snapStep), canvasPoint);
      const points = polygon.points.map((existing, index) => index === drag.pointIndex ? point : existing);
      updatePolygon(drag.polygonId, { points });
      return;
    }
    if (drag.kind === "line") {
      const line = (design.lines || []).find((candidate) => candidate.id === drag.lineId);
      point = snapTileVertex(snapEditorPoint(point, snapStep), canvasPoint);
      if (bindEndpoints && gridMode !== "cartesian") point = geometry.nearestBoundary(point).point;
      const points = line.points.map((existing, index) => index === drag.pointIndex ? point : existing);
      updateLine(drag.lineId, { points });
      return;
    }
    const path = design.paths.find((candidate) => candidate.id === drag.pathId);
    const isEndpoint = drag.pointIndex === 0 || drag.pointIndex === path.points.length - 1;
    point = snapTileVertex(snapEditorPoint(point, snapStep), canvasPoint);
    if (bindEndpoints && isEndpoint) {
      point = geometry.nearestBoundary(point).point;
    }
    updatePoint(drag.pathId, drag.pointIndex, point);
  }

  function stopDragging(event) {
    if (drag && event.pointerId === drag.pointerId) setDrag(null);
  }

  function beginDragging(event, pathId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPolygonId(null);
    setSelectedPathId(pathId);
    setSelectedLineId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
    setDrag({ kind: "path", pathId, pointIndex, pointerId: event.pointerId });
  }

  function beginPolygonDragging(event, polygonId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    selectLayer("polygon", polygonId);
    setDrag({ kind: "polygon", polygonId, pointIndex, pointerId: event.pointerId });
  }

  function beginLineDragging(event, lineId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(lineId);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
    setDrag({ kind: "line", lineId, pointIndex, pointerId: event.pointerId });
  }

  function beginCircleDragging(event, kind, circleId) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
    setSelectedCircleId(circleId);
    setSelectedCircularPathId(null);
    setDrag({ kind, circleId, pointerId: event.pointerId });
  }

  function beginCircularPathDragging(event, pathId, pointIndex) {
    event.preventDefault();
    event.currentTarget.ownerSVGElement.setPointerCapture(event.pointerId);
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
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
    const defaultPoints = geometry.defaultElements?.pathPoints;
    const draft = {
      id,
      name: t("studio.paths.newName", { count: design.paths.length + 1 }),
      width: 0.7,
      points: defaultPoints || [
        { u: -0.5, v: 1 },
        { u: 0.5, v: 1 },
        { u: 1.5, v: 0 },
        { u: 2.5, v: -1 },
      ],
    };
    const points = [...draft.points];
    points[0] = geometry.nearestBoundary(points[0]).point;
    points[points.length - 1] = geometry.nearestBoundary(points[points.length - 1]).point;
    const path = scopeNewElement({ ...draft, points });
    setDesign((current) => ({ ...current, paths: [...current.paths, path] }));
    setSelectedPolygonId(null);
    setSelectedPathId(id);
    setSelectedLineId(null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(null);
  }

  function addPolygon() {
    const id = `polygon-${Date.now()}`;
    const vertices = geometry.materialVertices || [];
    const polygon = scopeNewElement({
      id,
      name: t("studio.polygons.newName", { count: (design.polygons || []).length + 1 }),
      strokeColor: design.outline || "#17313b",
      width: 0.05,
      points: (geometry.defaultElements?.polygonPoints || vertices.slice(0, 4)).map((point) => ({ ...point })),
    });
    setDesign((current) => ({ ...current, polygons: [...(current.polygons || []), polygon] }));
    selectLayer("polygon", id);
  }

  function removePolygon() {
    if (!selectedPolygon) return;
    setDesign((current) => ({ ...current, polygons: (current.polygons || []).filter((polygon) => polygon.id !== selectedPolygon.id) }));
    setSelectedPolygonId(null);
    setStatus(t("studio.status.elementDeleted"));
  }

  function addPolygonPoint() {
    if (!selectedPolygon) return;
    const points = selectedPolygon.points;
    const first = points[0];
    const last = points[points.length - 1];
    updatePolygon(selectedPolygon.id, { points: [...points, { u: (first.u + last.u) / 2, v: (first.v + last.v) / 2 }] });
  }

  function removePolygonPoint() {
    if (!selectedPolygon || selectedPolygon.points.length <= 3) return;
    updatePolygon(selectedPolygon.id, { points: selectedPolygon.points.slice(0, -1) });
  }

  function addLine() {
    const id = `line-${Date.now()}`;
    const points = geometry.defaultElements?.linePoints || [
      geometry.nearestBoundary({ u: -0.5, v: 1 }).point,
      geometry.nearestBoundary({ u: 2.5, v: -1 }).point,
    ];
    const line = scopeNewElement({
      id,
      name: t("studio.lines.newName", { count: (design.lines || []).length + 1 }),
      width: cachedLineWidth,
      points,
    });
    setDesign((current) => ({ ...current, lines: [...(current.lines || []), line] }));
    selectLayer("line", id);
  }

  function addCircle() {
    const id = `circle-${Date.now()}`;
    const circle = scopeNewElement({
      id,
      name: t("studio.circles.newName", { count: (design.circles || []).length + 1 }),
      center: geometry.defaultElements?.circleCenter || { u: 1, v: 1 },
      radius: geometry.defaultElements?.circleRadius || 1,
      handleAngle: 0,
      operation: "ink",
      hollow: false,
      width: 0.05,
    });
    setDesign((current) => ({ ...current, circles: [...(current.circles || []), circle] }));
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
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
    const circularPath = scopeNewElement({
      id,
      name: t("studio.circularPaths.newName", { count: (design.circularPaths || []).length + 1 }),
      width: 0.7,
      side: "left",
      points: geometry.defaultElements?.circularPathPoints || [{ u: 0, v: 1 }, { u: 1, v: 1 }, { u: 1, v: 0 }],
    });
    setDesign((current) => ({ ...current, circularPaths: [...(current.circularPaths || []), circularPath] }));
    setSelectedPolygonId(null);
    setSelectedPathId(null);
    setSelectedLineId(null);
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
      geometry.nearestBoundary({ u: anchor.u + 1.5, v: anchor.v + 0.5 }).point,
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

  function removeLine() {
    if (!selectedLine) return;
    setDesign((current) => ({ ...current, lines: (current.lines || []).filter((line) => line.id !== selectedLine.id) }));
    setSelectedLineId(null);
    setStatus(t("studio.status.elementDeleted"));
  }

  function saveDesign() {
    const hasP1RhombOverlay = design.tile === "penrose" && design.tileMode === "p1" && design.penroseOverlay?.enabled;
    if (!hasP1RhombOverlay && !(design.polygons || []).length && !design.paths.length && !(design.lines || []).length && !(design.circles || []).length && !(design.circularPaths || []).length) {
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
    setSelectedPolygonId(loaded.polygons?.[0]?.id || null);
    setSelectedPathId(loaded.polygons?.length ? null : loaded.paths[0]?.id || null);
    setSelectedLineId(loaded.polygons?.length || loaded.paths.length ? null : loaded.lines?.[0]?.id || null);
    setSelectedCircleId(null);
    setSelectedCircularPathId(loaded.polygons?.length || loaded.paths.length || loaded.lines?.length ? null : loaded.circularPaths?.[0]?.id || null);
    setStatus(t("studio.status.loaded"));
  }

  function deleteDesign(id) {
    persistLibrary(savedDesigns.filter((item) => item.id !== id));
    if (selectedExportId === id) setSelectedExportId(null);
    if (design.id === id) loadDesign(emptyDesign());
    setStatus(t("studio.status.deleted"));
  }

  async function integrateDesign(item) {
    setIntegratingId(item.id);
    try {
      const response = await fetch("/api/dev/studio-patterns/integrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Integration failed.");
      setSavedDesigns(await getStudioLibraryDesigns());
      setSelectedExportId(result.design.id);
      setStatus(t("studio.status.integrated"));
    } catch {
      setStatus(t("studio.status.integrationFailed"));
    } finally {
      setIntegratingId(null);
    }
  }

  async function disintegrateDesign(item) {
    if (!window.confirm(t("studio.library.disintegrateConfirm", { name: item.name }))) return;
    setIntegratingId(item.id);
    try {
      const existingLocal = savedDesigns.find((candidate) => (
        !candidate.id.startsWith("builtin-")
        && candidate.name === item.name
        && candidate.tile === item.tile
        && (candidate.tileMode || null) === (item.tileMode || null)
      ));
      let localId = existingLocal?.id;
      if (!existingLocal) {
        const now = new Date().toISOString();
        const local = {
          ...cloneDesign(item),
          id: window.crypto?.randomUUID?.() || `design-${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        };
        localId = local.id;
        writeStudioLibrary([...savedDesigns.filter((candidate) => !candidate.id.startsWith("builtin-")), local]);
      }

      const response = await fetch("/api/dev/studio-patterns/integrate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Disintegration failed.");
      setSavedDesigns(await getStudioLibraryDesigns());
      setSelectedExportId(localId);
      setStatus(t("studio.status.disintegrated"));
    } catch {
      setStatus(t("studio.status.disintegrationFailed"));
    } finally {
      setIntegratingId(null);
    }
  }

  function resetDesign() {
    loadDesign(emptyDesign());
    setStatus(t("studio.status.reset"));
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const imported = validateDesign(JSON.parse(text));
      if (imported.tile !== geometry.tile) throw new Error("The imported design belongs to another tile family.");
      loadDesign({ ...cloneDesign(imported), id: `imported-${Date.now()}` });
      setStatus(t("studio.status.imported"));
    }).catch(() => setStatus(t("studio.status.importFailed")));
    event.target.value = "";
  }

  function renderPathControls() {
    if (!selectedPath) return null;
    return (
      <InspectorGroup>
        <InspectorTextField label={t("studio.paths.pathName")} value={selectedPath.name} onChange={(name) => updateSelectedPath({ name })} />
        {renderElementColorControl(selectedPath, updateSelectedPath)}
        {renderElementTileTypeControl(selectedPath, updateSelectedPath)}
        <InspectorRangeField label={t("studio.paths.width")} value={selectedPath.width} min="0.1" max="1.6" step="0.02" onChange={(width) => updateSelectedPath({ width })} />
        <InspectorToggleField label={t("studio.controls.bindEndpoints")} checked={bindEndpoints} onChange={setBindEndpoints} />
        <InspectorActions>
          <button type="button" onClick={addSegment}>{t("studio.paths.addSegment")}</button>
          <button type="button" onClick={removeSegment} disabled={selectedPath.points.length <= 4}>{t("studio.paths.removeSegment")}</button>
          <button type="button" className="danger" onClick={removePath}>{t("studio.paths.removePath")}</button>
        </InspectorActions>
      </InspectorGroup>
    );
  }

  function renderPolygonControls() {
    if (!selectedPolygon) return null;
    return (
      <InspectorGroup>
        <InspectorTextField label={t("studio.polygons.polygonName")} value={selectedPolygon.name} onChange={(name) => updatePolygon(selectedPolygon.id, { name })} />
        {renderElementColorControl(selectedPolygon, (changes) => updatePolygon(selectedPolygon.id, changes))}
        <InspectorColorField label={t("studio.polygons.outlineColor")} value={selectedPolygon.strokeColor || design.outline} onChange={(strokeColor) => updatePolygon(selectedPolygon.id, { strokeColor })} />
        <InspectorRangeField label={t("studio.polygons.width")} value={selectedPolygon.width || 0} min="0" max="1.6" step="0.02" editable onChange={(width) => updatePolygon(selectedPolygon.id, { width })} />
        {renderElementTileTypeControl(selectedPolygon, (changes) => updatePolygon(selectedPolygon.id, changes))}
        <InspectorActions>
          <button type="button" onClick={addPolygonPoint}>{t("studio.polygons.addPoint")}</button>
          <button type="button" onClick={removePolygonPoint} disabled={selectedPolygon.points.length <= 3}>{t("studio.polygons.removePoint")}</button>
          <button type="button" className="danger" onClick={removePolygon}>{t("studio.polygons.remove")}</button>
        </InspectorActions>
      </InspectorGroup>
    );
  }

  function renderCircleControls() {
    if (!selectedCircle) return null;
    return (
      <InspectorGroup>
        <InspectorTextField label={t("studio.circles.circleName")} value={selectedCircle.name} onChange={(name) => updateCircle(selectedCircle.id, { name })} />
        {renderElementColorControl(selectedCircle, (changes) => updateCircle(selectedCircle.id, changes))}
        {renderElementTileTypeControl(selectedCircle, (changes) => updateCircle(selectedCircle.id, changes))}
        <InspectorSelectField label={t("studio.circles.operation")} value={selectedCircle.operation} onChange={(operation) => updateCircle(selectedCircle.id, { operation })}>
          <option value="ink">{t("studio.circles.addColor")}</option>
          <option value="base">{t("studio.circles.cutColor")}</option>
        </InspectorSelectField>
        <InspectorRangeField label={t("studio.circles.radius")} value={selectedCircle.radius} min="0.125" max="5" step="0.125" onChange={(radius) => updateCircle(selectedCircle.id, { radius })} />
        <InspectorToggleField label={t("studio.circles.hollow")} checked={selectedCircle.hollow === true} onChange={(hollow) => updateCircle(selectedCircle.id, { hollow, width: selectedCircle.width ?? Math.min(0.05, selectedCircle.radius) })} />
        {selectedCircle.hollow === true ? <InspectorRangeField label={t("studio.circles.width")} value={selectedCircle.width ?? Math.min(0.05, selectedCircle.radius)} min="0.025" max={selectedCircle.radius} step="0.025" editable onChange={(width) => updateCircle(selectedCircle.id, { width })} /> : null}
        <InspectorActions><button type="button" className="danger" onClick={removeCircle}>{t("studio.circles.remove")}</button></InspectorActions>
      </InspectorGroup>
    );
  }

  function renderLineControls() {
    if (!selectedLine) return null;
    const updateWidth = (value) => {
      if (!Number.isFinite(value)) return;
      const width = Math.max(0.1, Math.min(1.6, value));
      updateLine(selectedLine.id, { width });
      onLineWidthChange(family, width);
    };
    return (
      <InspectorGroup>
        <InspectorTextField label={t("studio.lines.lineName")} value={selectedLine.name} onChange={(name) => updateLine(selectedLine.id, { name })} />
        {renderElementColorControl(selectedLine, (changes) => updateLine(selectedLine.id, changes))}
        {renderElementTileTypeControl(selectedLine, (changes) => updateLine(selectedLine.id, changes))}
        <InspectorRangeField label={t("studio.lines.width")} value={selectedLine.width} min="0.1" max="1.6" step="0.02" editable onChange={updateWidth} />
        <InspectorToggleField label={t("studio.controls.bindEndpoints")} checked={bindEndpoints} onChange={setBindEndpoints} />
        <InspectorActions><button type="button" className="danger" onClick={removeLine}>{t("studio.lines.remove")}</button></InspectorActions>
      </InspectorGroup>
    );
  }

  function renderElementColorControl(element, update) {
    return (
      <InspectorColorField label={t("studio.controls.elementColor")} value={elementMaterialColor(design, element)} onChange={(color) => update({ color })} />
    );
  }

  function renderElementTileTypeControl(element, update) {
    if (geometry.tile !== "penrose") return null;
    return (
      <InspectorSelectField label={t("studio.controls.tileScope")} value={element.tileType || "all"} onChange={(tileType) => {
        update({ tileType: tileType === "all" ? undefined : tileType });
        if (tileType !== "all") setActivePenroseTileType(tileType);
      }}>
        <option value="all">{t("studio.controls.allPenroseTiles")}</option>
        {familyGeometry.editorShapes.map((shape) => <option key={shape.tileType} value={shape.tileType}>{shape.name}</option>)}
      </InspectorSelectField>
    );
  }

  function renderCircularPathControls() {
    if (!selectedCircularPath) return null;
    const geometry = circularPathGeometry(selectedCircularPath);
    return (
      <InspectorGroup>
        <InspectorTextField label={t("studio.circularPaths.pathName")} value={selectedCircularPath.name} onChange={(name) => updateCircularPath(selectedCircularPath.id, { name })} />
        {renderElementColorControl(selectedCircularPath, (changes) => updateCircularPath(selectedCircularPath.id, changes))}
        {renderElementTileTypeControl(selectedCircularPath, (changes) => updateCircularPath(selectedCircularPath.id, changes))}
        <InspectorRangeField label={t("studio.circularPaths.width")} value={selectedCircularPath.width} min="0.1" max="1.6" step="0.02" onChange={(width) => updateCircularPath(selectedCircularPath.id, { width })} />
        <InspectorSelectField label={t("studio.circularPaths.side")} value={selectedCircularPath.side} onChange={(side) => updateCircularPath(selectedCircularPath.id, { side })}>
          <option value="left">{t("studio.circularPaths.left")}</option>
          <option value="right">{t("studio.circularPaths.right")}</option>
        </InspectorSelectField>
        <InspectorMetric warning={geometry.mismatch}>r {geometry.radius.toFixed(3)}</InspectorMetric>
        <InspectorActions><button type="button" className="danger" onClick={removeCircularPath}>{t("studio.circularPaths.remove")}</button></InspectorActions>
      </InspectorGroup>
    );
  }

  function renderSpectreShapeControls() {
    if (family !== "spectre") return null;
    const shape = design.tileShape || { roundness: 0.18, weight: 0.5, lean: 1 };
    const updateShape = (changes) => setDesign((current) => ({
      ...current,
      tileShape: { ...current.tileShape, ...changes },
    }));
    return <>
        <InspectorRangeField label={t("studio.spectre.roundness")} value={shape.roundness} min="0" max="1" step="0.01" onChange={(roundness) => updateShape({ roundness })} />
        <InspectorRangeField label={t("studio.spectre.weight")} value={shape.weight} min="0.15" max="0.85" step="0.01" onChange={(weight) => updateShape({ weight })} />
        <InspectorToggleField label={t("studio.spectre.invert")} checked={shape.lean > 0} onChange={(checked) => updateShape({ lean: checked ? 1 : -1 })} indicator={shape.lean > 0 ? "↻" : "↺"} />
      </>;
  }

  function renderPenroseOverlayControls() {
    if (geometry.tile !== "penrose" || design.tileMode !== "p1") return null;
    const overlay = design.penroseOverlay || {
      enabled: false,
      type: "rhombs",
      thinColor: "#204a87",
      thickColor: "#555753",
      edgeColor: "#edd400",
      edgeWidth: 1,
      scale: Math.sqrt(5),
      rotation: 0,
      offsetX: 0,
      offsetY: 0,
    };
    const updateOverlay = (changes) => setDesign((current) => ({
      ...current,
      penroseOverlay: { ...overlay, ...current.penroseOverlay, ...changes },
    }));
    return <>
      <InspectorToggleField label={t("studio.penroseOverlay.enabled")} checked={overlay.enabled} onChange={(enabled) => updateOverlay({ enabled })} />
      {overlay.enabled ? <>
        <InspectorColorField label={t("studio.penroseOverlay.thinColor")} value={overlay.thinColor} onChange={(thinColor) => updateOverlay({ thinColor })} />
        <InspectorColorField label={t("studio.penroseOverlay.thickColor")} value={overlay.thickColor} onChange={(thickColor) => updateOverlay({ thickColor })} />
        <InspectorColorField label={t("studio.penroseOverlay.edgeColor")} value={overlay.edgeColor} onChange={(edgeColor) => updateOverlay({ edgeColor })} />
        <InspectorRangeField label={t("studio.penroseOverlay.edgeWidth")} value={overlay.edgeWidth} min="0" max="8" step="0.1" digits={1} editable onChange={(edgeWidth) => updateOverlay({ edgeWidth })} />
        <InspectorRangeField label={t("studio.penroseOverlay.scale")} value={overlay.scale} min="0.125" max="8" step="0.001" digits={3} editable onChange={(scale) => updateOverlay({ scale })} />
        <InspectorRangeField label={t("studio.penroseOverlay.rotation")} value={overlay.rotation} min="-180" max="180" step="1" digits={0} editable onChange={(rotation) => updateOverlay({ rotation })} />
        <InspectorRangeField label={t("studio.penroseOverlay.offsetX")} value={overlay.offsetX} min="-8" max="8" step="0.01" digits={2} editable onChange={(offsetX) => updateOverlay({ offsetX })} />
        <InspectorRangeField label={t("studio.penroseOverlay.offsetY")} value={overlay.offsetY} min="-8" max="8" step="0.01" digits={2} editable onChange={(offsetY) => updateOverlay({ offsetY })} />
      </> : null}
    </>;
  }

  const outlineWidth = design.strokeWidth ?? (family === "spectre" ? 1 : 2);
  const updateOutlineWidth = (value) => {
    if (!Number.isFinite(value)) return;
    setDesign((current) => ({ ...current, strokeWidth: Math.max(0, Math.min(20, value)) }));
  };

  function renderDocumentControls() {
    if (selectedPolygon || selectedPath || selectedLine || selectedCircle || selectedCircularPath) return null;
    return <>
      <InspectorGroup title={t("studio.controls.outlineGroup")} titleId="studio-outline-heading" className="studio-widget-outline-group">
        <InspectorColorField label={t("studio.controls.outlineColor")} value={design.outline || "#17313b"} onChange={(outline) => setDesign((current) => ({ ...current, outline }))} />
        <InspectorRangeField label={t("studio.controls.outlineWidth")} value={outlineWidth} min="0" max="8" step="0.1" digits={1} editable onChange={updateOutlineWidth} />
      </InspectorGroup>
      <InspectorGroup title={t("studio.controls.otherGroup")} titleId="studio-other-heading" className="studio-widget-other-group">
        <InspectorColorField
          label={editAllPenroseTiles ? t("studio.controls.baseColorAllTiles") : geometry.tile === "penrose" ? t("studio.controls.tileColorFor", { tile: activeTileName }) : t("studio.controls.baseColor")}
          value={displayedTileBaseColor || ""}
          mixed={editAllPenroseTiles && !displayedTileBaseColor}
          onChange={updateDisplayedTileBaseColor}
        />
        {renderPenroseOverlayControls()}
        {renderSpectreShapeControls()}
        {geometry.tile === "penrose" ? <>
          <div className="studio-scope-options" role="group" aria-label={t("studio.controls.editScope")}>
            <button type="button" className={tileColorScope === "current" ? "active" : ""} aria-pressed={tileColorScope === "current"} onClick={() => setTileColorScope("current")}>{t("studio.controls.currentTile")}</button>
            <button type="button" className={tileColorScope === "all" ? "active" : ""} aria-pressed={tileColorScope === "all"} onClick={() => setTileColorScope("all")}>{t("studio.controls.allTiles")}</button>
          </div>
        </> : null}
      </InspectorGroup>
    </>;
  }

  const ports = [...design.paths, ...(design.lines || [])].flatMap((path) => [
    { path, side: t("studio.ports.start"), port: geometry.nearestBoundary(path.points[0]) },
    { path, side: t("studio.ports.end"), port: geometry.nearestBoundary(path.points[path.points.length - 1]) },
  ]);
  const boundCount = ports.filter(({ port }) => port.distance < 0.0001).length;

  return (
    <section className="studio-page">
      <StudioSurface className="studio-layout studio-builder-shell">
        <div className="studio-top-toolbar" role="toolbar" aria-label={t("studio.toolbar.aria")}>
          <div className="studio-toolbar-row studio-toolbar-main">
            <StudioFamilySwitch family={family} onChange={onFamilyChange} />
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
              <button type="button" onClick={addPolygon}><span>⬟</span>{t("studio.polygons.title")}</button>
              <button type="button" onClick={addCircularPath}><span>⌁</span>{t("studio.circularPaths.title")}</button>
              <button type="button" onClick={addPath}><span>⌇</span>{t("studio.paths.title")}</button>
              <button type="button" onClick={addCircle}><span>○</span>{t("studio.circles.title")}</button>
              <button type="button" onClick={addLine}><span>╱</span>{t("studio.lines.title")}</button>
            </div>
            <div className="studio-toolbar-group studio-toolbar-settings">
              <span className="studio-toolbar-label">{t("studio.toolbar.appearance")}</span>
              <label className="studio-toolbar-color" title={t("studio.controls.curveColor")}><span>{t("studio.toolbar.material")}</span><input type="color" value={design.colors.ink} onChange={(event) => setDesign((current) => setDefaultMaterialColor(current, event.target.value))} /></label>
              <label className="studio-toolbar-number" title={t("studio.controls.outlineWidth")}>
                <span>{t("studio.toolbar.strokeWidth")}</span>
                <input type="number" min="0" max="20" step="0.1" value={outlineWidth.toFixed(1)} onChange={(event) => updateOutlineWidth(Number(event.target.value))} />
              </label>
            </div>
            <div className="studio-toolbar-group studio-toolbar-settings">
              <span className="studio-toolbar-label">{t("studio.toolbar.precision")}</span>
              <div className="studio-toolbar-grid-block">
                <div className="studio-toolbar-grid-controls">
                  <label className="studio-toolbar-toggle"><input type="checkbox" aria-label={t("studio.toolbar.grid")} checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /><span>#</span></label>
                  <label className="studio-toolbar-grid-mode"><select aria-label={t("studio.controls.gridMode")} value={gridMode} onChange={(event) => setGridMode(event.target.value)}><option value="construction">{t("studio.controls.gridConstruction")}</option><option value="cartesian">{t("studio.controls.gridCartesian")}</option></select></label>
                  <label className="studio-toolbar-snap"><select aria-label={t("studio.controls.snapping")} value={snapMode} onChange={(event) => setSnapMode(event.target.value)}><option value="quarter">¼</option><option value="half">½</option><option value="grid">1</option><option value="free">{t("studio.controls.snapFree")}</option></select></label>
                </div>
              </div>
              <label className="studio-toolbar-toggle" title={t("studio.toolbar.handlesHint")}><input type="checkbox" aria-label={t("studio.toolbar.handles")} checked={showHandles} onChange={(event) => setShowHandles(event.target.checked)} /><span>⌖</span></label>
              <label className="studio-toolbar-toggle" title={t("studio.toolbar.edgesHint")}><input type="checkbox" aria-label={t("studio.toolbar.edges")} checked={showEdgeNumbers} onChange={(event) => setShowEdgeNumbers(event.target.checked)} /><span className="studio-toolbar-edge-number"><span>1</span></span></label>
            </div>
          </div>
        </div>

        <aside className="studio-controls studio-tool-menu" aria-label={t(treeMode === "categories" ? "studio.layers.categorized" : "studio.layers.layered")}>
          <div className="studio-tree-header">
            <div><span>{t("studio.toolbar.navigator")}</span><h2>{t(treeMode === "categories" ? "studio.layers.categorized" : "studio.layers.layered")}</h2></div>
            <div className="studio-tree-mode" role="group" aria-label={t("studio.layers.viewMode")}>
              <button type="button" className={treeMode === "layers" ? "active" : ""} onClick={() => setTreeMode("layers")} title={t("studio.layers.layers")}>▤</button>
              <button type="button" className={treeMode === "categories" ? "active" : ""} onClick={() => setTreeMode("categories")} title={t("studio.layers.categories")}>▦</button>
            </div>
          </div>
          <div className="studio-tree" role="tree">
            {geometry.tile === "penrose" ? <label className="studio-navigator-tile-selector">
              <span>{t("studio.toolbar.tileType")}</span>
              <select value={activePenroseTileType} onChange={(event) => selectPenroseTileType(event.target.value)}>
                {familyGeometry.editorShapes.map((shape) => <option key={shape.tileType} value={shape.tileType}>{shape.name} · {penroseTileLayerCounts[shape.tileType] || 0}</option>)}
              </select>
            </label> : null}
            <button type="button" className={`studio-tree-root${!selectedPolygon && !selectedPath && !selectedLine && !selectedCircle && !selectedCircularPath ? " active" : ""}`} onClick={clearSelection}><strong>{t("studio.controls.outlineGroup")}</strong></button>
            {treeMode === "categories" ? (
              <>
                <details open>
                  <summary><span>⬟</span><strong>{t("studio.polygons.title")}</strong><small>{navigatorLayersByKind.polygon.length}</small></summary>
                  <div className="studio-tree-children">{navigatorLayersByKind.polygon.map(({ id, item: polygon }) => <button key={id} type="button" className={id === selectedPolygonId ? "active" : ""} onClick={() => selectLayer("polygon", id)}><span>⬟</span><span>{polygon.name}</span><small>{polygon.points.length}P</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>⌁</span><strong>{t("studio.circularPaths.title")}</strong><small>{navigatorLayersByKind.circularPath.length}</small></summary>
                  <div className="studio-tree-children">{navigatorLayersByKind.circularPath.map(({ id, item: path }) => <button key={id} type="button" className={id === selectedCircularPathId ? "active" : ""} onClick={() => selectLayer("circularPath", id)}><span>⌁</span><span>{path.name}</span><small>r {circularPathGeometry(path).radius.toFixed(2)}</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>⌇</span><strong>{t("studio.paths.title")}</strong><small>{navigatorLayersByKind.path.length}</small></summary>
                  <div className="studio-tree-children">{navigatorLayersByKind.path.map(({ id, item: path }, index) => <button key={id} type="button" className={id === selectedPathId && !selectedCircleId && !selectedCircularPathId ? "active" : ""} onClick={() => selectLayer("path", id)}><span>⌇</span><span>{path.name || t("studio.paths.newName", { count: index + 1 })}</span><small>{(path.points.length - 1) / 3}C</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>○</span><strong>{t("studio.circles.title")}</strong><small>{navigatorLayersByKind.circle.length}</small></summary>
                  <div className="studio-tree-children">{navigatorLayersByKind.circle.map(({ id, item: circle }) => <button key={id} type="button" className={id === selectedCircleId ? "active" : ""} onClick={() => selectLayer("circle", id)}><span>○</span><span>{circle.name}</span><small>r {circle.radius.toFixed(2)}</small></button>)}</div>
                </details>
                <details open>
                  <summary><span>╱</span><strong>{t("studio.lines.title")}</strong><small>{navigatorLayersByKind.line.length}</small></summary>
                  <div className="studio-tree-children">{navigatorLayersByKind.line.map(({ id, item: line }) => <button key={id} type="button" className={id === selectedLineId ? "active" : ""} onClick={() => selectLayer("line", id)}><span>╱</span><span>{line.name}</span><small>{line.width.toFixed(2)}</small></button>)}</div>
                </details>
              </>
            ) : (
              <div className="studio-layer-stack">
                <div className="studio-layer-stack-label"><span>{t("studio.layers.top")}</span><small>{t("studio.layers.orderHelp")}</small></div>
                {[...visibleMaterialLayers].reverse().map(({ kind, id, item }, displayIndex, layers) => {
                  const active = (kind === "path" && id === selectedPathId && !selectedCircle && !selectedCircularPath)
                    || (kind === "polygon" && id === selectedPolygonId)
                    || (kind === "line" && id === selectedLineId)
                    || (kind === "circle" && id === selectedCircleId)
                    || (kind === "circularPath" && id === selectedCircularPathId);
                  return (
                    <div className={`studio-layer-row${active ? " active" : ""}`} key={`${kind}:${id}`}>
                      <button type="button" className="studio-layer-select" onClick={() => selectLayer(kind, id)}><span>{kind === "polygon" ? "⬟" : kind === "path" ? "⌇" : kind === "line" ? "╱" : kind === "circle" ? "○" : "⌁"}</span><span>{item.name}</span><small>{t(`studio.layers.${kind}`)}</small></button>
                      <div className="studio-layer-actions">
                        <button type="button" onClick={() => swapLayerPositions(kind, id, layers[displayIndex - 1].kind, layers[displayIndex - 1].id)} disabled={displayIndex === 0} title={t("studio.layers.moveUp")}>↑</button>
                        <button type="button" onClick={() => swapLayerPositions(kind, id, layers[displayIndex + 1].kind, layers[displayIndex + 1].id)} disabled={displayIndex === layers.length - 1} title={t("studio.layers.moveDown")}>↓</button>
                      </div>
                    </div>
                  );
                })}
                <div className="studio-layer-stack-label bottom"><span>{t("studio.layers.bottom")}</span></div>
              </div>
            )}
          </div>
          <div className="studio-tree-footer">
            {ports.length ? <div className="studio-port-summary"><strong>{boundCount}/{ports.length}</strong><span>{t("studio.ports.bound")}</span></div> : null}
            {status ? <p className="studio-status" role="status">{status}</p> : <p>{t("studio.toolbar.ready")}</p>}
          </div>
        </aside>

        <main className="studio-workbench">
          <div className="studio-canvas-surface">
            <svg
              className="studio-canvas"
              viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
              role="img"
              aria-label={t("studio.canvas.aria")}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
            >
            <defs><clipPath id="studio-tile-clip"><TileShape design={design} geometry={geometry} /></clipPath></defs>
            <rect width={CANVAS.width} height={CANVAS.height} className="studio-canvas-bg" onPointerDown={clearSelection} />
            <TileShape design={design} geometry={geometry} className="studio-tile-fill" style={{ fill: activeTileBaseColor }} />
            {showGrid ? (
              <g className={`studio-lattice studio-${family}-grid studio-grid-${gridMode}`}>
                {grid.map(([start, end], index) => {
                  const a = mapToCanvas(start);
                  const b = mapToCanvas(end);
                  return <g key={index}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
                    {constructionSnapFractions.map((amount) => <circle
                      key={amount}
                      className="studio-construction-snap-point"
                      cx={a.x + (b.x - a.x) * amount}
                      cy={a.y + (b.y - a.y) * amount}
                      r="3"
                    />)}
                  </g>;
                })}
                {gridMode === "construction" ? (geometry.constructionPoints || []).map((point, index) => {
                  const screen = mapToCanvas(point);
                  return <circle key={`construction-point-${index}`} className="studio-construction-snap-point" cx={screen.x} cy={screen.y} r="3" />;
                }) : null}
                {family === "einstein" && gridMode === "construction" ? constructionLatticeSnapPoints.map((point) => (
                  <circle key={point.key} className="studio-construction-snap-point" cx={point.x} cy={point.y} r={snapStep <= 0.25 ? 1.35 : snapStep <= 0.5 ? 1.8 : 2.2} />
                )) : family === "einstein" ? Array.from({ length: 15 }, (_, uIndex) => Array.from({ length: 14 }, (_, vIndex) => {
                  const point = mapToCanvas({ u: uIndex - 6, v: vIndex - 6 });
                  return <circle key={`${uIndex}-${vIndex}`} cx={point.x} cy={point.y} r="2.1" />;
                })) : geometry.materialVertices.map((point, index) => {
                  const screen = mapToCanvas(point);
                  return <circle key={`spectre-${index}`} cx={screen.x} cy={screen.y} r="2.1" />;
                })}
              </g>
            ) : null}
            <g clipPath="url(#studio-tile-clip)">
              <MaterialLayerShapes
                layers={visibleMaterialLayers}
                mapPoint={mapToCanvas}
                colorFor={(item) => elementMaterialColor(design, item)}
                baseColor={activeTileBaseColor}
                renderPath={(kind, item) => kind === "path" ? bezierPath(item.points, mapToCanvas) : kind === "line" ? linePath(item.points, mapToCanvas) : circularPathD(item, mapToCanvas)}
                radiusScale={mapToCanvas.scale}
                strokeScale={geometry.tile === "penrose" ? canvasScaleFor(geometry) : mapToCanvas.scale}
                onSelect={selectLayer}
                selectedIds={{ path: selectedPathId, line: selectedLineId, circularPath: selectedCircularPathId }}
              />
            </g>
            <TileShape design={design} geometry={geometry} className="studio-tile-outline" style={{ stroke: design.outline || "#17313b", strokeWidth: design.strokeWidth ?? (family === "spectre" ? 1 : 2) }} />
            {showEdgeNumbers ? geometry.points.map((point, index) => {
              const next = geometry.points[(index + 1) % geometry.points.length];
              const label = mapToCanvas(cartesianToLattice({ x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }));
              return <g className="studio-edge-label" key={index}><circle cx={label.x} cy={label.y} r="11" /><text x={label.x} y={label.y + 3.5}>{index + 1}</text></g>;
            }) : null}
            {showHandles && selectedPath && !selectedCircle && !selectedCircularPath ? (
              <g className="studio-handles">
                {Array.from({ length: (selectedPath.points.length - 1) / 3 }, (_, segment) => {
                  const index = segment * 3;
                  const anchorA = mapToCanvas(selectedPath.points[index]);
                  const controlA = mapToCanvas(selectedPath.points[index + 1]);
                  const controlB = mapToCanvas(selectedPath.points[index + 2]);
                  const anchorB = mapToCanvas(selectedPath.points[index + 3]);
                  return <g key={segment}><line x1={anchorA.x} y1={anchorA.y} x2={controlA.x} y2={controlA.y} /><line x1={controlB.x} y1={controlB.y} x2={anchorB.x} y2={anchorB.y} /></g>;
                })}
                {selectedPath.points.map((point, index) => {
                  const screen = mapToCanvas(point);
                  const anchor = index % 3 === 0;
                  return <circle key={index} className={anchor ? "anchor" : "control"} cx={screen.x} cy={screen.y} r={anchor ? 8 : 6} onPointerDown={(event) => beginDragging(event, selectedPath.id, index)} />;
                })}
              </g>
            ) : null}
            {showHandles && selectedPolygon ? (
              <g className="studio-handles studio-polygon-handles">
                <polygon points={pointsAttribute(selectedPolygon.points, mapToCanvas)} />
                {selectedPolygon.points.map((point, index) => {
                  const screen = mapToCanvas(point);
                  return <circle key={index} className="anchor" cx={screen.x} cy={screen.y} r="8" onPointerDown={(event) => beginPolygonDragging(event, selectedPolygon.id, index)} />;
                })}
              </g>
            ) : null}
            {showHandles && selectedCircle ? (() => {
              const center = mapToCanvas(selectedCircle.center);
              const radiusHandle = circleHandleCanvas(selectedCircle, geometry, mapToCanvas);
              return (
                <g className="studio-handles studio-circle-handles">
                  <line x1={center.x} y1={center.y} x2={radiusHandle.x} y2={radiusHandle.y} />
                  <circle className="anchor" cx={center.x} cy={center.y} r="8" onPointerDown={(event) => beginCircleDragging(event, "circle-center", selectedCircle.id)} />
                  <circle className="control" cx={radiusHandle.x} cy={radiusHandle.y} r="6" onPointerDown={(event) => beginCircleDragging(event, "circle-radius", selectedCircle.id)} />
                </g>
              );
            })() : null}
            {showHandles && selectedLine ? (
              <g className="studio-handles studio-line-handles">
                <line x1={mapToCanvas(selectedLine.points[0]).x} y1={mapToCanvas(selectedLine.points[0]).y} x2={mapToCanvas(selectedLine.points[1]).x} y2={mapToCanvas(selectedLine.points[1]).y} />
                {selectedLine.points.map((point, index) => {
                  const screen = mapToCanvas(point);
                  return <circle key={index} className="anchor" cx={screen.x} cy={screen.y} r="8" onPointerDown={(event) => beginLineDragging(event, selectedLine.id, index)} />;
                })}
              </g>
            ) : null}
            {showHandles && selectedCircularPath ? (
              <g className="studio-handles studio-circular-path-handles">
                <polyline points={pointsAttribute(selectedCircularPath.points, mapToCanvas)} />
                {selectedCircularPath.points.map((point, index) => {
                  const screen = mapToCanvas(point);
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
          </div>
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
              <ClusterPreview design={design} geometry={geometry} />
              {family === "einstein" ? <span className="studio-flip-key"><b>M</b>: {t("studio.preview.flipped")}</span> : null}
            </section>
          </div>
          <div className="studio-canvas-legend">
            <span><i className="legend-anchor" />{t("studio.canvas.anchor")}</span>
            <span><i className="legend-control" />{t("studio.canvas.control")}</span>
            <span><i className="legend-port" />{t("studio.canvas.port")}</span>
          </div>
        </main>
        <InspectorPanel
          ariaLabel={t("studio.toolbar.document")}
          icon={selectedPolygon ? "⬟" : selectedCircularPath ? "⌁" : selectedPath ? "⌇" : selectedLine ? "╱" : selectedCircle ? "○" : "◇"}
          title={selectedPolygon ? t("studio.polygons.title") : selectedCircularPath ? t("studio.circularPaths.title") : selectedPath ? t("studio.paths.title") : selectedLine ? t("studio.lines.title") : selectedCircle ? t("studio.circles.title") : t("studio.toolbar.document")}
        >
          {renderPolygonControls()}
          {renderPathControls()}
          {renderLineControls()}
          {renderCircleControls()}
          {renderCircularPathControls()}
          {renderDocumentControls()}
        </InspectorPanel>
      </StudioSurface>

      <section className="studio-lower-grid">
        <StudioSurface className="studio-library-panel">
          <div className="studio-panel-heading">
            <div><h2>{t("studio.library.title")}</h2></div>
          </div>
          <p className="studio-library-note">{t(family === "spectre" ? "studio.spectre.libraryNote" : "studio.library.localNote")}</p>
          <div className="studio-library-grid">
            {familyDesigns.map((item) => (
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
                <MiniDesign design={item} geometry={geometry} familyGeometry={familyGeometry} />
                <div><strong>{item.name}</strong><small>{item.id.startsWith("builtin-") ? t("studio.library.builtin") : t("studio.library.local")}</small></div>
                <div className="studio-card-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); loadDesign(item); }}>{t("studio.library.load")}</button>
                  {process.env.NODE_ENV === "development" && !item.id.startsWith("builtin-") ? <button type="button" disabled={integratingId === item.id} onClick={(event) => { event.stopPropagation(); integrateDesign(item); }}>{t(integratingId === item.id ? "studio.library.integrating" : "studio.library.integrate")}</button> : null}
                  {process.env.NODE_ENV === "development" && item.id.startsWith("builtin-") ? <button type="button" disabled={integratingId === item.id} onClick={(event) => { event.stopPropagation(); disintegrateDesign(item); }}>{t(integratingId === item.id ? "studio.library.disintegrating" : "studio.library.disintegrate")}</button> : null}
                  {!item.id.startsWith("builtin-") ? <button type="button" onClick={(event) => { event.stopPropagation(); deleteDesign(item.id); }}>{t("studio.library.delete")}</button> : null}
                </div>
              </article>
            ))}
            {!familyDesigns.length ? <p className="studio-library-empty">{t("studio.library.empty")}</p> : null}
          </div>
          <div className="studio-library-actions">
            <button className="button button-green small" type="button" disabled={!selectedExportDesign} onClick={() => downloadBlob(`${safeFilename(selectedExportDesign.name)}.json`, JSON.stringify(selectedExportDesign, null, 2), "application/json")}>{t("studio.actions.exportJson")}</button>
            <button className="button button-ink small" type="button" disabled={!selectedExportDesign} onClick={() => downloadBlob(`${safeFilename(selectedExportDesign.name)}.svg`, exportSvg(selectedExportDesign, geometry), "image/svg+xml")}>{t("studio.actions.exportSvg")}</button>
            <button className="button button-muted small" type="button" onClick={() => importRef.current?.click()}>{t("studio.actions.import")}</button>
            <input ref={importRef} className="studio-file-input" type="file" accept="application/json,.json" onChange={handleImport} />
          </div>
        </StudioSurface>
      </section>
    </section>
  );
}

function TileShape({ design, geometry, mapper, ...props }) {
  const resolvedMapper = mapper || canvasMapperFor(geometry);
  if (geometry.outlineD) return <path d={geometry.outlineD(design, resolvedMapper)} {...props} />;
  if (geometry.materialToShape && !mapper) {
    const offset = canvasOffsetFor(geometry);
    const scale = canvasScaleFor(geometry);
    const shapeMapper = (point) => {
      const mapped = toCanvasCartesian(point, scale);
      return { x: mapped.x + offset.x, y: mapped.y + offset.y };
    };
    return <polygon points={cartesianPointsAttribute(geometry.points, shapeMapper)} {...props} />;
  }
  if (geometry.shapes) return geometry.shapes.map((shape) => <polygon key={shape.name} points={pointsAttribute(shape.points.map(cartesianToLattice), resolvedMapper)} {...props} />);
  return <polygon points={pointsAttribute(geometry.points.map(cartesianToLattice), resolvedMapper)} {...props} />;
}

function ClusterPreview({ design, geometry }) {
  if (geometry.tile === "penrose") return <GeneratedPenrosePreview design={design} geometry={geometry} />;

  const transforms = geometry.previewTransforms;
  const fittedMappers = geometry.previewTransforms ? fittedClusterMappers(transforms, geometry) : null;
  const previewDesign = geometry.previewDesign ? geometry.previewDesign(design) : design;
  return (
    <svg className="studio-cluster-preview" viewBox={`${H_CLUSTER_VIEWBOX.x} ${H_CLUSTER_VIEWBOX.y} ${H_CLUSTER_VIEWBOX.width} ${H_CLUSTER_VIEWBOX.height}`} aria-label={`Transformed ${geometry.label} material preview`}>
      <rect {...H_CLUSTER_VIEWBOX} fill="#fffdf8" />
      <defs>
        {transforms.map((transform, index) => <clipPath id={`cluster-clip-${index}`} key={index}><TileShape design={previewDesign} geometry={geometry} mapper={fittedMappers?.[index] || clusterMapper(transform)} /></clipPath>)}
      </defs>
      {transforms.map((transform, index) => {
        const mapper = fittedMappers?.[index] || clusterMapper(transform);
        const determinant = transform[0] * transform[4] - transform[1] * transform[3];
        const tileBase = geometry.previewFill ? geometry.previewFill(index, design) : design.colors.base;
        return (
          <g key={index}>
            <TileShape design={previewDesign} geometry={geometry} mapper={mapper} fill={tileBase} />
            <g clipPath={`url(#cluster-clip-${index})`}>
              <MaterialLayerShapes layers={getDesignLayers(design)} mapPoint={mapper} colorFor={(item) => elementMaterialColor(design, item)} baseColor={tileBase} renderPath={(kind, item) => kind === "path" ? bezierPath(item.points, mapper) : kind === "line" ? linePath(item.points, mapper) : circularPathD(item, mapper)} strokeScale={mapper.scale} />
            </g>
            <TileShape design={previewDesign} geometry={geometry} mapper={mapper} fill="none" stroke={design.outline || "#17313b"} strokeWidth={geometry.previewStroke ? "3" : "1.5"} strokeLinejoin="round" />
            {geometry.family === "einstein" && determinant > 0 ? <text className="studio-mirror-label" x={mapper({ u: 1.5, v: 0 }).x} y={mapper({ u: 1.5, v: 0 }).y}>M</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

function GeneratedPenrosePreview({ design, geometry }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let active = true;
    let url = "";
    const timer = window.setTimeout(async () => {
      try {
        const svg = await renderBrowserPreview("penrose", {
          width: 640,
          height: 432,
          // A third generation provides a clean guard ring around the visible
          // patch; two P1 generations expose the incomplete construction edge.
          iterations: 3,
          scale: 400,
          center_x: 0,
          center_y: 0,
          tile_mode: geometry.tileMode,
          seed: "sun",
          palette: [design.colors.base, design.colors.base, design.colors.base, design.colors.base],
          background: "#fffdf8",
          outline: design.outline || "#17313b",
          stroke_width: design.strokeWidth ?? 1.5,
          material_mode: "pattern",
          studio_pattern: design,
        });
        if (!active) return;
        url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        setPreviewUrl(url);
      } catch {
        if (active) setPreviewUrl("");
      }
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [design, geometry.tileMode]);

  return previewUrl
    ? <img className="studio-cluster-preview studio-generated-penrose-preview" src={previewUrl} alt="Generated first-generation Penrose preview" />
    : <div className="studio-generated-penrose-preview studio-preview-loading">Generating first generation…</div>;
}

function MiniTileDesign({ design, geometry, clipId, transform }) {
  const mapper = canvasMapperFor(geometry);
  const baseColor = tileBaseColor(design, geometry.activeTileType);
  const layers = getDesignLayers(design).filter(({ item }) => (
    materialMatchesTile(item, geometry.activeTileType)
  ));
  return (
    <g transform={transform}>
      <defs><clipPath id={clipId}><TileShape design={design} geometry={geometry} /></clipPath></defs>
      <TileShape design={design} geometry={geometry} fill={baseColor} />
      <g clipPath={`url(#${clipId})`}>
        <MaterialLayerShapes layers={layers} mapPoint={mapper} colorFor={(item) => elementMaterialColor(design, item)} baseColor={baseColor} renderPath={(kind, item) => kind === "path" ? bezierPath(item.points, mapper) : kind === "line" ? linePath(item.points, mapper) : circularPathD(item, mapper)} radiusScale={mapper.scale} strokeScale={geometry.tile === "penrose" ? canvasScaleFor(geometry) : mapper.scale} />
      </g>
      <TileShape design={design} geometry={geometry} fill="none" stroke={design.outline || "#17313b"} strokeWidth="4" strokeLinejoin="round" />
    </g>
  );
}

function MiniDesign({ design, geometry, familyGeometry }) {
  const penroseGeometries = geometry.tile === "penrose"
    ? familyGeometry.editorShapes.map((shape) => penroseTileEditorGeometry(familyGeometry, shape.tileType))
    : null;
  const columns = penroseGeometries ? Math.min(3, penroseGeometries.length) : 1;
  const rows = penroseGeometries ? Math.ceil(penroseGeometries.length / columns) : 1;
  const cellWidth = CANVAS.width / columns;
  const cellHeight = CANVAS.height / rows;
  const tileScale = Math.min(cellWidth / CANVAS.width, cellHeight / CANVAS.height) * 0.88;
  return (
    <svg className="studio-mini-design" viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} aria-hidden="true">
      {penroseGeometries
        ? penroseGeometries.map((tileGeometry, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const x = column * cellWidth + (cellWidth - CANVAS.width * tileScale) / 2;
          const y = row * cellHeight + (cellHeight - CANVAS.height * tileScale) / 2;
          return <MiniTileDesign
            key={tileGeometry.activeTileType}
            design={design}
            geometry={tileGeometry}
            clipId={`mini-${design.id}-${tileGeometry.activeTileType}`}
            transform={`translate(${x} ${y}) scale(${tileScale})`}
          />;
        })
        : <MiniTileDesign design={design} geometry={geometry} clipId={`mini-${design.id}`} />}
    </svg>
  );
}
