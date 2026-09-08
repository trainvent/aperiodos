use wasm_bindgen::prelude::*;

/// Renders the same SVG as the native renderer without leaving the browser.
#[wasm_bindgen]
pub fn render_preview(generator: &str, recipe_json: &str) -> Result<String, JsValue> {
    let recipe = serde_json::from_str(recipe_json)
        .map_err(|error| JsValue::from_str(&format!("invalid preview recipe: {error}")))?;
    aperiodos_render::render_svg(generator, &recipe).map_err(|error| JsValue::from_str(&error))
}

/// Executes a synchronous Studio authoring operation after the WASM module has
/// been initialized. Keeping this JSON boundary shared with native tests makes
/// browser/native parity directly golden-testable.
#[wasm_bindgen]
pub fn studio_call(operation: &str, input_json: &str) -> Result<String, JsValue> {
    let input: serde_json::Value = serde_json::from_str(input_json)
        .map_err(|error| JsValue::from_str(&format!("invalid Studio input: {error}")))?;
    let output =
        aperiodos_studio::call(operation, &input).map_err(|error| JsValue::from_str(&error))?;
    serde_json::to_string(&output)
        .map_err(|error| JsValue::from_str(&format!("cannot encode Studio output: {error}")))
}
