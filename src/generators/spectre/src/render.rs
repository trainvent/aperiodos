use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};
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
    pub iterations: usize,
    pub auto_iterations: bool,
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
            iterations: 5,
            auto_iterations: false,
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
    let (cluster, bbox) = render_cluster(config);
    let spectres: Vec<_> = cluster.spectre_paths_in(bbox).collect();
    let content_bbox = content_bbox(&spectres).unwrap_or(bbox);
    let view_center = render_center(config, &content_bbox, &bbox);
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
        let shape_points = spectre_outline_points(spectre.spectre, view_center, config);
        if !points_intersect_canvas(&shape_points, config) {
            continue;
        }
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
    let (cluster, bbox) = render_cluster(config);
    let spectres: Vec<_> = cluster.spectres_in(bbox).collect();
    let content_bbox = content_bbox_spectres(&spectres).unwrap_or(bbox);
    let view_center = render_center(config, &content_bbox, &bbox);
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
        let shape_points = spectre_outline_points(spectre, view_center, config);
        if !points_intersect_canvas(&shape_points, config) {
            continue;
        }
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

fn render_cluster(config: &SpectreSvgConfig) -> (SpectreCluster, Aabb) {
    let iterations = config.iterations.max(1);
    if !config.auto_iterations {
        let cluster =
            SpectreCluster::with_anchor(Anchor::Anchor1, HexVec::ZERO, Angle::ZERO, iterations);
        let bbox = cluster.bbox();
        return (cluster, bbox);
    }

    let (skeleton, bbox) = auto_skeleton(config, iterations);
    let mut cluster = skeleton.to_spectre_cluster(&bbox);
    cluster.update(&bbox);
    (cluster, bbox)
}

fn auto_skeleton(config: &SpectreSvgConfig, minimum_iterations: usize) -> (Skeleton, Aabb) {
    // Supertiles have a deeply indented outline. Make the automatic supertile
    // substantially larger than the viewport so its boundary stays off-canvas.
    let required_width = config.width as f32 / config.scale * 3.0;
    let required_height = config.height as f32 / config.scale * 3.0;
    let mut iterations = minimum_iterations;

    loop {
        let skeleton =
            Skeleton::with_anchor(Anchor::Anchor1, HexVec::ZERO, Angle::ZERO, iterations, None);
        let estimated = skeleton.estimated_bbox();
        let estimated_width = estimated.max.x - estimated.min.x;
        let estimated_height = estimated.max.y - estimated.min.y;
        if estimated_width >= required_width && estimated_height >= required_height {
            let view_center = Vec2::new(
                (estimated.min.x + estimated.max.x) * 0.5 + config.center_x,
                (estimated.min.y + estimated.max.y) * 0.5 + config.center_y,
            );
            let half_width = config.width as f32 / (2.0 * config.scale);
            let half_height = config.height as f32 / (2.0 * config.scale);
            let bbox = Aabb::new(
                view_center.x - half_width,
                view_center.y - half_height,
                view_center.x + half_width,
                view_center.y + half_height,
            );
            return (skeleton, bbox);
        }
        iterations += 1;
    }
}

fn render_center(config: &SpectreSvgConfig, content_bbox: &Aabb, selection_bbox: &Aabb) -> Vec2 {
    if config.auto_iterations {
        return Vec2::new(
            (selection_bbox.min.x + selection_bbox.max.x) * 0.5,
            (selection_bbox.min.y + selection_bbox.max.y) * 0.5,
        );
    }

    Vec2::new(
        (content_bbox.min.x + content_bbox.max.x) * 0.5 + config.center_x,
        (content_bbox.min.y + content_bbox.max.y) * 0.5 + config.center_y,
    )
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

    color_graph(&adjacency, &mut colors, special_color);

    colors
}

fn first_order_group_key(path: &[crate::tiles::PathStep]) -> Vec<crate::tiles::PathStep> {
    path.iter()
        .copied()
        .take_while(|step| step.parent_level > 1)
        .collect()
}

fn color_group_graph(adjacency: &[Vec<usize>], colors: &mut [usize]) {
    color_graph(adjacency, colors, usize::MAX);
}

