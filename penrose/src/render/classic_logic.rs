use std::collections::HashMap;
use std::f64::consts::PI;

use crate::math::Vec2;

use super::{PHI, PenroseSeed, PenroseTileMode, RenderTile, approx_eq, distance, polar};

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

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PointKey(i64, i64);

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct EdgeKey(PointKey, PointKey);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum EdgeClass {
    Short,
    Long,
}

impl Vertex {
    fn new(position: Vec2, parity: bool) -> Self {
        Self { position, parity }
    }
}

pub(super) fn render_tiles(seed: PenroseSeed, iterations: usize) -> Vec<RenderTile> {
    let mut triangles = initial_seed(seed);
    for _ in 0..iterations {
        triangles = subdivide(&triangles);
    }
    assembled_tiles(&triangles, PenroseTileMode::KiteDart)
}

fn assembled_tiles(triangles: &[Triangle], tile_mode: PenroseTileMode) -> Vec<RenderTile> {
    let mut tiles = Vec::with_capacity(triangles.len());
    let mut edges: HashMap<EdgeKey, Vec<(usize, usize)>> = HashMap::new();

    for (triangle_index, triangle) in triangles.iter().enumerate() {
        for edge_index in 0..3 {
            let (left, right) = triangle_edge_points(triangle, edge_index);
            edges
                .entry(edge_key(left, right))
                .or_default()
                .push((triangle_index, edge_index));
        }
    }

    let mut candidates: Vec<(usize, usize, usize, usize)> = edges
        .values()
        .filter_map(|matches| match matches.as_slice() {
            [(left_index, left_edge), (right_index, right_edge)] => Some((
                *left_index.min(right_index),
                *left_index.max(right_index),
                if left_index <= right_index {
                    *left_edge
                } else {
                    *right_edge
                },
                if left_index <= right_index {
                    *right_edge
                } else {
                    *left_edge
                },
            )),
            _ => None,
        })
        .collect();
    candidates.sort_unstable();

    for (left_index, right_index, left_edge, right_edge) in candidates {
        let left = triangles[left_index];
        let right = triangles[right_index];
        if !triangles_form_tile(left, right, left_edge, right_edge, tile_mode) {
            continue;
        }

        tiles.push(RenderTile {
            points: merged_polygon_points(left, right),
            fill_index: tile_fill_index(left.kind),
        });
    }

    tiles
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
    let (pbisect_edge, qbisect_edge) = if b.parity == a.parity { (b, c) } else { (c, b) };

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

fn triangles_form_tile(
    left: Triangle,
    right: Triangle,
    left_edge: usize,
    right_edge: usize,
    tile_mode: PenroseTileMode,
) -> bool {
    if left.kind != right.kind {
        return false;
    }

    match (tile_mode, left.kind) {
        (PenroseTileMode::KiteDart, TriangleKind::Acute) => {
            triangle_edge_class(left, left_edge) == EdgeClass::Long
                && triangle_edge_class(right, right_edge) == EdgeClass::Long
        }
        (PenroseTileMode::KiteDart, TriangleKind::Obtuse) => {
            triangle_edge_class(left, left_edge) == EdgeClass::Short
                && triangle_edge_class(right, right_edge) == EdgeClass::Short
        }
        _ => false,
    }
}

fn tile_fill_index(kind: TriangleKind) -> usize {
    match kind {
        TriangleKind::Acute => 0,
        TriangleKind::Obtuse => 1,
    }
}

fn triangle_edge_points(triangle: &Triangle, edge_index: usize) -> (Vec2, Vec2) {
    match edge_index {
        0 => (triangle.vertices[0].position, triangle.vertices[1].position),
        1 => (triangle.vertices[1].position, triangle.vertices[2].position),
        2 => (triangle.vertices[2].position, triangle.vertices[0].position),
        _ => unreachable!("invalid triangle edge index"),
    }
}

fn triangle_edge_class(triangle: Triangle, edge_index: usize) -> EdgeClass {
    let mut lengths = [
        distance(triangle.vertices[0].position, triangle.vertices[1].position),
        distance(triangle.vertices[1].position, triangle.vertices[2].position),
        distance(triangle.vertices[2].position, triangle.vertices[0].position),
    ];
    let edge_length = lengths[edge_index];
    lengths.sort_by(|left, right| left.total_cmp(right));
    if approx_eq(edge_length, lengths[0]) {
        EdgeClass::Short
    } else {
        EdgeClass::Long
    }
}

fn merged_polygon_points(left: Triangle, right: Triangle) -> Vec<Vec2> {
    let mut counts: HashMap<EdgeKey, usize> = HashMap::new();
    let mut edge_points: HashMap<EdgeKey, (Vec2, Vec2)> = HashMap::new();

    for triangle in [left, right] {
        for edge_index in 0..3 {
            let points = triangle_edge_points(&triangle, edge_index);
            let key = edge_key(points.0, points.1);
            *counts.entry(key).or_insert(0) += 1;
            edge_points.entry(key).or_insert(points);
        }
    }

    let boundary_edges: Vec<(Vec2, Vec2)> = counts
        .into_iter()
        .filter_map(|(key, count)| (count == 1).then(|| edge_points[&key]))
        .collect();
    polygon_cycle(boundary_edges)
}

fn polygon_cycle(edges: Vec<(Vec2, Vec2)>) -> Vec<Vec2> {
    let mut adjacency: HashMap<PointKey, Vec<PointKey>> = HashMap::new();
    let mut positions: HashMap<PointKey, Vec2> = HashMap::new();

    for (left, right) in edges {
        let left_key = point_key(left);
        let right_key = point_key(right);
        adjacency.entry(left_key).or_default().push(right_key);
        adjacency.entry(right_key).or_default().push(left_key);
        positions.entry(left_key).or_insert(left);
        positions.entry(right_key).or_insert(right);
    }

    let start = adjacency
        .keys()
        .min()
        .copied()
        .expect("polygon should contain vertices");
    let mut points = vec![positions[&start]];
    let mut previous = None;
    let mut current = start;

    loop {
        let neighbors = &adjacency[&current];
        let next = neighbors
            .iter()
            .copied()
            .find(|candidate| Some(*candidate) != previous)
            .expect("polygon traversal should continue");
        if next == start {
            break;
        }
        points.push(positions[&next]);
        previous = Some(current);
        current = next;
    }

    points
}

fn edge_key(left: Vec2, right: Vec2) -> EdgeKey {
    let left_key = point_key(left);
    let right_key = point_key(right);
    if left_key <= right_key {
        EdgeKey(left_key, right_key)
    } else {
        EdgeKey(right_key, left_key)
    }
}

fn point_key(point: Vec2) -> PointKey {
    const SCALE: f64 = 1_000_000.0;
    PointKey(
        (point.x * SCALE).round() as i64,
        (point.y * SCALE).round() as i64,
    )
}
