mod classic_logic;
mod p1_logic;
mod rhombs_logic;

use std::fs;
use std::path::Path;

use aperiodos_render_core::{
    render_studio_elements, Affine, Polygon, Renderer, Scene, Vec2 as ScenePoint,
};
use serde_json::{json, Value};

use crate::math::Vec2;

const PHI: f64 = 1.618_033_988_749_895;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PenroseSeed {
    Sun,
    Star,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PenroseTileMode {
    KiteDart,
    Rhombs,
    P1,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PenroseMaterialMode {
    Solid,
    Pattern,
}

#[derive(Clone, Debug)]
pub struct PenroseSvgConfig {
    pub width: u32,
    pub height: u32,
    pub iterations: usize,
    pub scale: f64,
    pub center_x: f64,
    pub center_y: f64,
    pub palette: Vec<String>,
    pub background: String,
    pub outline: String,
    pub stroke_width: f64,
    pub seed: PenroseSeed,
    pub tile_mode: PenroseTileMode,
    pub material_mode: PenroseMaterialMode,
    pub studio_pattern: Option<Value>,
}

impl Default for PenroseSvgConfig {
    fn default() -> Self {
        Self {
            width: 1600,
            height: 1600,
            iterations: 7,
            scale: 320.0,
            center_x: 0.0,
            center_y: 0.0,
            palette: vec![
                "wheat".to_string(),
                "crimson".to_string(),
                "steelblue".to_string(),
                "darkgoldenrod".to_string(),
            ],
            background: "white".to_string(),
            outline: "black".to_string(),
            stroke_width: 1.0,
            seed: PenroseSeed::Sun,
            tile_mode: PenroseTileMode::KiteDart,
            material_mode: PenroseMaterialMode::Solid,
            studio_pattern: None,
        }
    }
}

#[derive(Clone, Debug)]
pub(super) struct RenderTile {
    pub(super) points: Vec<Vec2>,
    pub(super) fill_index: usize,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct PenroseRenderer;

impl Renderer for PenroseRenderer {
    type Config = PenroseSvgConfig;

    fn scene(&self, config: &Self::Config) -> Result<Scene, String> {
        let palette = normalized_palette(config);
        let tiles = match config.tile_mode {
            PenroseTileMode::KiteDart => {
                classic_logic::render_tiles(config.seed, config.iterations)
            }
            PenroseTileMode::Rhombs => rhombs_logic::render_tiles(config.seed, config.iterations),
            PenroseTileMode::P1 => p1_logic::render_tiles(config.seed, config.iterations),
        };

        let mut scene = Scene::new(
            config.width,
            config.height,
            &config.background,
            "penrose",
            json!({
                "width": config.width, "height": config.height, "iterations": config.iterations,
                "scale": config.scale, "center_x": config.center_x, "center_y": config.center_y,
                "palette": config.palette, "background": config.background, "outline": config.outline,
                "stroke_width": config.stroke_width,
                "seed": match config.seed { PenroseSeed::Sun => "sun", PenroseSeed::Star => "star" },
                "tile_mode": match config.tile_mode { PenroseTileMode::KiteDart => "kite-dart", PenroseTileMode::Rhombs => "rhombs", PenroseTileMode::P1 => "p1" },
                "material_mode": match config.material_mode { PenroseMaterialMode::Solid => "solid", PenroseMaterialMode::Pattern => "pattern" },
                "studio_pattern": config.studio_pattern,
            }),
        );

        let built_in_pattern = json!({
            "schema":"aperiodos.material-design", "version":1, "tile":"penrose",
            "colors":{"ink":config.outline,"base":"transparent"},
            "lines":[
                {"id":"diagonal-a","points":[{"u":0.08,"v":0.08},{"u":0.92,"v":0.92}],"width":0.055},
                {"id":"diagonal-b","points":[{"u":0.08,"v":0.92},{"u":0.92,"v":0.08}],"width":0.055}
            ]
        });
        let material = (config.material_mode == PenroseMaterialMode::Pattern)
            .then(|| config.studio_pattern.as_ref().unwrap_or(&built_in_pattern));

        for tile in tiles {
            if !tile_visible(&tile, config) {
                continue;
            }
            let points = tile
                .points
                .iter()
                .map(|point| {
                    let (x, y) = svg_point(*point, config);
                    ScenePoint::new(x, y)
                })
                .collect();
            push_tile(
                &mut scene,
                points,
                &palette[tile.fill_index],
                config,
                material,
                tile.fill_index,
            );
        }
        Ok(scene)
    }
}

fn push_tile(
    scene: &mut Scene,
    points: Vec<ScenePoint>,
    fill: &str,
    config: &PenroseSvgConfig,
    material: Option<&Value>,
    palette_index: usize,
) {
    scene.push_polygon(Polygon::new(
        points.clone(),
        fill,
        &config.outline,
        config.stroke_width,
    ));
    let Some(pattern) = material else { return };
    if points.len() < 3 {
        return;
    }
    let (p0, p1, p2) = (points[0], points[1], points[2]);
    let root = 3.0_f64.sqrt() / 2.0;
    let (a, b) = (p1.x - p0.x, p1.y - p0.y);
    let (c, d) = (
        (p2.x - p0.x - 0.5 * a) / root,
        (p2.y - p0.y - 0.5 * b) / root,
    );
    let transform = Affine::new([a, c, p0.x, b, d, p0.y]);
    let clip_id = format!(
        "studio-penrose-tile-{}-{palette_index}",
        scene.elements.len()
    );
    let polygon_points = points
        .iter()
        .map(|point| format!("{:.2},{:.2}", point.x, point.y))
        .collect::<Vec<_>>()
        .join(" ");
    scene.definitions.push(format!(
        "<clipPath id=\"{clip_id}\"><polygon points=\"{polygon_points}\" /></clipPath>"
    ));
    let ink = pattern
        .pointer("/colors/ink")
        .and_then(Value::as_str)
        .unwrap_or(&config.outline);
    let motif = render_studio_elements(pattern, ink, fill, transform, a.hypot(b));
    scene.push_raw(format!("<g clip-path=\"url(#{clip_id})\">{motif}</g>"));
}

pub fn render_svg(config: &PenroseSvgConfig) -> String {
    PenroseRenderer
        .render_svg(config)
        .expect("Penrose scene construction is infallible")
}

pub fn write_svg(path: impl AsRef<Path>, config: &PenroseSvgConfig) -> std::io::Result<()> {
    fs::write(path, render_svg(config))
}

fn normalized_palette(config: &PenroseSvgConfig) -> Vec<String> {
    if config.palette.is_empty() {
        return PenroseSvgConfig::default().palette;
    }

    let mut palette = config.palette.clone();
    let defaults = PenroseSvgConfig::default().palette;
    let minimum_colors = match config.tile_mode {
        PenroseTileMode::KiteDart if config.seed == PenroseSeed::Star => 4,
        PenroseTileMode::P1 => 4,
        _ => 2,
    };
    while palette.len() < minimum_colors {
        palette.push(defaults[palette.len()].clone());
    }
    palette
}

fn tile_visible(tile: &RenderTile, config: &PenroseSvgConfig) -> bool {
    let half_width = config.width as f64 / (2.0 * config.scale);
    let half_height = config.height as f64 / (2.0 * config.scale);
    let min_x = config.center_x - half_width - 1.0;
    let max_x = config.center_x + half_width + 1.0;
    let min_y = config.center_y - half_height - 1.0;
    let max_y = config.center_y + half_height + 1.0;

    tile.points
        .iter()
        .any(|point| point.x >= min_x && point.x <= max_x && point.y >= min_y && point.y <= max_y)
}

pub(super) fn polar(radius: f64, angle: f64) -> Vec2 {
    Vec2::new(radius * angle.cos(), radius * angle.sin())
}

pub(super) fn distance(left: Vec2, right: Vec2) -> f64 {
    let delta = right - left;
    (delta.x * delta.x + delta.y * delta.y).sqrt()
}

pub(super) fn approx_eq(left: f64, right: f64) -> bool {
    (left - right).abs() <= 1e-6
}

fn svg_point(point: Vec2, config: &PenroseSvgConfig) -> (f64, f64) {
    let x = (point.x - config.center_x) * config.scale + config.width as f64 / 2.0;
    let y = config.height as f64 / 2.0 - (point.y - config.center_y) * config.scale;
    (x, y)
}
