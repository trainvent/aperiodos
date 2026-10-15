use std::collections::HashMap;
use std::f64::consts::PI;

use crate::math::Vec2;

use super::{
    approx_eq, canonical_polygon_basis, distance, polar, PenroseSeed, PenroseTileMode, RenderTile,
    PHI,
};

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
    let inflation = PHI.powi(iterations as i32);
    match seed {
        PenroseSeed::Sun => {
            let mut triangles = initial_seed(seed, inflation);
            for _ in 0..iterations {
                triangles = subdivide(&triangles);
            }
            assembled_tiles(&triangles, PenroseTileMode::KiteDart)
        }
        PenroseSeed::Star => render_cartwheel(iterations),
    }
}

// Reference: Simon Tatham, “Beyond the wall”, Batman appendix:
// https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/aperiodic-transducers/
// The reference uses four oriented Robinson half-tiles. Keep their ordering
// during substitution: the parity rules for the sun are a different convention.
#[derive(Clone, Copy)]
struct CartwheelTriangle {
    kind: char,
    points: [Vec2; 3],
    region: usize,
}

fn cartwheel_seed() -> Vec<CartwheelTriangle> {
    include_str!("cartwheel_seed_data_0.txt")
        .lines()
        .map(|line| {
            let parts = line.split_ascii_whitespace().collect::<Vec<_>>();
            CartwheelTriangle {
                kind: parts[0].chars().next().unwrap(),
                points: std::array::from_fn(|i| {
                    Vec2::new(
                        parts[1 + i * 2].parse().unwrap(),
                        parts[2 + i * 2].parse().unwrap(),
                    )
                }),
                region: parts[7].parse().unwrap(),
            }
        })
        .collect()
}

fn subdivide_cartwheel(triangles: &[CartwheelTriangle]) -> Vec<CartwheelTriangle> {
    let mut result = Vec::with_capacity(triangles.len() * 3);
    let r = 1.0 / PHI;
    let q = 1.0 - r;
    for triangle in triangles {
        let [a, b, c] = triangle.points;
        let mut push = |kind, points| {
            result.push(CartwheelTriangle {
                kind,
                points,
                region: triangle.region,
            })
        };
        match triangle.kind {
            'A' => {
                let p = b * q + c * r;
                let t = a * r + c * q;
                push('B', [p, t, b]);
                push('U', [c, t, p]);
                push('A', [t, a, b]);
            }
            'B' => {
                let p = b * r + c * q;
                let t = a * q + c * r;
                push('A', [p, t, a]);
                push('V', [p, c, t]);
                push('B', [b, p, a]);
            }
            'U' => {
                let p = a * q + b * r;
                push('U', [b, c, p]);
                push('B', [p, c, a]);
            }
            'V' => {
                let p = a * r + b * q;
                push('V', [c, a, p]);
                push('A', [c, p, b]);
            }
            _ => unreachable!(),
        }
    }
    result
}

const CARTWHEEL_CENTER_Y: f64 = 0.190_983_005_625_052_55;

fn render_cartwheel(iterations: usize) -> Vec<RenderTile> {
    let seed = cartwheel_seed();
    let mut triangles = seed.clone();
    for _ in 0..iterations {
        triangles = subdivide_cartwheel(&triangles);
    }
    // Every expansion reverses Batman. Restore his orientation and keep the
    // centre fixed while increasing the patch, with unit tile edges at all depths.
    let size = PHI.powi(iterations as i32);
    let orientation = if iterations % 2 == 0 { 1.0 } else { -1.0 };
    let triangles = triangles
        .iter()
        .map(|triangle| {
            let points = triangle.points.map(|p| {
                Vec2::new(
                    p.x * size * orientation,
                    -(p.y - CARTWHEEL_CENTER_Y) * size * orientation,
                )
            });
            cartwheel_triangle(triangle.kind, points)
        })
        .collect::<Vec<_>>();
    let mut tiles = assembled_tiles(&triangles, PenroseTileMode::KiteDart);
    for tile in &mut tiles {
        let centroid = tile
            .points
            .iter()
            .fold(Vec2::new(0.0, 0.0), |sum, p| sum + *p)
            / tile.points.len() as f64;
        tile.fill_index = cartwheel_region(centroid, &seed);
    }
    tiles
}

