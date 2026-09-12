import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { PROJECT_ROOT } from "./config.js";
import { ApiError } from "./http.js";
import { coerceStudioPattern } from "./renderers.js";

export const STUDIO_PATTERNS_ROOT = path.join(PROJECT_ROOT, "web", "public", "patterns");

const FAMILY_DIRECTORIES = {
  "einstein-hat": "einstein",
  spectre: "spectre",
  penrose: "penrose",
};

export function studioPatternSlug(name) {
  const slug = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (!slug) throw new ApiError("The design needs a name before it can be integrated.");
  return slug;
}

async function readRegistry(patternsRoot) {
  try {
    const registry = JSON.parse(await readFile(path.join(patternsRoot, "library.json"), "utf8"));
    return Array.isArray(registry) ? registry : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readRegisteredDesigns(registry, patternsRoot) {
  const results = await Promise.all(registry.map(async (asset) => {
    if (typeof asset !== "string" || !asset.startsWith("/patterns/") || !asset.endsWith(".json")) return null;
    const relativePath = asset.slice("/patterns/".length);
    const filePath = path.resolve(patternsRoot, relativePath);
    if (!filePath.startsWith(`${path.resolve(patternsRoot)}${path.sep}`)) return null;
    try {
      return { asset, filePath, design: JSON.parse(await readFile(filePath, "utf8")) };
    } catch {
      return null;
    }
  }));
  return results.filter(Boolean);
}

export async function integrateStudioPattern(input, { patternsRoot = STUDIO_PATTERNS_ROOT } = {}) {
  const familyDirectory = FAMILY_DIRECTORIES[input?.tile];
  if (!familyDirectory) throw new ApiError("Only Einstein, Spectre, and Penrose Studio designs can be integrated.");
  const design = coerceStudioPattern({ studio_pattern: input }, input.tile);
  const slug = studioPatternSlug(design.name);
  const registry = await readRegistry(patternsRoot);
  const registered = await readRegisteredDesigns(registry, patternsRoot);
  const existing = registered.find(({ design: candidate }) => (
    candidate.tile === design.tile
    && (candidate.tileMode || null) === (design.tileMode || null)
    && studioPatternSlug(candidate.name) === slug
  ));
  const asset = existing?.asset || `/patterns/${familyDirectory}/${slug}.json`;
  const filePath = existing?.filePath || path.join(patternsRoot, familyDirectory, `${slug}.json`);
  const now = new Date().toISOString();
  const integrated = {
    ...JSON.parse(JSON.stringify(design)),
    id: existing?.design.id || `builtin-${familyDirectory}-${slug}`,
    createdAt: existing?.design.createdAt || design.createdAt || now,
    updatedAt: now,
  };

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(integrated, null, 2)}\n`, "utf8");
  if (!registry.includes(asset)) {
    await writeFile(path.join(patternsRoot, "library.json"), `${JSON.stringify([...registry, asset], null, 2)}\n`, "utf8");
  }
  return { asset, design: integrated };
}

export async function disintegrateStudioPattern(id, { patternsRoot = STUDIO_PATTERNS_ROOT } = {}) {
  if (typeof id !== "string" || !id.startsWith("builtin-")) {
    throw new ApiError("An integrated design identifier is required.");
  }
  const registry = await readRegistry(patternsRoot);
  const registered = await readRegisteredDesigns(registry, patternsRoot);
  const existing = registered.find(({ design }) => design.id === id);
  if (!existing) throw new ApiError("The integrated design was not found.", 404);

  await writeFile(
    path.join(patternsRoot, "library.json"),
    `${JSON.stringify(registry.filter((asset) => asset !== existing.asset), null, 2)}\n`,
    "utf8",
  );
  await unlink(existing.filePath);
  return { asset: existing.asset, design: existing.design };
}
