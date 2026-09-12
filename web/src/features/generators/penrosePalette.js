const TILE_TYPES_BY_MODE = {
  "kite-dart": ["dart", "kite"],
  rhombs: ["thin-rhomb", "thick-rhomb"],
  p1: ["pentagon", "star", "boat", "diamond"],
};

export function penroseTileTypes(mode) {
  return TILE_TYPES_BY_MODE[mode] || TILE_TYPES_BY_MODE["kite-dart"];
}

export function penrosePaletteFields(mode) {
  return penroseTileTypes(mode).map((_, index) => `palette_${index + 1}`);
}

export function paletteFromStudioPattern(pattern, mode) {
  if (!pattern) return [];
  if (mode === "p1" && pattern.penroseOverlay?.enabled) {
    return [pattern.penroseOverlay.thinColor, pattern.penroseOverlay.thickColor];
  }
  const fallback = pattern.colors?.base;
  return penroseTileTypes(mode).map((tileType) => pattern.tileColors?.[tileType] || fallback || null);
}

export function studioPatternWithPalette(pattern, mode, values) {
  if (!pattern) return null;
  if (mode === "p1" && pattern.penroseOverlay?.enabled) {
    return {
      ...pattern,
      penroseOverlay: {
        ...pattern.penroseOverlay,
        thinColor: values.palette_1 || pattern.penroseOverlay.thinColor,
        thickColor: values.palette_2 || pattern.penroseOverlay.thickColor,
      },
    };
  }
  const tileColors = Object.fromEntries(
    penroseTileTypes(mode).map((tileType, index) => [tileType, values[`palette_${index + 1}`]])
  );
  return {
    ...pattern,
    colors: { ...pattern.colors, base: values.palette_1 || pattern.colors?.base },
    tileColors: { ...pattern.tileColors, ...tileColors },
  };
}
