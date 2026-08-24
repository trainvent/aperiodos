import { cloneDesign, validateDesign } from "./einsteinGeometry.js";

export const STUDIO_LIBRARY_KEY = "aperiodos-studio-designs-v1";
export const STUDIO_LIBRARY_EVENT = "aperiodos:studio-library-changed";
export const PUBLIC_STUDIO_PATTERN_ASSETS = ["/patterns/einstein/greencurves.json"];

export function readStudioLibrary(storage = globalThis.window?.localStorage) {
  if (!storage) return [];
  const parsed = JSON.parse(storage.getItem(STUDIO_LIBRARY_KEY) || "[]");
  if (!Array.isArray(parsed)) return [];
  return parsed.map((design) => cloneDesign(validateDesign(design)));
}

export function writeStudioLibrary(designs, storage = globalThis.window?.localStorage) {
  const validated = designs
    .filter((design) => !String(design.id).startsWith("builtin-"))
    .map((design) => cloneDesign(validateDesign(design)));
  storage?.setItem(STUDIO_LIBRARY_KEY, JSON.stringify(validated));
  globalThis.window?.dispatchEvent(new CustomEvent(STUDIO_LIBRARY_EVENT));
  return validated;
}

export async function getPublicStudioDesigns(fetcher = globalThis.fetch) {
  if (typeof fetcher !== "function") return [];
  const results = await Promise.allSettled(PUBLIC_STUDIO_PATTERN_ASSETS.map(async (asset) => {
    const response = await fetcher(asset);
    if (!response.ok) throw new Error(`Could not load public Studio pattern: ${asset}`);
    return cloneDesign(validateDesign(await response.json()));
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

export async function getStudioLibraryDesigns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  return [...await getPublicStudioDesigns(fetcher), ...readStudioLibrary(storage)];
}

export async function getEinsteinStudioPatterns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  return getStudioLibraryDesigns(storage, fetcher);
}

export function studioPatternValue(id) {
  return `studio:${id}`;
}

export function studioPatternId(value) {
  return String(value).startsWith("studio:") ? String(value).slice(7) : null;
}
