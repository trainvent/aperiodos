use std::f64::consts::PI;
use std::rc::Rc;

use aperiodos_render_core::{line_intersection, match_shapes, Affine, Vec2};

const HEX_Y: f64 = 0.866_025_403_784_438_6;
const TO_SCREEN: Affine = Affine::new([1.0, 0.0, 0.0, 0.0, -1.0, 0.0]);

#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub enum Label {
    H1,
    H,
    T,
    P,
    F,
}

impl Label {
    pub const fn palette_index(self) -> usize {
        match self {
            Self::H1 => 0,
            Self::H => 1,
            Self::T => 2,
            Self::P => 3,
            Self::F => 4,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Tile {
    pub vertices: Vec<Vec2>,
    pub label: Label,
    pub transform: Affine,
}

#[derive(Clone)]
struct Child {
    transform: Affine,
    geometry: Rc<Geometry>,
}

#[derive(Clone)]
struct MetaTile {
    shape: Vec<Vec2>,
    width: usize,
    children: Vec<Child>,
}

impl MetaTile {
    fn new(shape: Vec<Vec2>, width: usize) -> Self {
        Self {
            shape,
            width,
            children: Vec::new(),
        }
    }

    fn add_child(&mut self, transform: Affine, geometry: Rc<Geometry>) {
        self.children.push(Child {
            transform,
            geometry,
        });
    }

    fn eval_child(&self, child: usize, vertex: usize) -> Vec2 {
        self.children[child]
            .transform
            .apply(self.children[child].geometry.shape()[vertex])
    }

    fn recentre(&mut self) {
        let count = self.shape.len() as f64;
        let center = self
            .shape
            .iter()
            .copied()
            .fold(Vec2::ZERO, |sum, point| sum + point);
        let translation = Vec2::new(-center.x / count, -center.y / count);
        for point in &mut self.shape {
            *point = *point + translation;
        }
        let transform = Affine::translation(translation.x, translation.y);
        for child in &mut self.children {
            child.transform = transform.then(child.transform);
        }
    }
}

#[derive(Clone)]
enum Geometry {
    Hat(Label),
    Meta(MetaTile),
}

impl Geometry {
    fn shape(&self) -> &[Vec2] {
        match self {
            Self::Hat(_) => &HAT_OUTLINE,
            Self::Meta(meta) => &meta.shape,
        }
    }
}

const fn hex(x: f64, y: f64) -> Vec2 {
    Vec2::new(x + 0.5 * y, HEX_Y * y)
}

pub const HAT_OUTLINE: [Vec2; 13] = [
    hex(0.0, 0.0),
    hex(-1.0, -1.0),
    hex(0.0, -2.0),
    hex(2.0, -2.0),
    hex(2.0, -1.0),
    hex(4.0, -2.0),
    hex(5.0, -1.0),
    hex(4.0, 0.0),
    hex(3.0, 0.0),
    hex(2.0, 2.0),
    hex(0.0, 3.0),
    hex(0.0, 2.0),
    hex(-1.0, 2.0),
];

fn hats() -> [Rc<Geometry>; 5] {
    [Label::H1, Label::H, Label::T, Label::P, Label::F].map(|label| Rc::new(Geometry::Hat(label)))
}

fn initial_metatiles() -> [Rc<Geometry>; 4] {
    let hats = hats();

    let h_outline = vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(4.0, 0.0),
        Vec2::new(4.5, HEX_Y),
        Vec2::new(2.5, 5.0 * HEX_Y),
        Vec2::new(1.5, 5.0 * HEX_Y),
        Vec2::new(-0.5, HEX_Y),
    ];
    let mut h = MetaTile::new(h_outline.clone(), 2);
    h.add_child(
        match_shapes(HAT_OUTLINE[5], HAT_OUTLINE[7], h_outline[5], h_outline[0]),
        hats[1].clone(),
    );
    h.add_child(
        match_shapes(HAT_OUTLINE[9], HAT_OUTLINE[11], h_outline[1], h_outline[2]),
        hats[1].clone(),
    );
    h.add_child(
        match_shapes(HAT_OUTLINE[5], HAT_OUTLINE[7], h_outline[3], h_outline[4]),
        hats[1].clone(),
    );
    h.add_child(
        Affine::translation(2.5, HEX_Y)
            .then(Affine::new([-0.5, -HEX_Y, 0.0, HEX_Y, -0.5, 0.0]))
            .then(Affine::new([0.5, 0.0, 0.0, 0.0, -0.5, 0.0])),
        hats[0].clone(),
    );

    let t_outline = vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(3.0, 0.0),
        Vec2::new(1.5, 3.0 * HEX_Y),
    ];
    let mut t = MetaTile::new(t_outline, 2);
    t.add_child(
        Affine::new([0.5, 0.0, 0.5, 0.0, 0.5, HEX_Y]),
        hats[2].clone(),
    );

    let p_outline = vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(4.0, 0.0),
        Vec2::new(3.0, 2.0 * HEX_Y),
        Vec2::new(-1.0, 2.0 * HEX_Y),
    ];
    let mut p = MetaTile::new(p_outline, 2);
    p.add_child(
        Affine::new([0.5, 0.0, 1.5, 0.0, 0.5, HEX_Y]),
        hats[3].clone(),
    );
    p.add_child(
        Affine::translation(0.0, 2.0 * HEX_Y)
            .then(Affine::new([0.5, HEX_Y, 0.0, -HEX_Y, 0.5, 0.0]))
            .then(Affine::new([0.5, 0.0, 0.0, 0.0, 0.5, 0.0])),
        hats[3].clone(),
    );

