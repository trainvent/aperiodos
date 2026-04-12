use std::collections::HashMap;
use std::f64::consts::PI;

use crate::math::Vec2;

use super::{PenroseSeed, RenderTile};

#[derive(Clone, Copy, Debug)]
struct Transform {
    a: f64,
    b: f64,
    c: f64,
    d: f64,
    tx: f64,
    ty: f64,
}

#[derive(Clone, Copy, Debug)]
struct Frame {
    transform: Transform,
    step: f64,
}

pub(super) fn render_tiles(seed: PenroseSeed, iterations: usize) -> Vec<RenderTile> {
    let iterations = iterations.min(6);
    let rules = pentagon_rules();
    let seed_word = match seed {
        PenroseSeed::Sun => "[P][+P][*P][-P][_P][G][+G][*G][-G][_G]",
        PenroseSeed::Star => "[G][+G][*G][-G][_G]",
    };
    let word = expand_lsystem(seed_word, iterations, &rules);
    let inflation = (2.0 + 2.0 * cos_deg(72.0)).powi(iterations as i32);
    execute_word(&word, inflation)
}

fn pentagon_rules() -> HashMap<char, &'static str> {
    HashMap::from([
        ('P', "[s>P][1sF+Q][1+sF+Q][1*sF+Q][1-sF+Q][1_sF+Q]"),
        ('Q', "[s>P][1+sFR][1*sF*R][1-sF+Q][1_sF+Q][1sF+Q][->fsD]"),
        ('R', "[s>P][1-sF+Q][1+sF*R][1*sFR][1_sF*R][1sFR][_>fsD][>fsD]"),
        (
            'G',
            "[s>G][se[>d+R][e1B]][+se[>d+R][e1B]][-se[>d+R][e1B]][*se[>d+R][e1B]][_se[>d+R][e1B]]",
        ),
        (
            'B',
            "[s>G][se[>d+R][e1B]][+se[>d+R][e1B]][-se[>d+R][e1B]]",
        ),
        ('D', "[s>d+R][s>eG][se1B]"),
    ])
}

fn expand_lsystem(seed: &str, iterations: usize, rules: &HashMap<char, &'static str>) -> String {
    let mut word = seed.to_owned();
    for _ in 0..iterations {
        let mut next = String::with_capacity(word.len() * 4);
        for ch in word.chars() {
            if let Some(replacement) = rules.get(&ch) {
                next.push_str(replacement);
            } else {
                next.push(ch);
            }
        }
        word = next;
    }
    word
}

fn execute_word(word: &str, initial_step: f64) -> Vec<RenderTile> {
    let mut tiles = Vec::new();
    let mut stack = Vec::new();
    let mut frame = Frame {
        transform: Transform::identity(),
        step: initial_step,
    };

    for ch in word.chars() {
        match ch {
            '[' => stack.push(frame),
            ']' => {
                if let Some(previous) = stack.pop() {
                    frame = previous;
                }
            }
            '1' => {}
            '+' => frame.transform = frame.transform.then(Transform::rotate_deg(72.0)),
            '*' => frame.transform = frame.transform.then(Transform::rotate_deg(144.0)),
            '-' => frame.transform = frame.transform.then(Transform::rotate_deg(288.0)),
            '_' => frame.transform = frame.transform.then(Transform::rotate_deg(216.0)),
            '>' => frame.transform = frame.transform.then(Transform::rotate_deg(180.0)),
            '|' => frame.transform = frame.transform.then(Transform::xscale(-1.0)),
            's' => frame.step *= 1.0 / (2.0 + 2.0 * cos_deg(72.0)),
            'f' => {
                frame.transform = frame
                    .transform
                    .then(Transform::translate(0.0, tan_deg(54.0) * frame.step / 2.0))
            }
            'F' => {
                frame.transform = frame
                    .transform
                    .then(Transform::translate(0.0, tan_deg(54.0) * frame.step))
            }
            'd' => {
                frame.transform = frame.transform.then(Transform::translate(
                    0.0,
                    (tan_deg(54.0) / 2.0 - tan_deg(72.0) / 2.0 + sin_deg(36.0)) * frame.step,
                ))
            }
            'e' => {
                frame.transform = frame.transform.then(Transform::translate(
                    0.0,
                    tan_deg(54.0) * cos_deg(36.0) * frame.step,
                ))
            }
            'P' | 'Q' | 'R' => draw_pentagon(&mut tiles, frame),
            'G' => draw_star(&mut tiles, frame),
            'B' => draw_boat(&mut tiles, frame),
            'D' => draw_diamond(&mut tiles, frame),
            _ => {}
        }
    }

    tiles
}

fn draw_pentagon(tiles: &mut Vec<RenderTile>, frame: Frame) {
    let transform = frame
        .transform
        .then(Transform::translate(-frame.step / 2.0, -frame.step * tan_deg(54.0) / 2.0))
        .then(Transform::scale(frame.step));
    tiles.push(RenderTile {
        points: pentagon_points()
            .into_iter()
            .map(|point| transform.apply(point))
            .collect(),
        fill_index: 0,
    });
}

fn draw_star(tiles: &mut Vec<RenderTile>, frame: Frame) {
    let transform = frame
        .transform
        .then(Transform::translate(
            frame.step * cos_deg(72.0),
            frame.step * tan_deg(54.0) * cos_deg(72.0),
        ))
        .then(Transform::scale(frame.step));
    tiles.push(RenderTile {
        points: star_points()
            .into_iter()
            .map(|point| transform.apply(point))
            .collect(),
        fill_index: 1,
    });
}

