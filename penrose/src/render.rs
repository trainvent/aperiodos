use std::f64::consts::PI;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use crate::math::Vec2;

const PHI: f64 = 1.618_033_988_749_895;
const INV_PHI: f64 = 1.0 / PHI;
const WEIGHT: f64 = INV_PHI / (1.0 + INV_PHI);
const EDGE_EPSILON: f64 = 1e-6;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PenroseSeed {
    Sun,
    Star,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PenroseColorMode {
    TileType,
    Orientation,
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
    pub color_mode: PenroseColorMode,
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
                "#204f7a".to_string(),
                "#d18c45".to_string(),
                "#eadfc8".to_string(),
                "#7e2f39".to_string(),
            ],
            background: "#f5f1e7".to_string(),
            outline: "#17313b".to_string(),
            stroke_width: 1.1,
            seed: PenroseSeed::Sun,
            color_mode: PenroseColorMode::TileType,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum HalfTileKind {
    Kite,
    Dart,
}

#[derive(Clone, Debug)]
struct HalfTile {
    kind: HalfTileKind,
    vertices: [Vec2; 3],
}

#[derive(Clone, Debug)]
struct SharedEdge {
    endpoints: (Vec2, Vec2),
}

impl HalfTile {
    fn acute(base_left: Vec2, base_right: Vec2, apex: Vec2) -> Self {
        Self {
            kind: HalfTileKind::Kite,
            vertices: [base_left, base_right, apex],
        }
    }

    fn obtuse(apex: Vec2, base_left: Vec2, base_right: Vec2) -> Self {
        Self {
            kind: HalfTileKind::Dart,
            vertices: [apex, base_left, base_right],
        }
    }

    fn subdivide(&self) -> Vec<Self> {
        match self.kind {
            HalfTileKind::Kite => split_kite_half(self),
            HalfTileKind::Dart => split_dart_half(self),
        }
    }

    fn pairing_edge(&self) -> SharedEdge {
        let edge = match self.kind {
            // A kite is two acute Robinson triangles glued along a long edge,
            // while a dart is two obtuse triangles glued along a short edge.
            HalfTileKind::Kite => longest_edge(&self.vertices),
            HalfTileKind::Dart => shortest_edge(&self.vertices),
        };
        SharedEdge { endpoints: edge }
    }
}

pub fn render_svg(config: &PenroseSvgConfig) -> String {
    let palette = normalized_palette(config);
    let mut halves = initial_seed(config.seed);
    for _ in 0..config.iterations {
        halves = halves.into_iter().flat_map(|tile| tile.subdivide()).collect();
    }
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

    for tile in &halves {
        if !half_tile_visible(tile, config) {
            continue;
        }
        let fill = half_tile_color(tile, config, &palette);
        let points = svg_triangle_points(&tile.vertices, config);
        let _ = writeln!(
            document,
            "<polygon points=\"{}\" fill=\"{}\" stroke=\"none\" />",
            points, fill
        );

        let hidden = tile.pairing_edge().endpoints;
        for (start, end) in triangle_edges(&tile.vertices) {
            if same_undirected_edge((start, end), hidden) {
                continue;
            }
            let (x1, y1) = svg_point(start, config);
            let (x2, y2) = svg_point(end, config);
            let _ = writeln!(
                document,
                "<line x1=\"{x1:.2}\" y1=\"{y1:.2}\" x2=\"{x2:.2}\" y2=\"{y2:.2}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linecap=\"round\" />",
                config.outline,
                config.stroke_width
            );
        }
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
    while palette.len() < 4 {
        palette.push(defaults[palette.len()].clone());
    }
    palette
}

fn initial_seed(seed: PenroseSeed) -> Vec<HalfTile> {
    match seed {
        PenroseSeed::Sun => sun_seed(),
        PenroseSeed::Star => star_seed(),
    }
}

fn sun_seed() -> Vec<HalfTile> {
    let center = Vec2::new(0.0, 0.0);
    let radius = 1.0;
    let ring: Vec<_> = (0..10)
        .map(|index| {
            let angle = (index as f64 * 36.0 - 90.0) * PI / 180.0;
            Vec2::new(radius * angle.cos(), radius * angle.sin())
        })
        .collect();

    (0..10)
        .map(|index| HalfTile::acute(ring[index], ring[(index + 1) % 10], center))
        .collect()
}

fn star_seed() -> Vec<HalfTile> {
    let radius = 1.0;
    let ring: Vec<_> = (0..5)
        .map(|index| {
            let angle = (index as f64 * 72.0 - 90.0) * PI / 180.0;
            Vec2::new(radius * angle.cos(), radius * angle.sin())
        })
        .collect();

    let mut tiles = Vec::new();
    for index in 0..5 {
        let left = ring[index];
        let right = ring[(index + 1) % 5];
        let midpoint = (left + right) / 2.0;
        let inward = midpoint * (1.0 / PHI);
        tiles.push(HalfTile::obtuse(inward, left, right));
        tiles.push(HalfTile::obtuse(inward, right, left));
    }
    tiles
}

fn split_kite_half(tile: &HalfTile) -> Vec<HalfTile> {
    let [x1, x2, x3] = tile.vertices;
    let a = weighted_point(x3, x2);
    let b = weighted_point(x1, x3);
    vec![
        HalfTile::acute(b, x1, x2),
        HalfTile::acute(b, a, x2),
        HalfTile::obtuse(a, b, x3),
    ]
}

fn split_dart_half(tile: &HalfTile) -> Vec<HalfTile> {
    let [x1, x2, x3] = tile.vertices;
    let c = weighted_point(x2, x3);
    vec![HalfTile::acute(x1, c, x3), HalfTile::obtuse(c, x1, x2)]
}

fn weighted_point(a: Vec2, b: Vec2) -> Vec2 {
    a.lerp(b, WEIGHT)
}

fn half_tile_color<'a>(
    tile: &HalfTile,
    config: &PenroseSvgConfig,
    palette: &'a [String],
) -> &'a str {
    match config.color_mode {
        PenroseColorMode::TileType => match tile.kind {
            HalfTileKind::Kite => &palette[0],
            HalfTileKind::Dart => &palette[1],
        },
        PenroseColorMode::Orientation => {
            let center = triangle_center(&tile.vertices);
            let angle = center.y.atan2(center.x);
            let normalized = ((angle + PI) / (2.0 * PI)).rem_euclid(1.0);
            let bucket = ((normalized * palette.len() as f64).floor() as usize).min(palette.len() - 1);
            &palette[bucket]
        }
    }
}

