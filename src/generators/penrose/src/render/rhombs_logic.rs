use std::collections::HashMap;
use std::f64::consts::PI;

use crate::math::Vec2;

use super::{PHI, PenroseSeed, RenderTile, polar};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TriangleKind {
    Thin,
    Thick,
}

#[derive(Clone, Copy, Debug)]
struct Triangle {
    kind: TriangleKind,
    points: [Vec2; 3],
}

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
struct PointKey(i64, i64);

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct EdgeKey(PointKey, PointKey);

pub(super) fn render_tiles(seed: PenroseSeed, iterations: usize) -> Vec<RenderTile> {
    let mut triangles = initial_seed(seed);
    for _ in 0..iterations {
        triangles = subdivide(&triangles);
    }
    assemble_rhombs(&triangles)
}

fn initial_seed(seed: PenroseSeed) -> Vec<Triangle> {
    let mut triangles = Vec::new();
    match seed {
        PenroseSeed::Sun => {
            for index in 0..10 {
                let mut b = polar(1.0, (2.0 * index as f64 - 1.0) * PI / 10.0);
                let mut c = polar(1.0, (2.0 * index as f64 + 1.0) * PI / 10.0);
                if index % 2 == 0 {
                    std::mem::swap(&mut b, &mut c);
                }
                triangles.push(Triangle {
                    kind: TriangleKind::Thin,
                    points: [Vec2::new(0.0, 0.0), b, c],
                });
            }
        }
        PenroseSeed::Star => {
            for index in 0..10 {
                let mut b = polar(1.0, (2.0 * index as f64 - 1.0) * PI / 10.0);
                let mut c = polar(1.0, (2.0 * index as f64 + 1.0) * PI / 10.0);
                if index % 2 == 0 {
                    std::mem::swap(&mut b, &mut c);
                }
                triangles.push(Triangle {
                    kind: TriangleKind::Thin,
                    points: [Vec2::new(0.0, 0.0), b, c],
                });
            }
            triangles = subdivide(&triangles);
        }
    }
    triangles
}

fn subdivide(triangles: &[Triangle]) -> Vec<Triangle> {
    let mut next = Vec::with_capacity(triangles.len() * 3);
    for triangle in triangles {
        let [a, b, c] = triangle.points;
        match triangle.kind {
            TriangleKind::Thin => {
                let p = a + (b - a) / PHI;
                next.push(Triangle {
                    kind: TriangleKind::Thin,
                    points: [c, p, b],
                });
                next.push(Triangle {
                    kind: TriangleKind::Thick,
                    points: [p, c, a],
                });
            }
            TriangleKind::Thick => {
                let p = b + (a - b) / PHI;
                let q = b + (c - b) / PHI;
                next.push(Triangle {
                    kind: TriangleKind::Thick,
                    points: [q, c, a],
                });
                next.push(Triangle {
                    kind: TriangleKind::Thick,
                    points: [p, q, b],
                });
                next.push(Triangle {
                    kind: TriangleKind::Thin,
                    points: [q, p, a],
                });
            }
        }
    }
    next
}

fn assemble_rhombs(triangles: &[Triangle]) -> Vec<RenderTile> {
    let mut shared_edges: HashMap<EdgeKey, Vec<usize>> = HashMap::new();
    let mut tiles = Vec::with_capacity(triangles.len());

    for (index, triangle) in triangles.iter().enumerate() {
        let (left, right) = triangle_edge_points(triangle, 1);
        shared_edges
            .entry(edge_key(left, right))
            .or_default()
            .push(index);
    }

    for pair in shared_edges.values() {
        if let [left_index, right_index] = pair.as_slice() {
            let left = triangles[*left_index];
            let right = triangles[*right_index];
            if left.kind != right.kind {
                continue;
            }

            tiles.push(RenderTile {
                points: merged_polygon_points(left, right),
                fill_index: match left.kind {
                    TriangleKind::Thin => 0,
                    TriangleKind::Thick => 1,
                },
            });
        }
    }

    tiles
}

fn triangle_edge_points(triangle: &Triangle, edge_index: usize) -> (Vec2, Vec2) {
    match edge_index {
        0 => (triangle.points[0], triangle.points[1]),
        1 => (triangle.points[1], triangle.points[2]),
        2 => (triangle.points[2], triangle.points[0]),
        _ => unreachable!("invalid triangle edge index"),
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
