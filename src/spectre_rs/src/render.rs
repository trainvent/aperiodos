use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use crate::math::Vec2;
use crate::tiles::{Anchor, Skeleton, Spectre, SpectreCluster};
use crate::utils::{Aabb, Angle, HexVec};

#[derive(Clone, Debug)]
pub struct SpectreSvgConfig {
    pub width: u32,
    pub height: u32,
    pub level: usize,
    pub scale: f32,
    pub center_x: f32,
    pub center_y: f32,
    pub palette: Vec<String>,
    pub background: String,
    pub outline: String,
    pub stroke_width: f32,
}

impl Default for SpectreSvgConfig {
    fn default() -> Self {
        Self {
            width: 1600,
            height: 1600,
            level: 5,
            scale: 40.0,
            center_x: 0.0,
            center_y: 0.0,
            palette: vec![
                "#17313b".to_string(),
                "#1f6a5d".to_string(),
                "#b4552d".to_string(),
                "#d8b24c".to_string(),
                "#f6f1e8".to_string(),
            ],
            background: "#f5f1e7".to_string(),
            outline: "#17313b".to_string(),
            stroke_width: 1.2,
        }
    }
}

pub fn render_svg(config: &SpectreSvgConfig) -> String {
    let palette = if config.palette.is_empty() {
        SpectreSvgConfig::default().palette
    } else {
        config.palette.clone()
    };
    let bbox = viewport_bbox(config);
    let mut cluster = root_cluster(config.level.max(1), &bbox);
    cluster.update(&bbox);
    let spectres: Vec<_> = cluster.spectres_in(bbox).collect();
    let content_bbox = content_bbox(&spectres).unwrap_or(bbox);
    let content_center = Vec2::new(
        (content_bbox.min.x + content_bbox.max.x) * 0.5,
        (content_bbox.min.y + content_bbox.max.y) * 0.5,
    );
    let render_scale = fitted_scale(config, &content_bbox);

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

    for spectre in spectres {
        let points = svg_points(spectre, content_center, render_scale, config);
        let fill = &palette[color_index_for(spectre, palette.len())];
        let _ = writeln!(
            document,
            "<polygon points=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linejoin=\"round\" />",
            points,
            fill,
            config.outline,
            config.stroke_width
        );
    }

    document.push_str("</svg>\n");
    document
}

pub fn write_svg(path: impl AsRef<Path>, config: &SpectreSvgConfig) -> std::io::Result<()> {
    let svg = render_svg(config);
    fs::write(path, svg)
}

fn viewport_bbox(config: &SpectreSvgConfig) -> Aabb {
    let half_width = config.width as f32 / (2.0 * config.scale);
    let half_height = config.height as f32 / (2.0 * config.scale);
    Aabb::new(
        config.center_x - half_width,
        config.center_y - half_height,
        config.center_x + half_width,
        config.center_y + half_height,
    )
}

fn root_cluster(level: usize, bbox: &Aabb) -> SpectreCluster {
    let mut cluster = Skeleton::with_anchor(Anchor::Anchor1, HexVec::ZERO, Angle::ZERO, level, None)
        .to_spectre_cluster(bbox);

    while !cluster.bbox().contains_bbox(bbox) {
        cluster = if cluster.level() % 2 == 0 {
            SpectreCluster::with_child_a(cluster)
        } else {
            SpectreCluster::with_child_f(cluster)
        };
    }

    cluster
}

fn content_bbox(spectres: &[&Spectre]) -> Option<Aabb> {
    if spectres.is_empty() {
        return None;
    }

    let mut bbox = Aabb::NULL;
    for spectre in spectres {
        bbox = bbox.union(&spectre.bbox());
    }
    Some(bbox)
}

fn fitted_scale(config: &SpectreSvgConfig, content_bbox: &Aabb) -> f32 {
    let content_width = (content_bbox.max.x - content_bbox.min.x).max(1.0);
    let content_height = (content_bbox.max.y - content_bbox.min.y).max(1.0);
    let width_scale = config.width as f32 / content_width * 0.9;
    let height_scale = config.height as f32 / content_height * 0.9;
    config.scale.min(width_scale.min(height_scale))
}

fn svg_points(spectre: &Spectre, content_center: Vec2, render_scale: f32, config: &SpectreSvgConfig) -> String {
    let mut points = String::new();

    for (index, vertex) in spectre.vertices().into_iter().enumerate() {
        let point = vertex.to_vec2();
        let x = (point.x - content_center.x) * render_scale + config.width as f32 * 0.5;
        let y = config.height as f32 * 0.5 - (point.y - content_center.y) * render_scale;
        if index > 0 {
            points.push(' ');
        }
        let _ = write!(points, "{x:.2},{y:.2}");
    }

    points
}

fn color_index_for(spectre: &Spectre, palette_len: usize) -> usize {
    let anchor = spectre.coordinate(Anchor::Anchor1);
    let anchor_hash = anchor.x.rational
        + anchor.x.irrational * 3
        + anchor.y.rational * 5
        + anchor.y.irrational * 7
        + i32::from(spectre.rotation().value());
    anchor_hash.rem_euclid(palette_len as i32) as usize
}

#[allow(dead_code)]
fn _world_to_screen(point: Vec2, bbox: &Aabb, config: &SpectreSvgConfig) -> Vec2 {
    Vec2::new(
        (point.x - ((bbox.min.x + bbox.max.x) * 0.5)) * config.scale + config.width as f32 * 0.5,
        config.height as f32 * 0.5 - (point.y - ((bbox.min.y + bbox.max.y) * 0.5)) * config.scale,
    )
}
