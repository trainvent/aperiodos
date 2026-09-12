//! Canonical geometry and document operations for the Aperiodos material Studio.
//!
//! This crate is intentionally separate from both the web UI and the tiling
//! generators. Native exports and browser previews consume the same operations.

mod document;
mod export;
mod geometry;
mod material;

pub use document::tile_base_color;
pub use geometry::{call as call_geometry, geometry_adapter, GeometryError};
pub use material::render_studio_elements;

use serde_json::Value;

/// Stable JSON boundary shared by native golden tests and the WASM adapter.
pub fn call(operation: &str, input: &Value) -> Result<Value, String> {
    if operation == "exportSvg" {
        export::export_svg(
            input.get("design").unwrap_or(input),
            input.get("tileType").and_then(Value::as_str),
        )
        .map(Value::String)
    } else if let Some(result) = document::call(operation, input) {
        result
    } else {
        call_geometry(operation, input).map_err(|error| error.to_string())
    }
}
