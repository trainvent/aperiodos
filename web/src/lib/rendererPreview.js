let rendererModulePromise;

async function rendererModule() {
  if (!rendererModulePromise) {
    rendererModulePromise = import(/* webpackIgnore: true */ "/wasm/aperiodos_render.js")
      .then(async (module) => {
        await module.default("/wasm/aperiodos_render_bg.wasm");
        return module;
      });
  }
  return rendererModulePromise;
}

function previewRecipe(generator, payload) {
  const maxDimension = Math.max(Number(payload.width) || 1024, Number(payload.height) || 1024);
  const canvasScale = Math.min(1, 640 / maxDimension);
  const recipe = {
    ...payload,
    width: Math.max(64, Math.round((Number(payload.width) || 1024) * canvasScale)),
    height: Math.max(64, Math.round((Number(payload.height) || 1024) * canvasScale)),
  };
  delete recipe.format;

  if (generator === "einstein") {
    if (payload.seed !== undefined && payload.seed !== null && String(payload.seed).trim()) {
      throw new Error("Seed crops are rendered at export resolution on the server.");
    }
    recipe.iterations = Math.min(Number(recipe.iterations) || 5, 6);
    recipe.scale = (Number(payload.scale) || 100) * 0.1 * canvasScale;
    if (recipe.color_mode === "simple") {
      const base = recipe.material_mode === "pattern"
        ? recipe.studio_pattern?.colors?.base || recipe.pattern_base || "white"
        : recipe.simple_color || "white";
      recipe.colors = Array(5).fill(base);
      recipe.color_mode = "families";
    }
  } else if (generator === "spectre") {
    recipe.iterations = Math.min(Number(recipe.iterations) || 3, 5);
    recipe.scale = (Number(payload.scale) || 100) * 0.08 * canvasScale;
    if (recipe.color_mode === "simple") recipe.palette = Array(4).fill(recipe.simple_color || "white");
  } else if (generator === "penrose") {
    recipe.iterations = Math.min(Number(recipe.iterations) || 4, 6);
    recipe.scale = (Number(payload.scale) || 100) * (recipe.tile_mode === "p1" ? 0.1 : 0.2) * canvasScale;
    recipe.seed = recipe.build_logic === "cartwheel" ? "star" : "sun";
  }
  return recipe;
}

export async function renderBrowserPreview(generator, payload) {
  const module = await rendererModule();
  return module.render_preview(generator, JSON.stringify(previewRecipe(generator, payload)));
}
