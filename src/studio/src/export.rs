use std::fmt::Write as _;

use aperiodos_render_core::{escape_xml, Affine, Vec2};
use serde_json::Value;

use crate::geometry::{material_transform, shapes_for_family, spectre_edge_control, Point};
use crate::render_studio_elements;

const WIDTH: f64 = 760.0;
const HEIGHT: f64 = 620.0;
const ORIGIN_X: f64 = 270.0;
const ORIGIN_Y: f64 = 330.0;
const DEFAULT_SCALE: f64 = 82.0;

fn family_for(design: &Value) -> &'static str {
    match design.get("tile").and_then(Value::as_str) {
        Some("spectre") => "spectre",
        Some("penrose") => match design.get("tileMode").and_then(Value::as_str) {
            Some("rhombs") => "penrose-rhombs",
            Some("p1") => "penrose-p1",
            _ => "penrose-kite-dart",
        },
        _ => "einstein",
    }
}

fn bounds(points: &[Point]) -> (f64, f64, f64, f64) {
    points.iter().fold(
        (
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ),
        |(min_x, max_x, min_y, max_y), point| {
            (
                min_x.min(point.x),
                max_x.max(point.x),
                min_y.min(point.y),
                max_y.max(point.y),
            )
        },
    )
}

fn canvas_scale(points: &[Point], fit: bool) -> f64 {
    if !fit {
        return DEFAULT_SCALE;
    }
    let (min_x, max_x, min_y, max_y) = bounds(points);
    ((WIDTH - 240.0) / (max_x - min_x).max(0.5)).min((HEIGHT - 240.0) / (max_y - min_y).max(0.5))
}

fn canvas_transform(points: &[Point], scale: f64, center: bool) -> Affine {
    let mut offset_x = 0.0;
    let mut offset_y = 0.0;
    if center {
        let (min_x, max_x, min_y, max_y) = bounds(points);
        let screen_min_x = WIDTH - (ORIGIN_X + max_x * scale);
        let screen_max_x = WIDTH - (ORIGIN_X + min_x * scale);
        let screen_min_y = HEIGHT - ORIGIN_Y + min_y * scale;
        let screen_max_y = HEIGHT - ORIGIN_Y + max_y * scale;
        offset_x = WIDTH / 2.0 - (screen_min_x + screen_max_x) / 2.0;
        offset_y = HEIGHT / 2.0 - (screen_min_y + screen_max_y) / 2.0;
    }
    Affine::new([
        -scale,
        0.0,
        WIDTH - ORIGIN_X + offset_x,
        0.0,
        scale,
        HEIGHT - ORIGIN_Y + offset_y,
    ])
}