fn draw_boat(tiles: &mut Vec<RenderTile>, frame: Frame) {
    let transform = frame
        .transform
        .then(Transform::translate(
            frame.step * cos_deg(72.0),
            frame.step * tan_deg(54.0) * cos_deg(72.0),
        ))
        .then(Transform::scale(frame.step));
    tiles.push(RenderTile {
        points: boat_points()
            .into_iter()
            .map(|point| transform.apply(point))
            .collect(),
        fill_index: 2,
    });
}

fn draw_diamond(tiles: &mut Vec<RenderTile>, frame: Frame) {
    let transform = frame
        .transform
        .then(Transform::rotate_deg(90.0))
        .then(Transform::translate(-frame.step * cos_deg(18.0), 0.0))
        .then(Transform::scale(frame.step));
    tiles.push(RenderTile {
        points: diamond_points()
            .into_iter()
            .map(|point| transform.apply(point))
            .collect(),
        fill_index: 3,
    });
}

fn pentagon_points() -> Vec<Vec2> {
    vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(cos_deg(108.0), sin_deg(108.0)),
        Vec2::new(
            1.0 + cos_deg(72.0) + cos_deg(144.0),
            sin_deg(72.0) + sin_deg(144.0),
        ),
        Vec2::new(1.0 + cos_deg(72.0), sin_deg(72.0)),
        Vec2::new(1.0, 0.0),
    ]
}

fn star_points() -> Vec<Vec2> {
    vec![
        Vec2::new(1.0, 0.0),
        Vec2::new(1.0 - cos_deg(36.0), -sin_deg(36.0)),
        Vec2::new(
            1.0 - cos_deg(36.0) - cos_deg(108.0),
            -sin_deg(36.0) - sin_deg(108.0),
        ),
        Vec2::new(cos_deg(108.0), -sin_deg(108.0)),
        Vec2::new(
            -1.0 + 3.0 * cos_deg(108.0) + cos_deg(36.0),
            -sin_deg(36.0) - sin_deg(108.0),
        ),
        Vec2::new(
            -1.0 + 2.0 * cos_deg(108.0) + cos_deg(36.0),
            -sin_deg(36.0),
        ),
        Vec2::new(-1.0 + 2.0 * cos_deg(108.0), 0.0),
        Vec2::new(2.0 * cos_deg(108.0), 0.0),
        Vec2::new(cos_deg(108.0), sin_deg(108.0)),
        Vec2::new(0.0, 0.0),
    ]
}

fn boat_points() -> Vec<Vec2> {
    vec![
        Vec2::new(-1.0 + 2.0 * cos_deg(108.0), 0.0),
        Vec2::new(2.0 * cos_deg(108.0), 0.0),
        Vec2::new(cos_deg(108.0), sin_deg(108.0)),
        Vec2::new(0.0, 0.0),
        Vec2::new(1.0, 0.0),
        Vec2::new(1.0 - cos_deg(36.0), -sin_deg(36.0)),
        Vec2::new(-1.0 + 2.0 * cos_deg(108.0) + cos_deg(36.0), -sin_deg(36.0)),
    ]
}

fn diamond_points() -> Vec<Vec2> {
    vec![
        Vec2::new(0.0, 0.0),
        Vec2::new(cos_deg(18.0), sin_deg(18.0)),
        Vec2::new(2.0 * cos_deg(18.0), 0.0),
        Vec2::new(cos_deg(18.0), -sin_deg(18.0)),
    ]
}

impl Transform {
    fn identity() -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: 0.0,
            ty: 0.0,
        }
    }

    fn translate(x: f64, y: f64) -> Self {
        Self {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: x,
            ty: y,
        }
    }

    fn scale(factor: f64) -> Self {
        Self {
            a: factor,
            b: 0.0,
            c: 0.0,
            d: factor,
            tx: 0.0,
            ty: 0.0,
        }
    }

    fn xscale(factor: f64) -> Self {
        Self {
            a: factor,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: 0.0,
            ty: 0.0,
        }
    }

    fn rotate_deg(degrees: f64) -> Self {
        let radians = degrees * PI / 180.0;
        let (s, c) = radians.sin_cos();
        Self {
            a: c,
            b: s,
            c: -s,
            d: c,
            tx: 0.0,
            ty: 0.0,
        }
    }

    fn then(self, rhs: Self) -> Self {
        Self {
            a: self.a * rhs.a + self.c * rhs.b,
            b: self.b * rhs.a + self.d * rhs.b,
            c: self.a * rhs.c + self.c * rhs.d,
            d: self.b * rhs.c + self.d * rhs.d,
            tx: self.a * rhs.tx + self.c * rhs.ty + self.tx,
            ty: self.b * rhs.tx + self.d * rhs.ty + self.ty,
        }
    }

    fn apply(self, point: Vec2) -> Vec2 {
        Vec2::new(
            self.a * point.x + self.c * point.y + self.tx,
            self.b * point.x + self.d * point.y + self.ty,
        )
    }
}

fn radians(degrees: f64) -> f64 {
    degrees * PI / 180.0
}

fn sin_deg(degrees: f64) -> f64 {
    radians(degrees).sin()
}

fn cos_deg(degrees: f64) -> f64 {
    radians(degrees).cos()
}

fn tan_deg(degrees: f64) -> f64 {
    sin_deg(degrees) / cos_deg(degrees)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn p1_mode_uses_multiple_tile_classes() {
        let tiles = render_tiles(PenroseSeed::Sun, 4);
        assert!(!tiles.is_empty());
        let distinct = tiles
            .iter()
            .map(|tile| tile.fill_index)
            .collect::<std::collections::BTreeSet<_>>();
        assert!(distinct.len() >= 3);
    }
}