fn cartwheel_region(point: Vec2, seed: &[CartwheelTriangle]) -> usize {
    // Exact central half-tile boundaries, rather than circular approximations.
    let raw = Vec2::new(point.x, CARTWHEEL_CENTER_Y - point.y);
    if point.x.abs() < 3.0 && point.y.abs() < 3.0 {
        for triangle in seed {
            let [a, b, c] = triangle.points;
            let cross = |u: Vec2, v: Vec2| u.x * v.y - u.y * v.x;
            let signs = [
                cross(b - a, raw - a),
                cross(c - b, raw - b),
                cross(a - c, raw - c),
            ];
            if signs.iter().all(|s| *s >= -1e-8) || signs.iter().all(|s| *s <= 1e-8) {
                return triangle.region;
            }
        }
    }
    // The spokes are constant-width Conway worms along ten rays, not wedges.
    // Their actual tile boundaries and handedness come from the substitution.
    let angle = point.y.atan2(point.x);
    let spoke = (angle / (PI / 5.0)).round() * (PI / 5.0);
    let perpendicular = (-point.x * spoke.sin() + point.y * spoke.cos()).abs();
    if perpendicular < 0.5 {
        1
    } else {
        0
    }
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

        let points = merged_polygon_points(left, right);
        let tile_type = match left.kind {
            TriangleKind::Acute => "dart",
            TriangleKind::Obtuse => "kite",
        };
        tiles.push(RenderTile {
            material_basis: canonical_polygon_basis(&points, tile_type),
            points,
            fill_index: tile_fill_index(left.kind),
            tile_type,
        });
    }

    tiles
}

