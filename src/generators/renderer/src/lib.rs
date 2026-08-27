use einstein::{ColorMode, EinsteinSvgConfig, MaterialMode};
use penrose::{PenroseMaterialMode, PenroseSeed, PenroseSvgConfig, PenroseTileMode};
use serde_json::Value;
use spectre::{DrawMode, ShapeMode, SpectreSvgConfig};

/// The stable, shared entry point used by the unified CLI and the browser WASM module.
pub fn render_svg(generator: &str, recipe: &Value) -> Result<String, String> {
    match generator {
        "einstein" => einstein::render_svg(&einstein_config(recipe)),
        "spectre" => Ok(spectre::render_svg(&spectre_config(recipe))),
        "penrose" => Ok(penrose::render_svg(&penrose_config(recipe))),
        other => Err(format!(
            "unknown generator '{other}'; expected einstein, spectre, or penrose"
        )),
    }
}

fn string(value: &Value, key: &str, fallback: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or(fallback)
        .to_owned()
}
fn u32_value(value: &Value, key: &str, fallback: u32) -> u32 {
    value
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|v| v.try_into().ok())
        .unwrap_or(fallback)
}
fn usize_value(value: &Value, key: &str, fallback: usize) -> usize {
    value
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|v| v.try_into().ok())
        .unwrap_or(fallback)
}
fn f64_value(value: &Value, key: &str, fallback: f64) -> f64 {
    value.get(key).and_then(Value::as_f64).unwrap_or(fallback)
}
fn strings(value: &Value, key: &str, fallback: Vec<String>) -> Vec<String> {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(ToOwned::to_owned)
                .collect()
        })
        .unwrap_or(fallback)
}

fn einstein_config(value: &Value) -> EinsteinSvgConfig {
    let default = EinsteinSvgConfig::default();
    EinsteinSvgConfig {
        width: u32_value(value, "width", default.width),
        height: u32_value(value, "height", default.height),
        iterations: usize_value(value, "iterations", default.iterations),
        scale: f64_value(value, "scale", default.scale),
        center_x: f64_value(value, "center_x", default.center_x),
        center_y: f64_value(value, "center_y", default.center_y),
        colors: strings(value, "colors", default.colors),
        color_mode: match value.get("color_mode").and_then(Value::as_str) {
            Some("four_color" | "four-color") => ColorMode::FourColor,
            _ => ColorMode::Families,
        },
        four_colors: strings(value, "four_colors", default.four_colors),
        background: string(value, "background", &default.background),
        outline: string(value, "outline", &default.outline),
        stroke_width: f64_value(value, "stroke_width", default.stroke_width),
        material_mode: if value.get("material_mode").and_then(Value::as_str) == Some("pattern") {
            MaterialMode::Pattern
        } else {
            MaterialMode::Solid
        },
        pattern_base: string(value, "pattern_base", &default.pattern_base),
        pattern_color: string(value, "pattern_color", &default.pattern_color),
        studio_pattern: value.get("studio_pattern").cloned(),
        seed: value.get("seed").and_then(Value::as_u64),
    }
}

fn spectre_config(value: &Value) -> SpectreSvgConfig {
    let default = SpectreSvgConfig::default();
    SpectreSvgConfig {
        width: u32_value(value, "width", default.width),
        height: u32_value(value, "height", default.height),
        iterations: usize_value(value, "iterations", default.iterations),
        auto_iterations: value
            .get("auto_iterations")
            .and_then(Value::as_bool)
            .unwrap_or(default.auto_iterations),
        scale: f64_value(value, "scale", default.scale as f64) as f32,
        center_x: f64_value(value, "center_x", default.center_x as f64) as f32,
        center_y: f64_value(value, "center_y", default.center_y as f64) as f32,
        palette: strings(value, "palette", default.palette),
        background: string(value, "background", &default.background),
        outline: string(value, "outline", &default.outline),
        stroke_width: f64_value(value, "stroke_width", default.stroke_width as f64) as f32,
        draw_mode: if value.get("draw_mode").and_then(Value::as_str) == Some("generated") {
            DrawMode::Generated
        } else {
            DrawMode::Translation
        },
        shape_mode: if value
            .get("shape")
            .or_else(|| value.get("shape_mode"))
            .and_then(Value::as_str)
            == Some("straight")
        {
            ShapeMode::Straight
        } else {
            ShapeMode::Curved
        },
        studio_pattern: value.get("studio_pattern").cloned(),
    }
}

fn penrose_config(value: &Value) -> PenroseSvgConfig {
    let default = PenroseSvgConfig::default();
    PenroseSvgConfig {
        width: u32_value(value, "width", default.width),
        height: u32_value(value, "height", default.height),
        iterations: usize_value(value, "iterations", default.iterations),
        scale: f64_value(value, "scale", default.scale),
        center_x: f64_value(value, "center_x", default.center_x),
        center_y: f64_value(value, "center_y", default.center_y),
        palette: strings(value, "palette", default.palette),
        background: string(value, "background", &default.background),
        outline: string(value, "outline", &default.outline),
        stroke_width: f64_value(value, "stroke_width", default.stroke_width),
        seed: if value.get("seed").and_then(Value::as_str) == Some("star") {
            PenroseSeed::Star
        } else {
            PenroseSeed::Sun
        },
        tile_mode: match value.get("tile_mode").and_then(Value::as_str) {
            Some("rhombs") => PenroseTileMode::Rhombs,
            Some("p1") => PenroseTileMode::P1,
            _ => PenroseTileMode::KiteDart,
        },
        material_mode: if value.get("material_mode").and_then(Value::as_str) == Some("pattern") {
            PenroseMaterialMode::Pattern
        } else {
            PenroseMaterialMode::Solid
        },
        studio_pattern: value.get("studio_pattern").cloned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn all_generators_share_one_recipe_entry_point() {
        for generator in ["einstein", "spectre", "penrose"] {
            let svg = render_svg(
                generator,
                &serde_json::json!({"width":64,"height":64,"iterations":1}),
            )
            .unwrap();
            assert!(svg.contains(&format!("&quot;generator&quot;:&quot;{generator}&quot;")));
        }
    }
}