fn polygon_points(points: &[Point], transform: Affine) -> String {
    points
        .iter()
        .map(|point| {
            let point = transform.apply(Vec2::new(point.x, point.y));
            format!("{:.2},{:.2}", point.x, point.y)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn spectre_path(points: &[Point], transform: Affine, design: &Value) -> String {
    let roundness = design
        .pointer("/tileShape/roundness")
        .and_then(Value::as_f64)
        .unwrap_or(0.18);
    let lean = design
        .pointer("/tileShape/lean")
        .and_then(Value::as_f64)
        .unwrap_or(1.0);
    let weight = design
        .pointer("/tileShape/weight")
        .and_then(Value::as_f64)
        .unwrap_or(0.5);
    let first = transform.apply(Vec2::new(points[0].x, points[0].y));
    let mut path = format!("M {:.2} {:.2}", first.x, first.y);
    for (index, start) in points.iter().copied().enumerate() {
        let end = points[(index + 1) % points.len()];
        let control = spectre_edge_control(start, end, index, roundness, lean, weight);
        let control = transform.apply(Vec2::new(control.x, control.y));
        let end = transform.apply(Vec2::new(end.x, end.y));
        let _ = write!(
            path,
            " Q {:.2} {:.2} {:.2} {:.2}",
            control.x, control.y, end.x, end.y
        );
    }
    path.push_str(" Z");
    path
}

pub fn export_svg(design: &Value, tile_type: Option<&str>) -> Result<String, String> {
    let family = family_for(design);
    let shapes = shapes_for_family(family).map_err(|error| error.to_string())?;
    let shape = if family.starts_with("penrose") {
        shapes
            .iter()
            .find(|shape| Some(shape.tile_type) == tile_type)
            .unwrap_or(&shapes[0])
    } else {
        &shapes[0]
    };
    let fit = family.starts_with("penrose");
    let scale = canvas_scale(&shape.points, fit);
    let screen = canvas_transform(&shape.points, scale, family != "einstein");
    let (material_to_canvas, material_scale) = if fit {
        let (material_to_shape, _, material_scale) = material_transform(&shape.points);
        (
            screen.then(Affine::new(material_to_shape)),
            scale * material_scale,
        )
    } else {
        (screen, scale)
    };
    let base = design
        .pointer("/colors/base")
        .and_then(Value::as_str)
        .unwrap_or("#ffffff");
    let ink = design
        .pointer("/colors/ink")
        .and_then(Value::as_str)
        .unwrap_or("#00c200");
    let outline = design
        .get("outline")
        .and_then(Value::as_str)
        .unwrap_or("#17313b");
    let stroke_width = design
        .get("strokeWidth")
        .and_then(Value::as_f64)
        .unwrap_or(if family == "spectre" { 1.0 } else { 2.0 });
    let geometry = if family == "spectre" {
        format!(
            "<path d=\"{}\"",
            spectre_path(&shape.points, screen, design)
        )
    } else {
        format!(
            "<polygon points=\"{}\"",
            polygon_points(&shape.points, screen)
        )
    };
    let material = render_studio_elements(
        design,
        ink,
        base,
        material_to_canvas,
        material_scale,
        if fit { Some(shape.tile_type) } else { None },
    );
    Ok(format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 760 620\" width=\"760\" height=\"620\"><title>{}</title><defs><clipPath id=\"tile\">{} /></clipPath></defs><rect width=\"100%\" height=\"100%\" fill=\"white\"/>{} fill=\"{}\" /><g clip-path=\"url(#tile)\">{}</g>{} fill=\"none\" stroke=\"{}\" stroke-width=\"{:.2}\" stroke-linejoin=\"round\" /></svg>",
        escape_xml(design.get("name").and_then(Value::as_str).unwrap_or("material-design")),
        geometry,
        geometry,
        escape_xml(base),
        material,
        geometry,
        escape_xml(outline),
        stroke_width,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn design(tile: &str) -> Value {
        json!({
            "name":"A < B","tile":tile,"colors":{"base":"#ffffff","ink":"#00c200"},
            "outline":"#17313b","strokeWidth":2,
            "paths":[],"circles":[],"circularPaths":[],
            "lines":[{"id":"line","width":0.2,"points":[{"u":0,"v":0},{"u":1,"v":0}]}]
        })
    }

    #[test]
    fn exports_well_formed_native_tile_shells_for_every_generator() {
        for (tile, mode, tile_type, element) in [
            ("einstein-hat", None, None, "<polygon"),
            ("spectre", None, None, "<path"),
            ("penrose", Some("p1"), Some("star"), "<polygon"),
        ] {
            let mut value = design(tile);
            if let Some(mode) = mode {
                value["tileMode"] = json!(mode);
            }
            let svg = export_svg(&value, tile_type).unwrap();
            assert!(svg.starts_with("<svg xmlns=\"http://www.w3.org/2000/svg\""));
            assert!(svg.contains("<clipPath id=\"tile\">"));
            assert!(svg.contains(element));
            assert!(svg.contains("<title>A &lt; B</title>"));
            assert!(svg.ends_with("</svg>"));
        }
    }

    #[test]
    fn penrose_export_applies_prototile_material_scope() {
        let mut value = design("penrose");
        value["tileMode"] = json!("p1");
        value["lines"] = json!([
            {"id":"star","tileType":"star","color":"#110001","width":0.2,"points":[{"u":0,"v":0},{"u":1,"v":0}]},
            {"id":"boat","tileType":"boat","color":"#220002","width":0.2,"points":[{"u":0,"v":0},{"u":1,"v":0}]}
        ]);
        let svg = export_svg(&value, Some("star")).unwrap();
        assert!(svg.contains("#110001"));
        assert!(!svg.contains("#220002"));
    }
}