    let f_outline = vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(3.0, 0.0),
        Vec2::new(3.5, HEX_Y),
        Vec2::new(3.0, 2.0 * HEX_Y),
        Vec2::new(-1.0, 2.0 * HEX_Y),
    ];
    let mut f = MetaTile::new(f_outline, 2);
    f.add_child(
        Affine::new([0.5, 0.0, 1.5, 0.0, 0.5, HEX_Y]),
        hats[4].clone(),
    );
    f.add_child(
        Affine::translation(0.0, 2.0 * HEX_Y)
            .then(Affine::new([0.5, HEX_Y, 0.0, -HEX_Y, 0.5, 0.0]))
            .then(Affine::new([0.5, 0.0, 0.0, 0.0, 0.5, 0.0])),
        hats[4].clone(),
    );

    [h, t, p, f].map(|meta| Rc::new(Geometry::Meta(meta)))
}

#[derive(Clone, Copy)]
enum Kind {
    H,
    T,
    P,
    F,
}

impl Kind {
    fn index(self) -> usize {
        match self {
            Self::H => 0,
            Self::T => 1,
            Self::P => 2,
            Self::F => 3,
        }
    }
}

enum Rule {
    Root(Kind),
    Attach {
        base: usize,
        base_edge: usize,
        kind: Kind,
        new_edge: usize,
    },
    Bridge {
        left: usize,
        left_edge: usize,
        right: usize,
        right_edge: usize,
        kind: Kind,
        new_edge: usize,
    },
}