fn half_tile_visible(tile: &HalfTile, config: &PenroseSvgConfig) -> bool {
    let half_width = config.width as f64 / (2.0 * config.scale);
    let half_height = config.height as f64 / (2.0 * config.scale);
    let min_x = config.center_x - half_width - 0.2;
    let max_x = config.center_x + half_width + 0.2;
    let min_y = config.center_y - half_height - 0.2;
    let max_y = config.center_y + half_height + 0.2;
    tile.vertices.iter().any(|point| point.x >= min_x && point.x <= max_x && point.y >= min_y && point.y <= max_y)
}

fn svg_triangle_points(vertices: &[Vec2; 3], config: &PenroseSvgConfig) -> String {
    vertices
        .iter()
        .map(|point| {
            let (x, y) = svg_point(*point, config);
            format!("{x:.2},{y:.2}")
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn svg_point(point: Vec2, config: &PenroseSvgConfig) -> (f64, f64) {
    let x = (point.x - config.center_x) * config.scale + config.width as f64 / 2.0;
    let y = config.height as f64 / 2.0 - (point.y - config.center_y) * config.scale;
    (x, y)
}

fn triangle_center(vertices: &[Vec2; 3]) -> Vec2 {
    vertices.iter().copied().fold(Vec2::default(), |sum, point| sum + point) / 3.0
}

fn same_undirected_edge(left: (Vec2, Vec2), right: (Vec2, Vec2)) -> bool {
    (same_point(left.0, right.0) && same_point(left.1, right.1))
        || (same_point(left.0, right.1) && same_point(left.1, right.0))
}

fn longest_edge(vertices: &[Vec2; 3]) -> (Vec2, Vec2) {
    let mut edges = triangle_edges(vertices);
    edges.sort_by(|(a0, a1), (b0, b1)| edge_length_sq(*a0, *a1).total_cmp(&edge_length_sq(*b0, *b1)));
    edges[2]
}

fn shortest_edge(vertices: &[Vec2; 3]) -> (Vec2, Vec2) {
    let mut edges = triangle_edges(vertices);
    edges.sort_by(|(a0, a1), (b0, b1)| edge_length_sq(*a0, *a1).total_cmp(&edge_length_sq(*b0, *b1)));
    edges[0]
}

fn triangle_edges(vertices: &[Vec2; 3]) -> [(Vec2, Vec2); 3] {
    [
        (vertices[0], vertices[1]),
        (vertices[1], vertices[2]),
        (vertices[2], vertices[0]),
    ]
}

fn edge_length_sq(a: Vec2, b: Vec2) -> f64 {
    let delta = a - b;
    delta.x * delta.x + delta.y * delta.y
}

fn same_point(a: Vec2, b: Vec2) -> bool {
    same_coord(a.x, b.x) && same_coord(a.y, b.y)
}

fn same_coord(a: f64, b: f64) -> bool {
    (a - b).abs() <= EDGE_EPSILON
}