fn initial_seed(seed: PenroseSeed, size: f64) -> Vec<Triangle> {
    match seed {
        PenroseSeed::Sun => initial_sun(10, size),
        PenroseSeed::Star => cartwheel_seed()
            .iter()
            .map(|t| cartwheel_triangle(t.kind, t.points.map(|p| p * size)))
            .collect(),
    }
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

#[cfg(test)]
fn parse_cartwheel_triangle(line: &str, size: f64) -> Triangle {
    let mut parts = line.split_ascii_whitespace();
    let tile_type = parts
        .next()
        .and_then(|value| value.chars().next())
        .expect("cartwheel seed row should start with a tile type");

    let parse_f64 = |raw: Option<&str>| {
        raw.expect("cartwheel seed row missing coordinate")
            .parse::<f64>()
            .expect("cartwheel seed row contains an invalid coordinate")
            * size
    };

    let points = [
        Vec2::new(parse_f64(parts.next()), parse_f64(parts.next())),
        Vec2::new(parse_f64(parts.next()), parse_f64(parts.next())),
        Vec2::new(parse_f64(parts.next()), parse_f64(parts.next())),
    ];

    cartwheel_triangle(tile_type, points)
}

fn cartwheel_triangle(tile_type: char, points: [Vec2; 3]) -> Triangle {
    let (kind, perm, parities) = match tile_type {
        'A' => (TriangleKind::Acute, [2usize, 0, 1], [false, false, true]),
        'B' => (TriangleKind::Acute, [2usize, 0, 1], [false, true, false]),
        'U' => (TriangleKind::Obtuse, [0usize, 1, 2], [false, true, false]),
        'V' => (TriangleKind::Obtuse, [1usize, 0, 2], [false, true, false]),
        other => panic!("unsupported cartwheel seed tile type: {other}"),
    };

    Triangle {
        kind,
        vertices: [
            Vertex::new(points[perm[0]], parities[0]),
            Vertex::new(points[perm[1]], parities[1]),
            Vertex::new(points[perm[2]], parities[2]),
        ],
    }
}

#[cfg(test)]
fn cartwheel_seed_data(expansion_step: usize) -> &'static str {
    match expansion_step {
        0 => include_str!("cartwheel_seed_data_0.txt"),
        1 => include_str!("cartwheel_seed_data_1.txt"),
        2 => include_str!("cartwheel_seed_data_2.txt"),
        3 => include_str!("cartwheel_seed_data_3.txt"),
        _ => include_str!("cartwheel_seed_data_4.txt"),
    }
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

    if left_edge != assembly_edge_index(left) || right_edge != assembly_edge_index(right) {
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

fn assembly_edge_index(triangle: Triangle) -> usize {
    (0..3)
        .find(|edge_index| {
            let (left, right) = triangle_edge_vertices(triangle, *edge_index);
            left.parity == right.parity
        })
        .expect("every Robinson triangle should have a decorated edge")
}

fn tile_fill_index(kind: TriangleKind) -> usize {
    match kind {
        TriangleKind::Acute => 0,
        TriangleKind::Obtuse => 1,
    }
}

fn triangle_edge_vertices(triangle: Triangle, edge_index: usize) -> (Vertex, Vertex) {
    match edge_index {
        0 => (triangle.vertices[0], triangle.vertices[1]),
        1 => (triangle.vertices[1], triangle.vertices[2]),
        2 => (triangle.vertices[2], triangle.vertices[0]),
        _ => unreachable!("invalid triangle edge index"),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn shortest_boundary_edge(tiles: &[RenderTile]) -> f64 {
        tiles
            .iter()
            .flat_map(|tile| {
                tile.points
                    .iter()
                    .zip(tile.points.iter().cycle().skip(1))
                    .take(tile.points.len())
                    .map(|(left, right)| distance(*left, *right))
            })
            .min_by(f64::total_cmp)
            .expect("the P2 patch should contain polygon edges")
    }

    fn shape_signature(points: &[Vec2]) -> Vec<i64> {
        let mut lengths = points
            .iter()
            .enumerate()
            .flat_map(|(left_index, left)| {
                points
                    .iter()
                    .skip(left_index + 1)
                    .map(move |right| (distance(*left, *right) * 1_000_000.0).round() as i64)
            })
            .collect::<Vec<_>>();
        lengths.sort_unstable();
        lengths
    }

    #[test]
    fn cartwheel_substitution_matches_all_four_reference_expansions() {
        let mut triangles = cartwheel_seed();
        for step in 1..=4 {
            triangles = subdivide_cartwheel(&triangles);
            let expected = cartwheel_seed_data(step)
                .lines()
                .map(|line| parse_cartwheel_triangle(line, 1.0))
                .collect::<Vec<_>>();
            assert_eq!(triangles.len(), expected.len());
            let signature = |triangle: Triangle| {
                let mut points = triangle.vertices.map(|vertex| {
                    (
                        (vertex.position.x * 1e8).round() as i64,
                        (vertex.position.y * 1e8).round() as i64,
                        vertex.parity,
                    )
                });
                points.sort_unstable();
                (triangle.kind == TriangleKind::Acute, points)
            };
            let mut actual = triangles
                .iter()
                .map(|t| signature(cartwheel_triangle(t.kind, t.points)))
                .collect::<Vec<_>>();
            let mut expected = expected.into_iter().map(signature).collect::<Vec<_>>();
            actual.sort_unstable();
            expected.sort_unstable();
            assert_eq!(actual, expected, "reference expansion {step}");
        }
    }

    #[test]
    fn cartwheel_spokes_keep_constant_width_far_from_the_center() {
        let seed = cartwheel_seed();
        for index in 0..10 {
            let angle = index as f64 * PI / 5.0;
            let direction = Vec2::new(angle.cos(), angle.sin());
            let normal = Vec2::new(-angle.sin(), angle.cos());
            for radius in [5.0, 50.0, 500.0] {
                assert_eq!(
                    cartwheel_region(direction * radius + normal * 0.3, &seed),
                    1
                );
                assert_eq!(
                    cartwheel_region(direction * radius + normal * 0.8, &seed),
                    0
                );
            }
        }
    }

    #[test]
    fn cartwheel_center_is_complete_and_stable_at_every_expansion() {
        let mut previous_count = 0;
        for step in 0..=6 {
            let tiles = render_cartwheel(step);
            assert!(tiles.len() > previous_count);
            previous_count = tiles.len();
            assert_eq!(tiles.iter().filter(|t| t.fill_index == 3).count(), 10);
            assert_eq!(tiles.iter().filter(|t| t.fill_index == 2).count(), 30);
            assert!(approx_eq(shortest_boundary_edge(&tiles), 1.0 / PHI));
            if step == 0 {
                // All 80 half-tiles must pair, including type A (formerly missing).
                assert_eq!(tiles.len(), 40);
            }
        }
    }

    #[test]
    fn sun_seed_assembles_into_five_kites() {
        let triangles = initial_seed(PenroseSeed::Sun, 1.0);
        let tiles = assembled_tiles(&triangles, PenroseTileMode::KiteDart);

        assert_eq!(tiles.len(), 5);
        assert!(tiles.iter().all(|tile| tile.points.len() == 4));

        let signatures = tiles
            .iter()
            .map(|tile| shape_signature(&tile.points))
            .collect::<Vec<_>>();
        assert!(signatures.windows(2).all(|window| window[0] == window[1]));
    }

    #[test]
    fn cartwheel_seed_generates_kites_and_darts() {
        let triangles = initial_seed(PenroseSeed::Star, 1.0);
        let tiles = assembled_tiles(&triangles, PenroseTileMode::KiteDart);

        assert!(!tiles.is_empty());
        assert!(tiles.iter().all(|tile| tile.points.len() == 4));

        let mut signatures = tiles
            .iter()
            .map(|tile| shape_signature(&tile.points))
            .collect::<Vec<_>>();
        signatures.sort_unstable();
        signatures.dedup();
        assert_eq!(signatures.len(), 2);
    }

    #[test]
    fn subdivided_sun_only_contains_kite_and_dart_shapes() {
        let mut triangles = initial_seed(PenroseSeed::Sun, 1.0);
        for _ in 0..3 {
            triangles = subdivide(&triangles);
        }

        let tiles = assembled_tiles(&triangles, PenroseTileMode::KiteDart);
        let mut signatures = tiles
            .iter()
            .map(|tile| shape_signature(&tile.points))
            .collect::<Vec<_>>();
        signatures.sort_unstable();
        signatures.dedup();

        assert_eq!(signatures.len(), 2);
    }

    #[test]
    fn p2_tile_size_is_independent_of_iterations() {
        let first = render_tiles(PenroseSeed::Sun, 1);
        let fourth = render_tiles(PenroseSeed::Sun, 4);

        assert!(approx_eq(
            shortest_boundary_edge(&first),
            shortest_boundary_edge(&fourth)
        ));
    }
}