fn construct_patch(tiles: &[Rc<Geometry>; 4]) -> MetaTile {
    use Kind::*;
    use Rule::*;
    let rules = [
        Root(H),
        Attach {
            base: 0,
            base_edge: 0,
            kind: P,
            new_edge: 2,
        },
        Attach {
            base: 1,
            base_edge: 0,
            kind: H,
            new_edge: 2,
        },
        Attach {
            base: 2,
            base_edge: 0,
            kind: P,
            new_edge: 2,
        },
        Attach {
            base: 3,
            base_edge: 0,
            kind: H,
            new_edge: 2,
        },
        Attach {
            base: 4,
            base_edge: 4,
            kind: P,
            new_edge: 2,
        },
        Attach {
            base: 0,
            base_edge: 4,
            kind: F,
            new_edge: 3,
        },
        Attach {
            base: 2,
            base_edge: 4,
            kind: F,
            new_edge: 3,
        },
        Bridge {
            left: 4,
            left_edge: 1,
            right: 3,
            right_edge: 2,
            kind: F,
            new_edge: 0,
        },
        Attach {
            base: 8,
            base_edge: 3,
            kind: H,
            new_edge: 0,
        },
        Attach {
            base: 9,
            base_edge: 2,
            kind: P,
            new_edge: 0,
        },
        Attach {
            base: 10,
            base_edge: 2,
            kind: H,
            new_edge: 0,
        },
        Attach {
            base: 11,
            base_edge: 4,
            kind: P,
            new_edge: 2,
        },
        Attach {
            base: 12,
            base_edge: 0,
            kind: H,
            new_edge: 2,
        },
        Attach {
            base: 13,
            base_edge: 0,
            kind: F,
            new_edge: 3,
        },
        Attach {
            base: 14,
            base_edge: 2,
            kind: F,
            new_edge: 1,
        },
        Attach {
            base: 15,
            base_edge: 3,
            kind: H,
            new_edge: 4,
        },
        Attach {
            base: 8,
            base_edge: 2,
            kind: F,
            new_edge: 1,
        },
        Attach {
            base: 17,
            base_edge: 3,
            kind: H,
            new_edge: 0,
        },
        Attach {
            base: 18,
            base_edge: 2,
            kind: P,
            new_edge: 0,
        },
        Attach {
            base: 19,
            base_edge: 2,
            kind: H,
            new_edge: 2,
        },
        Attach {
            base: 20,
            base_edge: 4,
            kind: F,
            new_edge: 3,
        },
        Attach {
            base: 20,
            base_edge: 0,
            kind: P,
            new_edge: 2,
        },
        Attach {
            base: 22,
            base_edge: 0,
            kind: H,
            new_edge: 2,
        },
        Attach {
            base: 23,
            base_edge: 4,
            kind: F,
            new_edge: 3,
        },
        Attach {
            base: 23,
            base_edge: 0,
            kind: F,
            new_edge: 3,
        },
        Attach {
            base: 16,
            base_edge: 0,
            kind: P,
            new_edge: 2,
        },
        Bridge {
            left: 9,
            left_edge: 4,
            right: 0,
            right_edge: 2,
            kind: T,
            new_edge: 2,
        },
        Attach {
            base: 4,
            base_edge: 0,
            kind: F,
            new_edge: 3,
        },
    ];

    let mut patch = MetaTile::new(
        Vec::new(),
        match &*tiles[0] {
            Geometry::Meta(meta) => meta.width,
            _ => 2,
        },
    );
    for rule in rules {
        match rule {
            Root(kind) => patch.add_child(Affine::IDENTITY, tiles[kind.index()].clone()),
            Attach {
                base,
                base_edge,
                kind,
                new_edge,
            } => {
                let child = &patch.children[base];
                let polygon = child.geometry.shape();
                let p = child
                    .transform
                    .apply(polygon[(base_edge + 1) % polygon.len()]);
                let q = child.transform.apply(polygon[base_edge]);
                let geometry = tiles[kind.index()].clone();
                let new_polygon = geometry.shape();
                patch.add_child(
                    match_shapes(
                        new_polygon[new_edge],
                        new_polygon[(new_edge + 1) % new_polygon.len()],
                        p,
                        q,
                    ),
                    geometry,
                );
            }
            Bridge {
                left,
                left_edge,
                right,
                right_edge,
                kind,
                new_edge,
            } => {
                let p = patch.children[right]
                    .transform
                    .apply(patch.children[right].geometry.shape()[right_edge]);
                let q = patch.children[left]
                    .transform
                    .apply(patch.children[left].geometry.shape()[left_edge]);
                let geometry = tiles[kind.index()].clone();
                let polygon = geometry.shape();
                patch.add_child(
                    match_shapes(
                        polygon[new_edge],
                        polygon[(new_edge + 1) % polygon.len()],
                        p,
                        q,
                    ),
                    geometry,
                );
            }
        }
    }
    patch
}

