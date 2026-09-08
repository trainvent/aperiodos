let runtime;
let runtimePromise;

export function installStudioRuntime(module) {
  if (typeof module?.studio_call !== "function") {
    throw new Error("The Aperiodos WASM module does not expose the Studio API.");
  }
  runtime = module;
  return module;
}

export async function loadStudioRuntime() {
  if (runtime) return runtime;
  if (!runtimePromise) {
    runtimePromise = import(/* webpackIgnore: true */ "/wasm/aperiodos_render.js")
      .then(async (module) => {
        await module.default("/wasm/aperiodos_render_bg.wasm");
        return installStudioRuntime(module);
      })
      .catch((error) => {
        runtimePromise = undefined;
        throw error;
      });
  }
  return runtimePromise;
}

export function studioCall(operation, input = {}) {
  if (!runtime) {
    throw new Error("The Aperiodos Studio runtime has not been loaded.");
  }
  return JSON.parse(runtime.studio_call(operation, JSON.stringify(input)));
}

export function studioRuntimeReady() {
  return Boolean(runtime);
}
