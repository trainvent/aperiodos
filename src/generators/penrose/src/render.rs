mod classic_logic;
mod p1_logic;
mod rhombs_logic;

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use aperiodos_render_core::{escape_xml, Affine, Polygon, Renderer, Scene, Vec2 as ScenePoint};
use aperiodos_studio::{render_studio_elements, tile_base_color};
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
    pub(super) tile_type: &'static str,
    pub(super) material_basis: [Vec2; 3],
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
        let mut boundaries = BTreeMap::new();

        for tile in tiles {
            if !tile_visible(&tile, config) {
                continue;
            }
            let points: Vec<ScenePoint> = tile
                .points
                .iter()
                .map(|point| {
                    let (x, y) = svg_point(*point, config);
                    ScenePoint::new(x, y)
                })
                .collect();
            collect_unique_boundaries(&mut boundaries, &points);
            let material_basis = tile.material_basis.map(|point| {
                let (x, y) = svg_point(point, config);
                ScenePoint::new(x, y)
            });
            let fill = material
                .map(|pattern| tile_base_color(pattern, Some(tile.tile_type)))
                .unwrap_or(&palette[tile.fill_index]);
            push_tile(
                &mut scene,
                points,
                fill,
                config,
                material,
                tile.fill_index,
                tile.tile_type,
                material_basis,
            );
        }
        push_unique_boundaries(&mut scene, boundaries, config);
        Ok(scene)
    }
}

type BoundaryKey = ((i64, i64), (i64, i64));

fn boundary_key(start: ScenePoint, end: ScenePoint) -> BoundaryKey {
    // Generated neighbors differ only by floating-point noise. Quantizing well
    // below the SVG's two-decimal output precision makes reversed shared edges
    // resolve to one stable key without merging visibly distinct segments.
    let quantize = |point: ScenePoint| {
        (
            (point.x * 1_000_000.0).round() as i64,
            (point.y * 1_000_000.0).round() as i64,
        )
    };
    let start = quantize(start);
    let end = quantize(end);
    if start <= end {
        (start, end)
    } else {
        (end, start)
    }
}

fn collect_unique_boundaries(
    boundaries: &mut BTreeMap<BoundaryKey, (ScenePoint, ScenePoint)>,
    points: &[ScenePoint],
) {
    for (index, start) in points.iter().copied().enumerate() {
        let end = points[(index + 1) % points.len()];
        boundaries
            .entry(boundary_key(start, end))
            .or_insert((start, end));
    }
}

fn push_unique_boundaries(
    scene: &mut Scene,
    boundaries: BTreeMap<BoundaryKey, (ScenePoint, ScenePoint)>,
    config: &PenroseSvgConfig,
) {
    if config.stroke_width <= 0.0 || boundaries.is_empty() {
        return;
    }
    let commands = boundaries
        .into_values()
        .map(|(start, end)| {
            format!(
                "M {:.2} {:.2} L {:.2} {:.2}",
                start.x, start.y, end.x, end.y
            )
        })
        .collect::<Vec<_>>()
        .join(" ");
    scene.push_raw(format!(
        "<path data-penrose-boundaries=\"true\" d=\"{commands}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />",
        escape_xml(&config.outline),
        config.stroke_width,
    ));
}

fn push_tile(
    scene: &mut Scene,
    points: Vec<ScenePoint>,
    fill: &str,
    config: &PenroseSvgConfig,
    material: Option<&Value>,
    palette_index: usize,
    tile_type: &str,
    material_basis: [ScenePoint; 3],
) {
    scene.push_polygon(Polygon::new(points.clone(), fill, "none", 0.0));
    let Some(pattern) = material else { return };
    if points.len() < 3 {
        return;
    }
    let [p0, p1, p2] = material_basis;
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
    let geometry_scale = a.hypot(b);
    let stroke_scale = shared_material_stroke_scale(geometry_scale, tile_type);
    let motif = render_studio_elements(
        pattern,
        ink,
        fill,
        transform,
        geometry_scale,
        stroke_scale,
        Some(tile_type),
    );
    scene.push_raw(format!("<g clip-path=\"url(#{clip_id})\">{motif}</g>"));
}