fn construct_metatiles(patch: &MetaTile) -> [Rc<Geometry>; 4] {
    let bps1 = patch.eval_child(8, 2);
    let bps2 = patch.eval_child(21, 2);
    let rbps = Affine::rotation_about(bps1, -2.0 * PI / 3.0).apply(bps2);
    let p72 = patch.eval_child(7, 2);
    let p252 = patch.eval_child(25, 2);
    let llc = line_intersection(bps1, rbps, patch.eval_child(6, 2), p72);
    let mut w = patch.eval_child(6, 2) - llc;

    let mut h_outline = vec![llc, bps1];
    w = Affine::rotation(-PI / 3.0).apply(w);
    h_outline.push(h_outline[1] + w);
    h_outline.push(patch.eval_child(14, 2));
    w = Affine::rotation(-PI / 3.0).apply(w);
    h_outline.push(h_outline[3] - w);
    h_outline.push(patch.eval_child(6, 2));
    let mut h = MetaTile::new(h_outline.clone(), patch.width * 2);
    for index in [0, 9, 16, 27, 26, 6, 1, 8, 10, 15] {
        h.children.push(patch.children[index].clone());
    }

    let mut p = MetaTile::new(vec![p72, p72 + (bps1 - llc), bps1, llc], patch.width * 2);
    for index in [7, 2, 3, 4, 28] {
        p.children.push(patch.children[index].clone());
    }

    let mut f = MetaTile::new(
        vec![
            bps2,
            patch.eval_child(24, 2),
            patch.eval_child(25, 0),
            p252,
            p252 + (llc - bps1),
        ],
        patch.width * 2,
    );
    for index in [21, 20, 22, 23, 24, 25] {
        f.children.push(patch.children[index].clone());
    }

    let aaa = h_outline[2];
    let bbb = h_outline[1] + (h_outline[4] - h_outline[5]);
    let ccc = Affine::rotation_about(bbb, -PI / 3.0).apply(aaa);
    let mut t = MetaTile::new(vec![bbb, ccc, aaa], patch.width * 2);
    t.children.push(patch.children[11].clone());

    for meta in [&mut h, &mut t, &mut p, &mut f] {
        meta.recentre();
    }
    [h, t, p, f].map(|meta| Rc::new(Geometry::Meta(meta)))
}

fn draw_geometry(geometry: &Geometry, transform: Affine, level: usize, output: &mut Vec<Tile>) {
    match geometry {
        Geometry::Hat(label) => output.push(Tile {
            vertices: HAT_OUTLINE
                .iter()
                .map(|point| transform.apply(*point))
                .collect(),
            label: *label,
            transform,
        }),
        Geometry::Meta(meta) if level > 0 => {
            for child in &meta.children {
                draw_geometry(
                    &child.geometry,
                    transform.then(child.transform),
                    level - 1,
                    output,
                );
            }
        }
        Geometry::Meta(meta) => output.push(Tile {
            vertices: meta
                .shape
                .iter()
                .map(|point| transform.apply(*point))
                .collect(),
            label: Label::H,
            transform,
        }),
    }
}

pub fn generate_tiles(iterations: usize) -> Vec<Tile> {
    let iterations = iterations.max(1);
    let mut metatiles = initial_metatiles();
    let mut level = 1;
    for generation in 1..iterations {
        let patch = construct_patch(&metatiles);
        metatiles = construct_metatiles(&patch);
        level += 1;
        debug_assert_eq!(generation + 1, level);
    }
    let mut output = Vec::new();
    draw_geometry(&metatiles[0], TO_SCREEN, level, &mut output);
    output
}