fn color_graph(adjacency: &[Vec<usize>], colors: &mut [usize], special_color: usize) {
    let degrees: Vec<_> = adjacency
        .iter()
        .map(|neighbors| {
            neighbors
                .iter()
                .filter(|&&neighbor| colors[neighbor] != special_color)
                .count()
        })
        .collect();
    let mut neighbor_color_counts = vec![[0usize; 3]; colors.len()];
    let mut saturation = vec![0usize; colors.len()];

    for (index, neighbors) in adjacency.iter().enumerate() {
        for &neighbor in neighbors {
            let color = colors[neighbor];
            if color < 3 {
                neighbor_color_counts[index][color] += 1;
            }
        }
        saturation[index] = neighbor_color_counts[index]
            .iter()
            .filter(|&&count| count > 0)
            .count();
    }

    let mut candidates = BinaryHeap::new();
    for (index, &color) in colors.iter().enumerate() {
        if color == usize::MAX {
            candidates.push((saturation[index], degrees[index], Reverse(index)));
        }
    }

    while let Some((entry_saturation, entry_degree, Reverse(index))) = candidates.pop() {
        if colors[index] != usize::MAX
            || entry_saturation != saturation[index]
            || entry_degree != degrees[index]
        {
            continue;
        }

        let color = (0..3)
            .find(|&candidate| neighbor_color_counts[index][candidate] == 0)
            .unwrap_or(index % 3);
        colors[index] = color;

        for &neighbor in &adjacency[index] {
            if colors[neighbor] != usize::MAX {
                continue;
            }
            if neighbor_color_counts[neighbor][color] == 0 {
                saturation[neighbor] += 1;
            }
            neighbor_color_counts[neighbor][color] += 1;
            candidates.push((saturation[neighbor], degrees[neighbor], Reverse(neighbor)));
        }
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

fn spectre_outline_points(
    spectre: &Spectre,
    view_center: Vec2,
    config: &SpectreSvgConfig,
) -> Vec<Vec2> {
    let base_points: Vec<Vec2> = spectre
        .vertices()
        .into_iter()
        .map(|vertex| {
            let point = vertex.to_vec2();
            Vec2::new(
                (point.x - view_center.x) * config.scale + config.width as f32 * 0.5,
                config.height as f32 * 0.5 - (point.y - view_center.y) * config.scale,
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

fn points_intersect_canvas(points: &[Vec2], config: &SpectreSvgConfig) -> bool {
    let margin = config.stroke_width.max(0.0);
    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for point in points {
        min_x = min_x.min(point.x);
        min_y = min_y.min(point.y);
        max_x = max_x.max(point.x);
        max_y = max_y.max(point.y);
    }
    max_x >= -margin
        && min_x <= config.width as f32 + margin
        && max_y >= -margin
        && min_y <= config.height as f32 + margin
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

#[cfg(test)]
mod tests {
    use super::*;

    fn generated_tile_count(config: &SpectreSvgConfig) -> usize {
        let (cluster, bbox) = render_cluster(config);
        cluster.spectres_in(bbox).count()
    }

    #[test]
    fn exact_iterations_control_finite_patch_growth() {
        let expected = [(1, 9), (2, 71), (3, 559), (4, 4401)];
        for (iterations, tile_count) in expected {
            let config = SpectreSvgConfig {
                iterations,
                ..SpectreSvgConfig::default()
            };
            assert_eq!(generated_tile_count(&config), tile_count);
        }
    }

    #[test]
    fn exact_iterations_are_independent_of_canvas_size() {
        let small = SpectreSvgConfig {
            width: 320,
            height: 240,
            iterations: 3,
            ..SpectreSvgConfig::default()
        };
        let large = SpectreSvgConfig {
            width: 1600,
            height: 1600,
            ..small.clone()
        };
        assert_eq!(generated_tile_count(&small), generated_tile_count(&large));
    }

    #[test]
    fn automatic_iterations_expand_for_a_larger_canvas() {
        let small = SpectreSvgConfig {
            width: 320,
            height: 320,
            iterations: 1,
            auto_iterations: true,
            scale: 20.0,
            ..SpectreSvgConfig::default()
        };
        let large = SpectreSvgConfig {
            width: 1600,
            height: 1600,
            ..small.clone()
        };
        assert!(generated_tile_count(&large) > generated_tile_count(&small));
    }
}
