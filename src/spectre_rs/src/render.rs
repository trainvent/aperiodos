use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use crate::math::Vec2;
use crate::tiles::{Anchor, Skeleton, Spectre, SpectreCluster};
use crate::utils::{Aabb, Angle, HexVec};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DrawMode {
    Generated,
    Translation,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ShapeMode {
    Straight,
    Curved,
}

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
    pub draw_mode: DrawMode,
    pub shape_mode: ShapeMode,
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
                "#1f6a5d".to_string(),
                "#b4552d".to_string(),
                "#d8b24c".to_string(),
                "#17313b".to_string(),
            ],
            background: "#ffffff".to_string(),
            outline: "black".to_string(),
            stroke_width: 1.2,
            draw_mode: DrawMode::Translation,
            shape_mode: ShapeMode::Straight,
        }
    }
}

pub fn render_svg(config: &SpectreSvgConfig) -> String {
    let palette = if config.palette.is_empty() {
        SpectreSvgConfig::default().palette
    } else {
        let mut palette = config.palette.clone();
        let defaults = SpectreSvgConfig::default().palette;
        while palette.len() < 4 {
            palette.push(defaults[palette.len()].clone());
        }
        palette
    };
    match config.draw_mode {
        DrawMode::Generated => render_svg_generated(config, &palette),
        DrawMode::Translation => render_svg_translation(config, &palette),
    }
}

fn render_svg_generated(config: &SpectreSvgConfig, palette: &[String]) -> String {
    let bbox = viewport_bbox(config);
    let mut cluster = root_cluster(config.level.max(1), &bbox);
    cluster.update(&bbox);
    let spectres: Vec<_> = cluster.spectre_paths_in(bbox).collect();
    let content_bbox = content_bbox(&spectres).unwrap_or(bbox);
    let content_center = Vec2::new(
        (content_bbox.min.x + content_bbox.max.x) * 0.5,
        (content_bbox.min.y + content_bbox.max.y) * 0.5,
    );
    let render_scale = fitted_scale(config, &content_bbox);
    let color_indices = spectre_color_indices_generated(&spectres, palette.len());

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

    for (index, spectre) in spectres.iter().enumerate() {
        let shape_points =
            spectre_outline_points(spectre.spectre, content_center, render_scale, config);
        let points = svg_points(&shape_points);
        let fill = &palette[color_indices[index]];
        let _ = writeln!(
            document,
            "<polygon points=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linejoin=\"round\" />",
            points, fill, config.outline, config.stroke_width
        );
    }

    document.push_str("</svg>\n");
    document
}