pub fn seed_to_coordinate(seed: u64) -> Vec2 {
    let mut start = 1_u64;
    let mut layer = 0_u64;
    while !(seed >= start && seed < start + 4 + 8 * layer) {
        start += 4 + 8 * layer;
        layer += 1;
    }
    let count = 4 + layer * 8;
    let mut output = Vec2::ZERO;
    if seed >= start && seed <= start + layer {
        output = Vec2::new((seed - start) as f64, layer as f64);
    } else if seed < start + count && seed >= start + count - layer - 1 {
        output = Vec2::new(seed as f64 - (start + count) as f64, layer as f64);
    } else if seed > start + layer * 3 && seed <= start + layer * 5 + 2 {
        output = Vec2::new(
            (start + layer * 4 + 1) as f64 - seed as f64,
            -(layer as f64) - 1.0,
        );
    } else if seed > start + layer && seed <= start + layer * 3 {
        output = Vec2::new(layer as f64, (start + layer * 2) as f64 - seed as f64);
    } else if seed > start + layer * 5 + 2 && seed < start + count - layer - 1 {
        output = Vec2::new(
            -(layer as f64) - 1.0,
            seed as f64 - (start + layer * 6 + 3) as f64,
        );
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn generations_match_python_reference_counts_and_bounds() {
        let expected = [
            (1, 4, (-0.5, -4.763139720814412, 4.75, 0.0)),
            (2, 25, (-6.5, -6.495190528383289, 5.5, 5.629165124598851)),
            (
                3,
                169,
                (-18.5, -16.887495373796554, 14.5, 16.021469970012117),
            ),
            (
                4,
                1156,
                (-50.5, -44.60030829489859, 39.5, 43.734282891114155),
            ),
            (
                5,
                7921,
                (-134.5, -117.34644221296604, 105.5, 116.4804168091816),
            ),
        ];
        for (iterations, count, bounds) in expected {
            let tiles = generate_tiles(iterations);
            assert_eq!(tiles.len(), count, "generation {iterations}");
            let actual = tiles.iter().flat_map(|tile| &tile.vertices).fold(
                (
                    f64::INFINITY,
                    f64::INFINITY,
                    f64::NEG_INFINITY,
                    f64::NEG_INFINITY,
                ),
                |(min_x, min_y, max_x, max_y), point| {
                    (
                        min_x.min(point.x),
                        min_y.min(point.y),
                        max_x.max(point.x),
                        max_y.max(point.y),
                    )
                },
            );
            for (actual, expected) in [actual.0, actual.1, actual.2, actual.3]
                .into_iter()
                .zip([bounds.0, bounds.1, bounds.2, bounds.3])
            {
                assert!(
                    (actual - expected).abs() < 1e-9,
                    "generation {iterations}: {actual} != {expected}"
                );
            }
        }
    }

    #[test]
    fn generation_five_family_counts_match_python_reference() {
        let counts = generate_tiles(5)
            .into_iter()
            .fold(BTreeMap::new(), |mut counts, tile| {
                *counts.entry(tile.label).or_insert(0) += 1;
                counts
            });
        assert_eq!(
            counts,
            BTreeMap::from([
                (Label::H1, 1009),
                (Label::H, 3027),
                (Label::T, 147),
                (Label::P, 1428),
                (Label::F, 2310)
            ])
        );
    }

    #[test]
    fn seed_spiral_matches_reference_coordinates() {
        let expected = [
            (1, (0.0, 0.0)),
            (2, (0.0, -1.0)),
            (3, (-1.0, -1.0)),
            (4, (-1.0, 0.0)),
            (5, (0.0, 1.0)),
            (10, (0.0, -2.0)),
            (25, (1.0, -3.0)),
        ];
        for (seed, (x, y)) in expected {
            assert_eq!(seed_to_coordinate(seed), Vec2::new(x, y));
        }
    }
}
