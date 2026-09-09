import { affineLengthScale } from "./einsteinGeometry.js";

export function transformedMaterialScale(fitScale, transform) {
  return fitScale * affineLengthScale(transform);
}
