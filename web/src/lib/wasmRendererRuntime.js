const WASM_ASSET_VERSION = "studio-p1-overlay-clipping-v16";
const WASM_MODULE_URL = `/wasm/aperiodos_render.js?v=${WASM_ASSET_VERSION}`;
const WASM_BINARY_URL = `/wasm/aperiodos_render_bg.wasm?v=${WASM_ASSET_VERSION}`;

let rendererModulePromise;

export function loadRendererModule() {
  if (!rendererModulePromise) {
    rendererModulePromise = import(/* webpackIgnore: true */ WASM_MODULE_URL)
      .then(async (module) => {
        await module.default({ module_or_path: WASM_BINARY_URL });
        return module;
      })
      .catch((error) => {
        rendererModulePromise = undefined;
        throw error;
      });
  }
  return rendererModulePromise;
}
