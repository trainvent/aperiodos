use wasm_bindgen::prelude::*;

/// Renders the same SVG as the native renderer without leaving the browser.
#[wasm_bindgen]
pub fn render_preview(generator: &str, recipe_json: &str) -> Result<String, JsValue> {
    let recipe = serde_json::from_str(recipe_json)
        .map_err(|error| JsValue::from_str(&format!("invalid preview recipe: {error}")))?;
    aperiodos_render::render_svg(generator, &recipe).map_err(|error| JsValue::from_str(&error))
}
