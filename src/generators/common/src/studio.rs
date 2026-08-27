use std::collections::{HashMap, HashSet};
use std::f64::consts::{PI, TAU};
use std::fmt::Write as _;

use serde_json::Value;

use crate::{escape_xml, Affine, Vec2};

/// Renders a Studio material document through an affine mapping. This is the
/// shared material engine used by every tiling renderer; the Studio UI remains
/// a regular React application.
pub fn render_studio_elements(
    pattern: &Value,
    fallback_ink: &str,
    base_fill: &str,
    transform: Affine,
    width_scale: f64,
) -> String {
    let kinds = [
        ("path", "paths"),
        ("line", "lines"),
        ("circle", "circles"),
        ("circularPath", "circularPaths"),
    ];
    let mut collections: HashMap<&str, HashMap<&str, &Value>> = HashMap::new();
    for (kind, key) in kinds {
        collections.insert(
            kind,
            pattern
                .get(key)
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(|item| Some((item.get("id")?.as_str()?, item)))
                .collect(),
        );
    }
    let mut order = Vec::new();
    let mut seen = HashSet::new();
    if let Some(entries) = pattern.get("layerOrder").and_then(Value::as_array) {
        for entry in entries {
            let (Some(kind), Some(id)) = (
                entry.get("kind").and_then(Value::as_str),
                entry.get("id").and_then(Value::as_str),
            ) else {
                continue;
            };
            if collections
                .get(kind)
                .is_some_and(|items| items.contains_key(id))
                && seen.insert((kind, id))
            {
                order.push((kind, id));
            }
        }
    }
    for (kind, key) in kinds {
        for item in pattern
            .get(key)
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            if let Some(id) = item.get("id").and_then(Value::as_str) {
                if seen.insert((kind, id)) {
                    order.push((kind, id));
                }
            }
        }
    }

    let mut output = String::new();
    for (kind, id) in order {
        let item = collections[kind][id];
        let color = escape_xml(
            item.get("color")
                .and_then(Value::as_str)
                .unwrap_or(fallback_ink),
        );
        match kind {
            "path" => {
                let points = item_points(item)
                    .into_iter()
                    .map(|p| transform.apply(p))
                    .collect::<Vec<_>>();
                let _ = write!(output, "<path d=\"{}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{:.4}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />", curve_path(&points), number(item, "width") * width_scale);
            }
            "line" => {
                let points = item_points(item)
                    .into_iter()
                    .map(|p| transform.apply(p))
                    .collect::<Vec<_>>();
                if points.len() == 2 {
                    let _ = write!(output, "<path d=\"M {:.4} {:.4} L {:.4} {:.4}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{:.4}\" stroke-linecap=\"round\" />", points[0].x, points[0].y, points[1].x, points[1].y, number(item, "width") * width_scale);
                }
            }
            "circle" => {
                let center = transform.apply(lattice_point(&item["center"]));
                let fill = if item.get("operation").and_then(Value::as_str) == Some("ink") {
                    color
                } else {
                    escape_xml(base_fill)
                };
                let _ = write!(output, "<circle cx=\"{:.4}\" cy=\"{:.4}\" r=\"{:.4}\" fill=\"{fill}\" stroke=\"none\" />", center.x, center.y, number(item, "radius") * width_scale);
            }
            "circularPath" => {
                for segment in circular_path_points(item) {
                    let points = segment
                        .into_iter()
                        .map(|p| transform.apply(p))
                        .collect::<Vec<_>>();
                    if let Some(first) = points.first() {
                        let mut path = format!("M {:.4} {:.4}", first.x, first.y);
                        for point in &points[1..] {
                            let _ = write!(path, " L {:.4} {:.4}", point.x, point.y);
                        }
                        let _ = write!(output, "<path d=\"{path}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"{:.4}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />", number(item, "width") * width_scale);
                    }
                }
            }
            _ => {}
        }
    }
    output
}

fn number(item: &Value, key: &str) -> f64 {
    item.get(key).and_then(Value::as_f64).unwrap_or(0.0)
}
fn lattice_point(point: &Value) -> Vec2 {
    let u = number(point, "u");
    let v = number(point, "v");
    Vec2::new(u + v / 2.0, v * 3.0_f64.sqrt() / 2.0)
}
fn item_points(item: &Value) -> Vec<Vec2> {
    item.get("points")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(lattice_point)
        .collect()
}
fn curve_path(points: &[Vec2]) -> String {
    let Some(first) = points.first() else {
        return String::new();
    };
    let mut path = format!("M {:.2} {:.2}", first.x, first.y);
    for controls in points[1..].chunks(3) {
        if controls.len() == 3 {
            let _ = write!(
                path,
                " C {:.2} {:.2} {:.2} {:.2} {:.2} {:.2}",
                controls[0].x,
                controls[0].y,
                controls[1].x,
                controls[1].y,
                controls[2].x,
                controls[2].y
            );
        }
    }
    path
}
fn circular_path_points(path: &Value) -> Vec<Vec<Vec2>> {
    let points = item_points(path);
    if points.len() != 3 {
        return Vec::new();
    }
    let v12 = points[1] - points[0];
    let v23 = points[2] - points[1];
    let radius = v12.x.hypot(v12.y) / 2.0;
    let a12 = v12.y.atan2(v12.x);
    let a23 = v23.y.atan2(v23.x);
    let direction = if path.get("side").and_then(Value::as_str) == Some("right") {
        -1.0
    } else {
        1.0
    };
    let delta = |start: f64, end: f64, direction: f64| {
        if direction > 0.0 {
            (end - start).rem_euclid(TAU)
        } else {
            -(start - end).rem_euclid(TAU)
        }
    };
    [
        (points[0], a12 + PI, direction * PI),
        (points[1], a12 + PI, delta(a12 + PI, a23, -direction)),
        (points[2], a23 + PI, direction * PI),
    ]
    .into_iter()
    .enumerate()
    .map(|(arc, (center, start, delta))| {
        let steps = ((delta.abs() / TAU * 72.0).ceil() as usize).max(2);
        let first = if arc == 1 { 1 } else { 0 };
        (first..=steps)
            .map(|index| {
                let angle = start + delta * index as f64 / steps as f64;
                Vec2::new(
                    center.x + radius * angle.cos(),
                    center.y + radius * angle.sin(),
                )
            })
            .collect()
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn maps_studio_lines_and_escapes_colors() {
        let pattern = serde_json::json!({"lines":[{"id":"l","points":[{"u":0,"v":0},{"u":1,"v":0}],"width":2,"color":"<&"}]});
        let svg = render_studio_elements(
            &pattern,
            "black",
            "white",
            Affine::translation(3.0, 4.0),
            2.0,
        );
        assert!(svg.contains("M 3.0000 4.0000 L 4.0000 4.0000"));
        assert!(svg.contains("stroke=\"&lt;&amp;\""));
        assert!(svg.contains("stroke-width=\"4.0000\""));
    }
}
