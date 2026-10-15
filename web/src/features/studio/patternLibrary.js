import { cloneDesign, validateDesign } from "./einsteinGeometry.js";
import { loadStudioRuntime, studioRuntimeReady } from "./studioRuntime.js";

export const STUDIO_LIBRARY_KEY = "aperiodos-studio-designs-v1";
export const STUDIO_LIBRARY_EVENT = "aperiodos:studio-library-changed";
export const PUBLIC_STUDIO_PATTERN_ASSETS = [
  "/patterns/einstein/greencurves.json",
  "/patterns/spectre/hexagonalization.json",
  "/patterns/penrose/p2-bicircular.json",
];
export const PUBLIC_STUDIO_PATTERN_REGISTRY = "/patterns/library.json";

export function studioDesignNameKey(design) {
  return JSON.stringify([
    design.tile,
    design.tile === "penrose" ? design.tileMode || "kite-dart" : null,
    String(design.name || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
  ]);
}

export function hasStudioNameConflict(design, library) {
  return library.some((item) => studioDesignNameKey(item) === studioDesignNameKey(design)
    && (item.id !== design.id || String(item.id).startsWith("builtin-")));
}

export function createStudioDesignCopy(design, library) {
  const now = new Date().toISOString();
  const copy = {
    ...cloneDesign(design),
    id: globalThis.crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const baseName = copy.name.trim();
  let suffix = 2;
  while (hasStudioNameConflict(copy, library)) {
    copy.name = `${baseName} (${suffix++})`;
  }
  return copy;
}

export function readStudioLibrary(storage = globalThis.window?.localStorage) {
  if (!storage) return [];
  const parsed = JSON.parse(storage.getItem(STUDIO_LIBRARY_KEY) || "[]");
  if (!Array.isArray(parsed)) return [];
  return parsed.map((design) => cloneDesign(validateDesign(design)));
}

export function writeStudioLibrary(designs, storage = globalThis.window?.localStorage) {
  const names = new Set();
  for (const design of designs) {
    const key = studioDesignNameKey(design);
    if (names.has(key)) {
      const error = new Error("A design with this name already exists for this tile type.");
      error.code = "DUPLICATE_STUDIO_NAME";
      throw error;
    }
    names.add(key);
  }
  const validated = designs
    .filter((design) => !String(design.id).startsWith("builtin-"))
    .map((design) => cloneDesign(validateDesign(design)));
  storage?.setItem(STUDIO_LIBRARY_KEY, JSON.stringify(validated));
  globalThis.window?.dispatchEvent(new CustomEvent(STUDIO_LIBRARY_EVENT));
  return validated;
}

export async function getPublicStudioDesigns(fetcher = globalThis.fetch) {
  if (!studioRuntimeReady()) await loadStudioRuntime();
  if (typeof fetcher !== "function") return [];
  let assets = PUBLIC_STUDIO_PATTERN_ASSETS;
  try {
    const response = await fetcher(PUBLIC_STUDIO_PATTERN_REGISTRY, { cache: "no-store" });
    const registry = response.ok ? await response.json() : null;
    if (Array.isArray(registry) && registry.every((asset) => typeof asset === "string" && asset.startsWith("/patterns/") && asset.endsWith(".json"))) {
      assets = registry;
    }
  } catch {
    // Older deployments without the registry retain the original built-in set.
  }
  const results = await Promise.allSettled(assets.map(async (asset) => {
    const response = await fetcher(asset, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load public Studio pattern: ${asset}`);
    return cloneDesign(validateDesign(await response.json()));
  }));
  return results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}

export async function getStudioLibraryDesigns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  const publicDesigns = await getPublicStudioDesigns(fetcher);
  const locals = readStudioLibrary(storage);
  const used = new Set(publicDesigns.map(studioDesignNameKey));
  const reserved = new Set([...publicDesigns, ...locals].map(studioDesignNameKey));
  let renamed = false;
  const uniqueLocals = locals.map((design) => {
    let next = design;
    let suffix = 2;
    if (used.has(studioDesignNameKey(next))) {
      do {
        next = { ...design, name: `${design.name.trim()} (${suffix++})` };
      } while (reserved.has(studioDesignNameKey(next)) || used.has(studioDesignNameKey(next)));
      renamed = true;
    }
    used.add(studioDesignNameKey(next));
    return next;
  });
  if (renamed) writeStudioLibrary([...publicDesigns, ...uniqueLocals], storage);
  return [...publicDesigns, ...uniqueLocals];
}

export async function getEinsteinStudioPatterns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  return (await getStudioLibraryDesigns(storage, fetcher)).filter((design) => design.tile === "einstein-hat");
}

export async function getSpectreStudioPatterns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  return (await getStudioLibraryDesigns(storage, fetcher)).filter((design) => design.tile === "spectre");
}

export async function getPenroseStudioPatterns(storage = globalThis.window?.localStorage, fetcher = globalThis.fetch) {
  return (await getStudioLibraryDesigns(storage, fetcher)).filter((design) => design.tile === "penrose");
}

export function studioPatternValue(id) {
  return `studio:${id}`;
}

export function studioPatternId(value) {
  return String(value).startsWith("studio:") ? String(value).slice(7) : null;
}
