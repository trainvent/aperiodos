mod classic_logic;
mod p1_logic;
mod rhombs_logic;

use std::fmt::Write as _;
use std::fs;
use std::path::Path;

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
        }
    }
}

#[derive(Clone, Debug)]
pub(super) struct RenderTile {
    pub(super) points: Vec<Vec2>,
    pub(super) fill_index: usize,
}

pub fn render_svg(config: &PenroseSvgConfig) -> String {
    let palette = normalized_palette(config);
    let tiles = match config.tile_mode {
        PenroseTileMode::KiteDart => classic_logic::render_tiles(config.seed, config.iterations),
        PenroseTileMode::Rhombs => rhombs_logic::render_tiles(config.seed, config.iterations),
        PenroseTileMode::P1 => p1_logic::render_tiles(config.seed, config.iterations),
    };

    let mut document = String::new();
    let _ = writeln!(
        document,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {} {}\" width=\"{}\" height=\"{}\">",
        config.width, config.height, config.width, config.height
    );
    let _ = writeln!(
        document,
        "<rect width=\"100%\" height=\"100%\" fill=\"{}\" />",
        config.background
    );

    for tile in tiles {
        if !tile_visible(&tile, config) {
            continue;
        }
        let fill = &palette[tile.fill_index];
        let points = svg_polygon_points(&tile.points, config);
        let _ = writeln!(
            document,
            "<polygon points=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linejoin=\"round\" />",
            points, fill, config.outline, config.stroke_width
        );
    }

    document.push_str("</svg>\n");
    document
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

fn svg_polygon_points(points: &[Vec2], config: &PenroseSvgConfig) -> String {
    points
        .iter()
        .map(|point| {
            let (x, y) = svg_point(*point, config);
            format!("{x:.2},{y:.2}")
        })
        .collect::<Vec<_>>()
        .join(" ")
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
