use std::f64::consts::PI;
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
                "#e4d1ab".to_string(),
                "#d01916".to_string(),
                "#f1e4c5".to_string(),
                "#a31614".to_string(),
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
enum TriangleKind {
    Acute,
    Obtuse,
}

#[derive(Clone, Copy, Debug)]
struct Vertex {
    position: Vec2,
    parity: bool,
}

#[derive(Clone, Copy, Debug)]
struct Triangle {
    kind: TriangleKind,
    vertices: [Vertex; 3],
}

impl Vertex {
    fn new(position: Vec2, parity: bool) -> Self {
        Self { position, parity }
    }
}

impl Triangle {
    fn center(&self) -> Vec2 {
        self.vertices
            .iter()
            .fold(Vec2::default(), |sum, vertex| sum + vertex.position)
            / 3.0
    }
}

pub fn render_svg(config: &PenroseSvgConfig) -> String {
    let palette = normalized_palette(config);
    let mut triangles = initial_seed(config.seed);
    for _ in 0..config.iterations {
        triangles = subdivide(&triangles);
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

    for triangle in &triangles {
        if !triangle_visible(triangle, config) {
            continue;
        }
        let fill = triangle_color(triangle, config, &palette);
        let points = svg_triangle_points(triangle, config);
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
    while palette.len() < 4 {
        palette.push(defaults[palette.len()].clone());
    }
    palette
}

fn initial_seed(seed: PenroseSeed) -> Vec<Triangle> {
    match seed {
        PenroseSeed::Sun => initial_sun(10, 1.0),
        PenroseSeed::Star => initial_star(10, 1.0),
    }
}

fn initial_star(count: usize, size: f64) -> Vec<Triangle> {
    let mut triangles = Vec::with_capacity(count);
    for index in 0..count {
        let first = if index % 2 == 0 { size } else { size / PHI };
        let second = if index % 2 == 0 { size / PHI } else { size };
        let (a, b) = init_vertex_pair(index as f64, first, second);
        triangles.push(Triangle {
            kind: TriangleKind::Obtuse,
            vertices: [
                Vertex::new(Vec2::new(0.0, 0.0), true),
                Vertex::new(a, index % 2 != 0),
                Vertex::new(b, index % 2 == 0),
            ],
        });
    }
    triangles
}

fn initial_sun(count: usize, size: f64) -> Vec<Triangle> {
    let mut triangles = Vec::with_capacity(count);
    for index in 0..count {
        let (mut a, mut b) = init_vertex_pair(index as f64, size, size);
        if index % 2 == 0 {
            std::mem::swap(&mut a, &mut b);
        }
        triangles.push(Triangle {
            kind: TriangleKind::Acute,
            vertices: [
                Vertex::new(Vec2::new(0.0, 0.0), false),
                Vertex::new(a, false),
                Vertex::new(b, true),
            ],
        });
    }
    triangles
}

fn init_vertex_pair(index: f64, first: f64, second: f64) -> (Vec2, Vec2) {
    let angle = PI / 5.0;
    let a = polar(first, index * angle);
    let b = polar(second, (index + 1.0) * angle);
    (a, b)
}

fn polar(radius: f64, angle: f64) -> Vec2 {
    Vec2::new(radius * angle.cos(), radius * angle.sin())
}

fn subdivide(triangles: &[Triangle]) -> Vec<Triangle> {
    let mut result = Vec::with_capacity(triangles.len() * 3);
    for triangle in triangles {
        match triangle.kind {
            TriangleKind::Acute => subdivide_acute(*triangle, &mut result),
            TriangleKind::Obtuse => subdivide_obtuse(*triangle, &mut result),
        }
    }
    result
}

fn subdivide_acute(triangle: Triangle, output: &mut Vec<Triangle>) {
    let [a, b, c] = triangle.vertices;
    let (pbisect_edge, qbisect_edge) = if b.parity == a.parity {
        (b, c)
    } else {
        (c, b)
    };

    let short_side = distance(pbisect_edge.position, qbisect_edge.position);
    let p = project(a.position, pbisect_edge.position, short_side);
    let q = project(a.position, qbisect_edge.position, short_side / PHI);

    let p_p = Vertex::new(p, a.parity);
    let p_q = Vertex::new(q, !a.parity);
    let p_a = Vertex::new(a.position, !a.parity);
    let p_c = Vertex::new(qbisect_edge.position, a.parity);
    let p_b = Vertex::new(pbisect_edge.position, !a.parity);

    output.push(Triangle {
        kind: TriangleKind::Acute,
        vertices: [p_c, p_q, p_p],
    });
    output.push(Triangle {
        kind: TriangleKind::Acute,
        vertices: [p_c, p_b, p_p],
    });
    output.push(Triangle {
        kind: TriangleKind::Obtuse,
        vertices: [p_a, p_p, p_q],
    });
}

fn subdivide_obtuse(triangle: Triangle, output: &mut Vec<Triangle>) {
    let [a, b, c] = triangle.vertices;
    let (bisect_edge, unmodified_edge) = if b.parity != a.parity { (b, c) } else { (c, b) };

    let p = project(
        a.position,
        bisect_edge.position,
        distance(a.position, bisect_edge.position) / PHI,
    );
    let p_p = Vertex::new(p, bisect_edge.parity);

    output.push(Triangle {
        kind: TriangleKind::Obtuse,
        vertices: [bisect_edge, p_p, unmodified_edge],
    });
    output.push(Triangle {
        kind: TriangleKind::Acute,
        vertices: [a, p_p, unmodified_edge],
    });
}

fn project(from: Vec2, toward: Vec2, size: f64) -> Vec2 {
    let delta = toward - from;
    let magnitude = distance(from, toward);
    from + delta * (size / magnitude)
}

fn distance(left: Vec2, right: Vec2) -> f64 {
    let delta = right - left;
    (delta.x * delta.x + delta.y * delta.y).sqrt()
}

fn triangle_color<'a>(
    triangle: &Triangle,
    config: &PenroseSvgConfig,
    palette: &'a [String],
) -> &'a str {
    match config.color_mode {
        PenroseColorMode::TileType => match triangle.kind {
            TriangleKind::Acute => &palette[0],
            TriangleKind::Obtuse => &palette[1],
        },
        PenroseColorMode::Orientation => {
            let center = triangle.center();
            let angle = center.y.atan2(center.x);
            let normalized = ((angle + PI) / (2.0 * PI)).rem_euclid(1.0);
            let bucket =
                ((normalized * palette.len() as f64).floor() as usize).min(palette.len() - 1);
            &palette[bucket]
        }
    }
}

fn triangle_visible(triangle: &Triangle, config: &PenroseSvgConfig) -> bool {
    let half_width = config.width as f64 / (2.0 * config.scale);
    let half_height = config.height as f64 / (2.0 * config.scale);
    let min_x = config.center_x - half_width - 1.0;
    let max_x = config.center_x + half_width + 1.0;
    let min_y = config.center_y - half_height - 1.0;
    let max_y = config.center_y + half_height + 1.0;

    triangle.vertices.iter().any(|vertex| {
        let point = vertex.position;
        point.x >= min_x && point.x <= max_x && point.y >= min_y && point.y <= max_y
    })
}

fn svg_triangle_points(triangle: &Triangle, config: &PenroseSvgConfig) -> String {
    triangle
        .vertices
        .iter()
        .map(|vertex| {
            let (x, y) = svg_point(vertex.position, config);
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