fn render_svg_translation(config: &SpectreSvgConfig, palette: &[String]) -> String {
    let bbox = viewport_bbox(config);
    let mut cluster = root_cluster(config.level.max(1), &bbox);
    cluster.update(&bbox);
    let spectres: Vec<_> = cluster.spectres_in(bbox).collect();
    let content_bbox = content_bbox_spectres(&spectres).unwrap_or(bbox);
    let content_center = Vec2::new(
        (content_bbox.min.x + content_bbox.max.x) * 0.5,
        (content_bbox.min.y + content_bbox.max.y) * 0.5,
    );
    let render_scale = fitted_scale(config, &content_bbox);
    let color_indices = spectre_color_indices_translation(&spectres, palette.len());

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

    for (index, spectre) in spectres.iter().enumerate() {
        let shape_points = spectre_outline_points(spectre, content_center, render_scale, config);
        let points = svg_points(&shape_points);
        let fill = &palette[color_indices[index]];
        let _ = writeln!(
            document,
            "<polygon points=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linejoin=\"round\" />",
            points, fill, config.outline, config.stroke_width
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
    let mut cluster =
        Skeleton::with_anchor(Anchor::Anchor1, HexVec::ZERO, Angle::ZERO, level, None)
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

fn content_bbox_from_iter<'a>(spectres: impl Iterator<Item = &'a Spectre>) -> Option<Aabb> {
    let mut bbox = Aabb::NULL;
    let mut has_content = false;

    for spectre in spectres {
        bbox = bbox.union(&spectre.bbox());
        has_content = true;
    }

    if has_content { Some(bbox) } else { None }
}

fn content_bbox(spectres: &[crate::tiles::SpectreLeaf<'_>]) -> Option<Aabb> {
    if spectres.is_empty() {
        return None;
    }

    content_bbox_from_iter(spectres.iter().map(|leaf| leaf.spectre))
}

fn content_bbox_spectres(spectres: &[&Spectre]) -> Option<Aabb> {
    if spectres.is_empty() {
        return None;
    }

    content_bbox_from_iter(spectres.iter().copied())
}

fn spectre_color_indices_generated(
    spectres: &[crate::tiles::SpectreLeaf<'_>],
    palette_len: usize,
) -> Vec<usize> {
    if spectres.is_empty() {
        return Vec::new();
    }

    let palette_len = palette_len.max(4);
    let special_color = 3usize.min(palette_len - 1);
    let adjacency = build_edge_adjacency(spectres);
    let mut colors = vec![usize::MAX; spectres.len()];
    let mut group_members: HashMap<Vec<crate::tiles::PathStep>, Vec<usize>> = HashMap::new();

    for (index, spectre) in spectres.iter().enumerate() {
        if is_special_spectre(spectre.spectre) {
            colors[index] = special_color;
        }
        let group = first_order_group_key(&spectre.path);
        group_members.entry(group).or_default().push(index);
    }

    let group_keys: Vec<_> = group_members.keys().cloned().collect();
    let mut group_index = HashMap::new();
    for (index, key) in group_keys.iter().enumerate() {
        group_index.insert(key.clone(), index);
    }
    let mut group_adjacency = vec![Vec::<usize>::new(); group_keys.len()];

    for (tile_index, neighbors) in adjacency.iter().enumerate() {
        let group_a = group_index[&first_order_group_key(&spectres[tile_index].path)];
        for &neighbor in neighbors {
            let group_b = group_index[&first_order_group_key(&spectres[neighbor].path)];
            if group_a != group_b && !group_adjacency[group_a].contains(&group_b) {
                group_adjacency[group_a].push(group_b);
            }
        }
    }

    let mut group_colors = vec![usize::MAX; group_keys.len()];
    color_group_graph(&group_adjacency, &mut group_colors);

    for (group_key, members) in &group_members {
        let group_color = group_colors[group_index[group_key]];
        for &member in members {
            if colors[member] == usize::MAX {
                colors[member] = group_color;
            }
        }
    }

    colors
}

fn spectre_color_indices_translation(spectres: &[&Spectre], palette_len: usize) -> Vec<usize> {
    if spectres.is_empty() {
        return Vec::new();
    }

    let palette_len = palette_len.max(4);
    let special_color = 3usize.min(palette_len - 1);
    let adjacency = build_edge_adjacency_translation(spectres);
    let mut colors = vec![usize::MAX; spectres.len()];

    for (index, spectre) in spectres.iter().enumerate() {
        if is_special_spectre(spectre) {
            colors[index] = special_color;
        }
    }

    let mut uncolored: Vec<_> = (0..spectres.len())
        .filter(|&index| colors[index] == usize::MAX)
        .collect();

    while !uncolored.is_empty() {
        uncolored.sort_by_key(|&index| {
            let saturation = adjacency[index]
                .iter()
                .filter_map(|&neighbor| {
                    let color = colors[neighbor];
                    if color < 3 { Some(color) } else { None }
                })
                .fold([false; 3], |mut used, color| {
                    used[color] = true;
                    used
                })
                .into_iter()
                .filter(|used| *used)
                .count();
            let degree = adjacency[index]
                .iter()
                .filter(|&&neighbor| colors[neighbor] != special_color)
                .count();
            (
                std::cmp::Reverse(saturation),
                std::cmp::Reverse(degree),
                index,
            )
        });

        let index = uncolored.remove(0);
        let mut used = [false; 3];
        for &neighbor in &adjacency[index] {
            let color = colors[neighbor];
            if color < 3 {
                used[color] = true;
            }
        }
        colors[index] = (0..3).find(|&color| !used[color]).unwrap_or(index % 3);
    }

    colors
}

fn first_order_group_key(path: &[crate::tiles::PathStep]) -> Vec<crate::tiles::PathStep> {
    path.iter()
        .copied()
        .take_while(|step| step.parent_level > 1)
        .collect()
}

fn color_group_graph(adjacency: &[Vec<usize>], colors: &mut [usize]) {
    let mut uncolored: Vec<_> = (0..colors.len()).collect();

    while !uncolored.is_empty() {
        uncolored.sort_by_key(|&index| {
            let saturation = adjacency[index]
                .iter()
                .filter_map(|&neighbor| {
                    let color = colors[neighbor];
                    if color < 3 { Some(color) } else { None }
                })
                .fold([false; 3], |mut used, color| {
                    used[color] = true;
                    used
                })
                .into_iter()
                .filter(|used| *used)
                .count();
            (
                std::cmp::Reverse(saturation),
                std::cmp::Reverse(adjacency[index].len()),
                index,
            )
        });

        let index = uncolored.remove(0);
        let mut used = [false; 3];
        for &neighbor in &adjacency[index] {
            let color = colors[neighbor];
            if color < 3 {
                used[color] = true;
            }
        }
        colors[index] = (0..3).find(|&color| !used[color]).unwrap_or(index % 3);
    }
}

fn build_edge_adjacency(spectres: &[crate::tiles::SpectreLeaf<'_>]) -> Vec<Vec<usize>> {
    let mut edge_map: HashMap<(HexVec, HexVec), Vec<usize>> = HashMap::new();
    for (tile_index, spectre) in spectres.iter().enumerate() {
        let vertices = spectre.spectre.vertices();
        for index in 0..vertices.len() {
            let start = vertices[index];
            let end = vertices[(index + 1) % vertices.len()];
            let edge = normalized_edge(start, end);
            edge_map.entry(edge).or_default().push(tile_index);
        }
    }

    let mut adjacency = vec![Vec::<usize>::new(); spectres.len()];
    for tile_indices in edge_map.values() {
        for index in 0..tile_indices.len() {
            let a = tile_indices[index];
            for other in (index + 1)..tile_indices.len() {
                let b = tile_indices[other];
                adjacency[a].push(b);
                adjacency[b].push(a);
            }
        }
    }

    adjacency
}

fn build_edge_adjacency_translation(spectres: &[&Spectre]) -> Vec<Vec<usize>> {
    let mut edge_map: HashMap<(HexVec, HexVec), Vec<usize>> = HashMap::new();
    for (tile_index, spectre) in spectres.iter().enumerate() {
        let vertices = spectre.vertices();
        for index in 0..vertices.len() {
            let start = vertices[index];
            let end = vertices[(index + 1) % vertices.len()];
            let edge = normalized_edge(start, end);
            edge_map.entry(edge).or_default().push(tile_index);
        }
    }

    let mut adjacency = vec![Vec::<usize>::new(); spectres.len()];
    for tile_indices in edge_map.values() {
        for index in 0..tile_indices.len() {
            let a = tile_indices[index];
            for other in (index + 1)..tile_indices.len() {
                let b = tile_indices[other];
                adjacency[a].push(b);
                adjacency[b].push(a);
            }
        }
    }

    adjacency
}

fn normalized_edge(a: HexVec, b: HexVec) -> (HexVec, HexVec) {
    if a <= b { (a, b) } else { (b, a) }
}

fn is_special_spectre(spectre: &Spectre) -> bool {
    spectre.rotation().value() % 2 == 1
}

fn fitted_scale(config: &SpectreSvgConfig, content_bbox: &Aabb) -> f32 {
    let content_width = (content_bbox.max.x - content_bbox.min.x).max(1.0);
    let content_height = (content_bbox.max.y - content_bbox.min.y).max(1.0);
    let width_scale = config.width as f32 / content_width * 0.9;
    let height_scale = config.height as f32 / content_height * 0.9;
    config.scale.min(width_scale.min(height_scale))
}

fn spectre_outline_points(
    spectre: &Spectre,
    content_center: Vec2,
    render_scale: f32,
    config: &SpectreSvgConfig,
) -> Vec<Vec2> {
    let base_points: Vec<Vec2> = spectre
        .vertices()
        .into_iter()
        .map(|vertex| {
            let point = vertex.to_vec2();
            Vec2::new(
                (point.x - content_center.x) * render_scale + config.width as f32 * 0.5,
                config.height as f32 * 0.5 - (point.y - content_center.y) * render_scale,
            )
        })
        .collect();

    match config.shape_mode {
        ShapeMode::Straight => base_points,
        ShapeMode::Curved => curved_outline_points(&base_points),
    }
}

fn curved_outline_points(base_points: &[Vec2]) -> Vec<Vec2> {
    const SEGMENTS_PER_EDGE: usize = 6;
    const BULGE_FACTOR: f32 = 0.22;

    if base_points.len() < 2 {
        return base_points.to_vec();
    }

    let mut points = Vec::with_capacity(base_points.len() * SEGMENTS_PER_EDGE);
    points.push(base_points[0]);

    for edge_index in 0..base_points.len() {
        let start = base_points[edge_index];
        let end = base_points[(edge_index + 1) % base_points.len()];
        let bulge_sign = if edge_index % 2 == 0 { 1.0 } else { -1.0 };
        append_curved_edge_points(
            &mut points,
            start,
            end,
            bulge_sign,
            BULGE_FACTOR,
            SEGMENTS_PER_EDGE,
        );
    }

    points
}

fn append_curved_edge_points(
    output: &mut Vec<Vec2>,
    start: Vec2,
    end: Vec2,
    bulge_sign: f32,
    bulge_factor: f32,
    segments: usize,
) {
    let edge = end - start;
    let edge_length = (edge.x * edge.x + edge.y * edge.y).sqrt();
    if edge_length <= f32::EPSILON {
        output.push(end);
        return;
    }

    let outward_normal = Vec2::new(edge.y / edge_length, -edge.x / edge_length);
    let midpoint = (start + end) * 0.5;
    let control = midpoint + outward_normal * (edge_length * bulge_factor * bulge_sign);

    for step in 1..=segments.max(1) {
        let t = step as f32 / segments.max(1) as f32;
        let one_minus_t = 1.0 - t;
        let point =
            start * (one_minus_t * one_minus_t) + control * (2.0 * one_minus_t * t) + end * (t * t);
        output.push(point);
    }
}

fn svg_points(points_list: &[Vec2]) -> String {
    let mut points = String::new();

    for (index, point) in points_list.iter().enumerate() {
        let x = point.x;
        let y = point.y;
        if index > 0 {
            points.push(' ');
        }
        let _ = write!(points, "{x:.2},{y:.2}");
    }

    points
}

#[allow(dead_code)]
fn _world_to_screen(point: Vec2, bbox: &Aabb, config: &SpectreSvgConfig) -> Vec2 {
    Vec2::new(
        (point.x - ((bbox.min.x + bbox.max.x) * 0.5)) * config.scale + config.width as f32 * 0.5,
        config.height as f32 * 0.5 - (point.y - ((bbox.min.y + bbox.max.y) * 0.5)) * config.scale,
    )
}
