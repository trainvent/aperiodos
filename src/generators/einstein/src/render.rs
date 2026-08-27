use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use aperiodos_render_core::{escape_xml, render_studio_elements, Affine, Renderer, Scene, Vec2};
use serde_json::{json, Value};

use crate::coloring::four_color_indices;
use crate::tiling::{generate_tiles, seed_to_coordinate, Tile, HAT_OUTLINE};

pub const DEFAULT_COLORS: [&str; 5] = ["black", "seagreen", "white", "sandybrown", "gold"];
pub const DEFAULT_FOUR_COLORS: [&str; 4] = ["seagreen", "sienna", "goldenrod", "midnightblue"];
const SEED_SIZE: u32 = 1600;
const SEED_SCALE: f64 = 50.0;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ColorMode {
    Families,
    FourColor,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MaterialMode {
    Solid,
    Pattern,
}

#[derive(Clone, Debug)]
pub struct EinsteinSvgConfig {
    pub width: u32,
    pub height: u32,
    pub iterations: usize,
    pub scale: f64,
    pub center_x: f64,
    pub center_y: f64,
    pub colors: Vec<String>,
    pub color_mode: ColorMode,
    pub four_colors: Vec<String>,
    pub background: String,
    pub outline: String,
    pub stroke_width: f64,
    pub material_mode: MaterialMode,
    pub pattern_base: String,
    pub pattern_color: String,
    pub studio_pattern: Option<Value>,
    pub seed: Option<u64>,
}

impl Default for EinsteinSvgConfig {
    fn default() -> Self {
        Self {
            width: 1600,
            height: 1600,
            iterations: 5,
            scale: 20.0,
            center_x: 0.0,
            center_y: 0.0,
            colors: DEFAULT_COLORS
                .iter()
                .map(|value| (*value).to_owned())
                .collect(),
            color_mode: ColorMode::Families,
            four_colors: DEFAULT_FOUR_COLORS
                .iter()
                .map(|value| (*value).to_owned())
                .collect(),
            background: "white".to_owned(),
            outline: "black".to_owned(),
            stroke_width: 2.0,
            material_mode: MaterialMode::Solid,
            pattern_base: "white".to_owned(),
            pattern_color: "#00c200".to_owned(),
            studio_pattern: None,
            seed: None,
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct EinsteinRenderer;

impl Renderer for EinsteinRenderer {
    type Config = EinsteinSvgConfig;

    fn scene(&self, config: &Self::Config) -> Result<Scene, String> {
        let (tiles, width, height, projection) = if let Some(seed) = config.seed {
            let offset = seed_to_coordinate(seed);
            let projection = Affine::new([
                SEED_SCALE,
                0.0,
                -config.center_x * SEED_SCALE - offset.x * SEED_SIZE as f64,
                0.0,
                SEED_SCALE,
                SEED_SIZE as f64 - config.center_y * SEED_SCALE + offset.y * SEED_SIZE as f64,
            ]);
            let mut generation = 1;
            let tiles = loop {
                let tiles = generate_tiles(generation);
                if crop_is_covered(&tiles, projection, SEED_SIZE, SEED_SIZE) {
                    break tiles;
                }
                generation += 1;
                if generation > 10 {
                    return Err(
                        "seed crop requires an unsupported number of generations".to_owned()
                    );
                }
            };
            (tiles, SEED_SIZE, SEED_SIZE, projection)
        } else {
            let projection = Affine::new([
                config.scale,
                0.0,
                config.width as f64 / 2.0 - config.center_x * config.scale,
                0.0,
                config.scale,
                config.height as f64 / 2.0 - config.center_y * config.scale,
            ]);
            (
                generate_tiles(config.iterations),
                config.width,
                config.height,
                projection,
            )
        };

        let palette = normalized_palette(&config.colors, &DEFAULT_COLORS);
        let four_palette = normalized_palette(&config.four_colors, &DEFAULT_FOUR_COLORS);
        let color_indices = if config.color_mode == ColorMode::FourColor {
            Some(four_color_indices(&tiles).map_err(str::to_owned)?)
        } else {
            None
        };
        let studio_ink = config
            .studio_pattern
            .as_ref()
            .and_then(|pattern| pattern.pointer("/colors/ink"))
            .and_then(Value::as_str)
            .unwrap_or(&config.pattern_color);
        let studio_base = config
            .studio_pattern
            .as_ref()
            .and_then(|pattern| pattern.pointer("/colors/base"))
            .and_then(Value::as_str)
            .unwrap_or(&config.pattern_base);
        let stroke = if config.stroke_width > 0.0 && !is_no_color(&config.outline) {
            config.outline.as_str()
        } else {
            "none"
        };

        let mut content = String::new();
        if config.material_mode == MaterialMode::Pattern {
            content.push_str(&pattern_defs(config.studio_pattern.as_ref(), studio_ink));
            content.push('\n');
        }

        for (index, tile) in tiles.iter().enumerate() {
            if config.material_mode == MaterialMode::Pattern {
                write_pattern_tile(
                    &mut content,
                    tile,
                    projection,
                    studio_base,
                    studio_ink,
                    stroke,
                    config.stroke_width,
                );
            } else {
                let fill = match &color_indices {
                    Some(indices) => &four_palette[indices[index]],
                    None => &palette[tile.label.palette_index()],
                };
                write_solid_tile(
                    &mut content,
                    tile,
                    projection,
                    fill,
                    stroke,
                    config.stroke_width,
                );
            }
        }
        let mut scene = Scene::new(
            width,
            height,
            &config.background,
            "einstein",
            json!({
                "width": config.width, "height": config.height, "iterations": config.iterations,
                "scale": config.scale, "center_x": config.center_x, "center_y": config.center_y,
                "colors": config.colors,
                "color_mode": match config.color_mode { ColorMode::Families => "families", ColorMode::FourColor => "four-color" },
                "four_colors": config.four_colors, "background": config.background,
                "outline": config.outline, "stroke_width": config.stroke_width,
                "material_mode": match config.material_mode { MaterialMode::Solid => "solid", MaterialMode::Pattern => "pattern" },
                "pattern_base": config.pattern_base, "pattern_color": config.pattern_color,
                "studio_pattern": config.studio_pattern, "seed": config.seed,
            }),
        );
        scene.push_raw(content);
        Ok(scene)
    }
}

pub fn render_svg(config: &EinsteinSvgConfig) -> Result<String, String> {
    EinsteinRenderer.render_svg(config)
}

pub fn write_svg(path: impl AsRef<Path>, config: &EinsteinSvgConfig) -> Result<(), String> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, render_svg(config)?).map_err(|error| error.to_string())
}

fn normalized_palette(values: &[String], defaults: &[&str]) -> Vec<String> {
    (0..defaults.len())
        .map(|index| {
            values
                .get(index)
                .cloned()
                .unwrap_or_else(|| defaults[index].to_owned())
        })
        .collect()
}

fn is_no_color(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "none" | "transparent"
    )
}

fn write_solid_tile(
    svg: &mut String,
    tile: &Tile,
    projection: Affine,
    fill: &str,
    stroke: &str,
    stroke_width: f64,
) {
    let points = tile
        .vertices
        .iter()
        .map(|point| projection.apply(*point))
        .map(|point| format!("{:.2},{:.2}", point.x, point.y))
        .collect::<Vec<_>>()
        .join(" ");
    let _ = writeln!(svg, "<polygon points=\"{points}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{stroke_width}\" stroke-linejoin=\"round\" />", escape_xml(fill), escape_xml(stroke));
}

fn write_pattern_tile(
    svg: &mut String,
    tile: &Tile,
    projection: Affine,
    fill: &str,
    ink: &str,
    stroke: &str,
    stroke_width: f64,
) {
    let matrix = projection.then(tile.transform).0;
    let _ = writeln!(
        svg,
        "<g transform=\"matrix({:.6} {:.6} {:.6} {:.6} {:.6} {:.6})\" style=\"--einstein-tile-fill:{}\"><polygon points=\"{}\" fill=\"{}\" /><g clip-path=\"url(#einstein-hat-clip)\" stroke=\"{}\" color=\"{}\"><use href=\"#einstein-curves-motif\" /></g><polygon points=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\" stroke-linejoin=\"round\" vector-effect=\"non-scaling-stroke\" /></g>",
        matrix[0], matrix[3], matrix[1], matrix[4], matrix[2], matrix[5],
        escape_xml(fill), hat_points(), escape_xml(fill), escape_xml(ink), escape_xml(ink), hat_points(), escape_xml(stroke), stroke_width,
    );
}

fn hat_points() -> String {
    HAT_OUTLINE
        .iter()
        .map(|point| format!("{:.4},{:.4}", point.x, point.y))
        .collect::<Vec<_>>()
        .join(" ")
}

fn pattern_defs(pattern: Option<&Value>, fallback_color: &str) -> String {
    let motif = match pattern {
        Some(pattern) => render_studio_elements(
            pattern,
            fallback_color,
            "var(--einstein-tile-fill)",
            Affine::IDENTITY,
            1.0,
        ),
        None => concat!(
            "<path d=\"M 0.00 1.53 C 0.45 1.52 1.10 1.95 1.67 2.50\" stroke-width=\"1.3200\" />",
            "<path d=\"M -1.16 -1.46 C -1.15 -1.18 -0.25 -1.72 1.17 -1.36 C 1.91 0.29 3.46 0.31 4.43 -0.74\" stroke-width=\"1.6200\" />"
        ).to_owned(),
    };
    format!("<defs><clipPath id=\"einstein-hat-clip\" clipPathUnits=\"userSpaceOnUse\"><polygon points=\"{}\" /></clipPath><g id=\"einstein-curves-motif\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">{motif}</g></defs>", hat_points())
}

fn crop_is_covered(tiles: &[Tile], projection: Affine, width: u32, height: u32) -> bool {
    let inverse = projection.inverse();
    const CELL_SIZE: f64 = 8.0;
    let mut cells: HashMap<(i32, i32), Vec<usize>> = HashMap::new();
    for (index, tile) in tiles.iter().enumerate() {
        let (mut min_x, mut min_y, mut max_x, mut max_y) = (
            f64::INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NEG_INFINITY,
        );
        for point in &tile.vertices {
            min_x = min_x.min(point.x);
            min_y = min_y.min(point.y);
            max_x = max_x.max(point.x);
            max_y = max_y.max(point.y);
        }
        for cell_x in (min_x / CELL_SIZE).floor() as i32..=(max_x / CELL_SIZE).floor() as i32 {
            for cell_y in (min_y / CELL_SIZE).floor() as i32..=(max_y / CELL_SIZE).floor() as i32 {
                cells.entry((cell_x, cell_y)).or_default().push(index);
            }
        }
    }
    let mut uncovered = 0;
    let pixels = (0..height)
        .flat_map(|y| (0..width).map(move |x| Vec2::new(x as f64 + 0.5, y as f64 + 0.5)));
    for screen_point in pixels {
        let point = inverse.apply(screen_point);
        let key = (
            (point.x / CELL_SIZE).floor() as i32,
            (point.y / CELL_SIZE).floor() as i32,
        );
        let covered = cells.get(&key).is_some_and(|indices| {
            indices
                .iter()
                .any(|index| point_in_polygon(point, &tiles[*index].vertices))
        });
        if !covered {
            uncovered += 1;
            if uncovered > 3 {
                return false;
            }
        }
    }
    true
}

fn point_in_polygon(point: Vec2, polygon: &[Vec2]) -> bool {
    let mut inside = false;
    let mut previous = polygon[polygon.len() - 1];
    for &current in polygon {
        let edge = current - previous;
        let relative = point - previous;
        let cross = edge.x * relative.y - edge.y * relative.x;
        if cross.abs() < 1e-9
            && relative.x * edge.x + relative.y * edge.y >= -1e-9
            && relative.x * edge.x + relative.y * edge.y <= edge.x * edge.x + edge.y * edge.y + 1e-9
        {
            return true;
        }
        let crosses = (current.y > point.y) != (previous.y > point.y)
            && point.x
                < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y)
                    + current.x;
        if crosses {
            inside = !inside;
        }
        previous = current;
    }
    inside
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn solid_svg_preserves_family_fill() {
        let config = EinsteinSvgConfig {
            iterations: 1,
            width: 160,
            height: 160,
            scale: 10.0,
            colors: vec![
                "red".into(),
                "blue".into(),
                "white".into(),
                "orange".into(),
                "gold".into(),
            ],
            ..Default::default()
        };
        let svg = render_svg(&config).unwrap();
        assert!(svg.contains("fill=\"red\""));
        assert!(svg.contains("fill=\"blue\""));
        assert!(!svg.contains("clipPath"));
    }

    #[test]
    fn pattern_is_clipped_and_studio_layers_are_rendered() {
        let config = EinsteinSvgConfig {
            iterations: 1,
            material_mode: MaterialMode::Pattern,
            studio_pattern: Some(json!({
                "colors": {"base": "ivory", "ink": "navy"},
                "paths": [], "lines": [{"id": "line", "points": [{"u": 0, "v": 0}, {"u": 1, "v": 0}], "width": 0.2}],
                "circles": [{"id": "dot", "center": {"u": 1, "v": 1}, "radius": 0.25, "operation": "ink"}],
                "circularPaths": [], "layerOrder": [{"kind": "line", "id": "line"}, {"kind": "circle", "id": "dot"}]
            })),
            ..Default::default()
        };
        let svg = render_svg(&config).unwrap();
        assert!(svg.contains("id=\"einstein-hat-clip\""));
        assert!(svg.contains("stroke=\"navy\""));
        assert!(svg.contains("fill=\"ivory\""));
        assert!(svg.find("M 0.0000 0.0000").unwrap() < svg.find("<circle").unwrap());
    }

    #[test]
    fn user_colors_are_xml_escaped() {
        let config = EinsteinSvgConfig {
            iterations: 1,
            background: "<&".into(),
            ..Default::default()
        };
        assert!(render_svg(&config).unwrap().contains("fill=\"&lt;&amp;\""));
    }
}
