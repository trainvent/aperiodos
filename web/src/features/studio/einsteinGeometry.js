import { studioCall } from "./studioRuntime.js";

export function latticeToCartesian(point) {
  return studioCall("latticeToCartesian", { point });
}

export function cartesianToLattice(point) {
  return studioCall("cartesianToLattice", { point });
}

export function snapLatticePoint(point, step) {
  return studioCall("snapLatticePoint", { point, step });
}

export function snapCircleHandle(center, handle, latticeStep = 0, angleStep = 30) {
  return studioCall("snapCircleHandle", { center, handle, latticeStep, angleStep });
}

export function circleHandlePoint(circle) {
  return studioCall("circleHandlePoint", {
    center: circle.center,
    radius: circle.radius,
    handleAngle: circle.handleAngle ?? 0,
  });
}

export function circularPathGeometry(path, stepsPerTurn = 72) {
  return studioCall("circularPathGeometry", {
    points: path.points,
    side: path.side,
    stepsPerTurn,
  });
}

export function nearestBoundaryPoint(point) {
  return studioCall("nearestBoundary", { family: "einstein", point });
}

export function bindPathEndpoints(path) {
  return studioCall("bindPathEndpoints", { path });
}

export function createEmptyDesign(tile = "einstein-hat") {
  return studioCall("createEmptyDesign", { tile });
}

export function insertCircularPathTemplate(design, options = {}) {
  return studioCall("insertCircularPathTemplate", { design, ...options });
}

export function insertHexagonalizationTemplate(design, options = {}) {
  return studioCall("insertHexagonalizationTemplate", { design, ...options });
}

export function normalizeLayerOrder(design) {
  return studioCall("normalizeLayerOrder", { design });
}

export function getDesignLayers(design) {
  return studioCall("getDesignLayers", { design });
}

export function elementMaterialColor(design, element) {
  return studioCall("elementMaterialColor", { design, element });
}

export function setDefaultMaterialColor(design, color) {
  return studioCall("setDefaultMaterialColor", { design, color });
}

export function validateDesign(design) {
  return studioCall("validateDesign", { design });
}

export function cloneDesign(design) {
  return structuredClone(design);
}