fn shared_material_stroke_scale(geometry_scale: f64, tile_type: &str) -> f64 {
    let canonical = canonical_tile_points(tile_type);
    let canonical_edge = canonical
        .get(0)
        .zip(canonical.get(1))
        .map(|(start, end)| distance(*start, *end))
        .unwrap_or(1.0)
        .max(f64::EPSILON);
    // Radius coordinates stay local to each prototile, while a numeric stroke
    // width is one shared Penrose unit. In particular, a Kite's first edge is
    // 1/phi of a Dart's and must not make equal line widths look thinner.
    geometry_scale / canonical_edge
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
    let supplied_colors = palette.clone();
    let minimum_colors = match config.tile_mode {
        PenroseTileMode::KiteDart if config.seed == PenroseSeed::Star => 4,
        PenroseTileMode::P1 => 4,
        _ => 2,
    };
    while palette.len() < minimum_colors {
        palette.push(supplied_colors[palette.len() % supplied_colors.len()].clone());
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

    // Checking only vertices leaves holes when a large or concave tile crosses
    // the viewport but all of its vertices lie just outside it. Rendering an
    // intersecting bounding box is safe: SVG clips the excess at the viewBox.
    let (tile_min_x, tile_max_x, tile_min_y, tile_max_y) = tile.points.iter().fold(
        (
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::INFINITY,
            f64::NEG_INFINITY,
        ),
        |(min_tile_x, max_tile_x, min_tile_y, max_tile_y), point| {
            (
                min_tile_x.min(point.x),
                max_tile_x.max(point.x),
                min_tile_y.min(point.y),
                max_tile_y.max(point.y),
            )
        },
    );
    tile_max_x >= min_x && tile_min_x <= max_x && tile_max_y >= min_y && tile_min_y <= max_y
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

pub(super) fn canonical_material_basis(points: &[Vec2], tile_type: &str) -> [Vec2; 3] {
    let canonical = canonical_tile_points(tile_type);
    if canonical.len() != points.len() || points.len() < 3 {
        return [points[0], points[1], points[2]];
    }

    let mut best = ([points[0], points[1], points[2]], f64::INFINITY);
    for start in 0..points.len() {
        for direction in [1_isize, -1] {
            let ordered = (0..points.len())
                .map(|offset| {
                    let index = (start as isize + direction * offset as isize)
                        .rem_euclid(points.len() as isize) as usize;
                    points[index]
                })
                .collect::<Vec<_>>();
            let basis = [ordered[0], ordered[1], ordered[2]];
            let error = canonical
                .iter()
                .zip(&ordered)
                .map(|(source, target)| distance(map_triangle(&canonical, basis, *source), *target))
                .sum::<f64>();
            if error < best.1 {
                best = (basis, error);
            }
        }
    }
    let scale = points
        .iter()
        .enumerate()
        .map(|(index, point)| distance(*point, points[(index + 1) % points.len()]))
        .fold(0.0_f64, f64::max)
        .max(1e-9);
    debug_assert!(
        best.1 / scale < 1e-5,
        "{tile_type} polygon does not match its canonical Studio geometry"
    );
    best.0
}

fn map_triangle(source: &[Vec2], target: [Vec2; 3], point: Vec2) -> Vec2 {
    let source_x = source[1] - source[0];
    let source_y = source[2] - source[0];
    let delta = point - source[0];
    let determinant = source_x.x * source_y.y - source_x.y * source_y.x;
    let u = (delta.x * source_y.y - delta.y * source_y.x) / determinant;
    let v = (source_x.x * delta.y - source_x.y * delta.x) / determinant;
    target[0] + (target[1] - target[0]) * u + (target[2] - target[0]) * v
}

fn canonical_tile_points(tile_type: &str) -> Vec<Vec2> {
    let degrees = |value: f64| value.to_radians();
    match tile_type {
        "dart" => vec![
            Vec2::new(0.0, 0.0),
            Vec2::new(0.309_016_994_4, -0.951_056_516_3),
            Vec2::new(0.809_016_994_4, -0.587_785_252_3),
            Vec2::new(1.0, 0.0),
        ],
        "kite" => vec![
            Vec2::new(0.0, 0.0),
            Vec2::new(0.190_983_005_6, -0.587_785_252_3),
            Vec2::new(0.0, -1.175_570_504_6),
            Vec2::new(0.809_016_994_4, -0.587_785_252_3),
        ],
        "thin-rhomb" => vec![
            Vec2::new(0.0, 0.0),
            Vec2::new(degrees(18.0).cos(), -degrees(18.0).sin()),
            Vec2::new(2.0 * degrees(18.0).cos(), 0.0),
            Vec2::new(degrees(18.0).cos(), degrees(18.0).sin()),
        ],
        "thick-rhomb" => vec![
            Vec2::new(0.0, 0.0),
            Vec2::new(degrees(54.0).cos(), degrees(54.0).sin()),
            Vec2::new(
                degrees(54.0).cos() + degrees(18.0).cos(),
                degrees(54.0).sin() - degrees(18.0).sin(),
            ),
            Vec2::new(degrees(18.0).cos(), -degrees(18.0).sin()),
        ],
        _ => points_fallback(),
    }
}

fn points_fallback() -> Vec<Vec2> {
    Vec::new()
}

fn svg_point(point: Vec2, config: &PenroseSvgConfig) -> (f64, f64) {
    let x = (point.x - config.center_x) * config.scale + config.width as f64 / 2.0;
    let y = config.height as f64 / 2.0 - (point.y - config.center_y) * config.scale;
    (x, y)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    fn assert_material_basis_matches_polygon(tile: &RenderTile) {
        let canonical = canonical_tile_points(tile.tile_type);
        assert_eq!(canonical.len(), tile.points.len());
        for point in canonical {
            let mapped = map_triangle(
                &canonical_tile_points(tile.tile_type),
                tile.material_basis,
                point,
            );
            assert!(
                tile.points
                    .iter()
                    .any(|candidate| distance(mapped, *candidate) < 1e-6),
                "{} material point ({}, {}) missed its generated polygon",
                tile.tile_type,
                mapped.x,
                mapped.y,
            );
        }
    }

    #[test]
    fn generated_p2_and_p3_tiles_use_stable_studio_material_bases() {
        let cases = [
            classic_logic::render_tiles(PenroseSeed::Sun, 3),
            rhombs_logic::render_tiles(PenroseSeed::Sun, 3),
        ];
        let mut tile_types = HashSet::new();
        for tiles in cases {
            for tile in &tiles {
                tile_types.insert(tile.tile_type);
                assert_material_basis_matches_polygon(tile);
            }
        }
        assert_eq!(
            tile_types,
            HashSet::from(["dart", "kite", "thin-rhomb", "thick-rhomb"])
        );
    }

    #[test]
    fn p2_prototiles_share_one_numeric_material_stroke_scale() {
        let output_scale = 137.0;
        for tile_type in ["dart", "kite"] {
            let canonical = canonical_tile_points(tile_type);
            let local_geometry_scale = distance(canonical[0], canonical[1]) * output_scale;
            assert!(
                (shared_material_stroke_scale(local_geometry_scale, tile_type) - output_scale)
                    .abs()
                    < 1e-9
            );
        }
    }

    #[test]
    fn shared_tile_boundaries_are_emitted_once() {
        let left = vec![
            ScenePoint::new(0.0, 0.0),
            ScenePoint::new(1.0, 0.0),
            ScenePoint::new(1.0, 1.0),
            ScenePoint::new(0.0, 1.0),
        ];
        let right = vec![
            ScenePoint::new(1.0, 0.0),
            ScenePoint::new(2.0, 0.0),
            ScenePoint::new(2.0, 1.0),
            ScenePoint::new(1.0, 1.0),
        ];
        let mut boundaries = BTreeMap::new();
        collect_unique_boundaries(&mut boundaries, &left);
        collect_unique_boundaries(&mut boundaries, &right);

        assert_eq!(boundaries.len(), 7);
        assert!(boundaries.contains_key(&boundary_key(
            ScenePoint::new(1.0, 0.0),
            ScenePoint::new(1.0, 1.0),
        )));

        let config = PenroseSvgConfig {
            width: 640,
            height: 432,
            iterations: 3,
            scale: 400.0,
            ..PenroseSvgConfig::default()
        };
        let visible_tiles = classic_logic::render_tiles(config.seed, config.iterations)
            .into_iter()
            .filter(|tile| tile_visible(tile, &config))
            .collect::<Vec<_>>();
        let total_edges = visible_tiles
            .iter()
            .map(|tile| tile.points.len())
            .sum::<usize>();
        let mut generated_boundaries = BTreeMap::new();
        for tile in visible_tiles {
            let points = tile
                .points
                .into_iter()
                .map(|point| {
                    let (x, y) = svg_point(point, &config);
                    ScenePoint::new(x, y)
                })
                .collect::<Vec<_>>();
            collect_unique_boundaries(&mut generated_boundaries, &points);
        }
        assert!(generated_boundaries.len() < total_edges);
    }

    #[test]
    fn rendered_patch_uses_one_consolidated_boundary_path() {
        let svg = render_svg(&PenroseSvgConfig {
            width: 320,
            height: 240,
            iterations: 2,
            scale: 120.0,
            ..PenroseSvgConfig::default()
        });

        assert_eq!(svg.matches("data-penrose-boundaries=\"true\"").count(), 1);
        assert!(svg.contains("<polygon"));
        assert!(svg
            .lines()
            .filter(|line| line.contains("<polygon"))
            .all(|line| {
                line.contains("stroke=\"none\"") && line.contains("stroke-width=\"0\"")
            }));
    }

    #[test]
    fn patterned_patch_uses_independent_prototile_base_colors() {
        let svg = render_svg(&PenroseSvgConfig {
            width: 640,
            height: 432,
            iterations: 3,
            scale: 180.0,
            material_mode: PenroseMaterialMode::Pattern,
            studio_pattern: Some(json!({
                "colors":{"base":"#ffffff","ink":"#000000"},
                "tileColors":{"dart":"#aa1100","kite":"#00aa11"},
                "paths":[],"lines":[],"circles":[],"circularPaths":[]
            })),
            ..PenroseSvgConfig::default()
        });

        assert!(svg.contains("fill=\"#aa1100\""));
        assert!(svg.contains("fill=\"#00aa11\""));
    }

    #[test]
    fn two_color_cartwheel_reuses_only_the_supplied_colors() {
        let palette = normalized_palette(&PenroseSvgConfig {
            seed: PenroseSeed::Star,
            tile_mode: PenroseTileMode::KiteDart,
            palette: vec!["#112233".to_owned(), "#aabbcc".to_owned()],
            ..PenroseSvgConfig::default()
        });

        assert_eq!(palette, ["#112233", "#aabbcc", "#112233", "#aabbcc"]);
    }

    #[test]
    fn retains_tiles_that_cross_the_viewport_without_an_internal_vertex() {
        let config = PenroseSvgConfig {
            width: 100,
            height: 100,
            scale: 1.0,
            ..PenroseSvgConfig::default()
        };
        let crossing_tile = RenderTile {
            points: vec![
                Vec2::new(-60.0, 0.0),
                Vec2::new(60.0, 0.0),
                Vec2::new(0.0, 60.0),
            ],
            fill_index: 0,
            tile_type: "test",
            material_basis: [
                Vec2::new(-60.0, 0.0),
                Vec2::new(60.0, 0.0),
                Vec2::new(0.0, 60.0),
            ],
        };
        let distant_tile = RenderTile {
            points: vec![
                Vec2::new(70.0, 70.0),
                Vec2::new(80.0, 70.0),
                Vec2::new(70.0, 80.0),
            ],
            fill_index: 0,
            tile_type: "test",
            material_basis: [
                Vec2::new(70.0, 70.0),
                Vec2::new(80.0, 70.0),
                Vec2::new(70.0, 80.0),
            ],
        };

        assert!(tile_visible(&crossing_tile, &config));
        assert!(!tile_visible(&distant_tile, &config));
    }
}
