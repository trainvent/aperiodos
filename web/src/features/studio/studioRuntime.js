import { loadRendererModule } from "../../lib/wasmRendererRuntime.js";

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
    runtimePromise = loadRendererModule()
      .then(installStudioRuntime)
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
