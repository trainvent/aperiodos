//! Shared geometry and SVG primitives for the Aperiodos renderers.

use std::ops::{Add, Sub};

pub mod scene;
pub mod studio;

pub use scene::{Polygon, Renderer, Scene, SvgElement};
pub use studio::render_studio_elements;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

impl Vec2 {
    pub const ZERO: Self = Self { x: 0.0, y: 0.0 };

    pub const fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

impl Add for Vec2 {
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        Self::new(self.x + rhs.x, self.y + rhs.y)
    }
}

impl Sub for Vec2 {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        Self::new(self.x - rhs.x, self.y - rhs.y)
    }
}

/// A two-dimensional affine transform stored as `[a, c, e, b, d, f]`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Affine(pub [f64; 6]);

impl Affine {
    pub const IDENTITY: Self = Self([1.0, 0.0, 0.0, 0.0, 1.0, 0.0]);

    pub const fn new(values: [f64; 6]) -> Self {
        Self(values)
    }

    pub const fn translation(x: f64, y: f64) -> Self {
        Self([1.0, 0.0, x, 0.0, 1.0, y])
    }

    pub fn rotation(angle: f64) -> Self {
        let (sin, cos) = angle.sin_cos();
        Self([cos, -sin, 0.0, sin, cos, 0.0])
    }

    pub fn rotation_about(point: Vec2, angle: f64) -> Self {
        Self::translation(point.x, point.y)
            .then(Self::rotation(angle))
            .then(Self::translation(-point.x, -point.y))
    }

    /// Returns `self * rhs`, applying `rhs` before `self`.
    pub fn then(self, rhs: Self) -> Self {
        let a = self.0;
        let b = rhs.0;
        Self([
            a[0] * b[0] + a[1] * b[3],
            a[0] * b[1] + a[1] * b[4],
            a[0] * b[2] + a[1] * b[5] + a[2],
            a[3] * b[0] + a[4] * b[3],
            a[3] * b[1] + a[4] * b[4],
            a[3] * b[2] + a[4] * b[5] + a[5],
        ])
    }

    pub fn apply(self, point: Vec2) -> Vec2 {
        Vec2::new(
            self.0[0] * point.x + self.0[1] * point.y + self.0[2],
            self.0[3] * point.x + self.0[4] * point.y + self.0[5],
        )
    }

    pub fn inverse(self) -> Self {
        let m = self.0;
        let determinant = m[0] * m[4] - m[1] * m[3];
        Self([
            m[4] / determinant,
            -m[1] / determinant,
            (m[1] * m[5] - m[2] * m[4]) / determinant,
            -m[3] / determinant,
            m[0] / determinant,
            (m[2] * m[3] - m[0] * m[5]) / determinant,
        ])
    }
}

pub fn match_segment(start: Vec2, end: Vec2) -> Affine {
    Affine::new([
        end.x - start.x,
        start.y - end.y,
        start.x,
        end.y - start.y,
        end.x - start.x,
        start.y,
    ])
}

pub fn match_shapes(
    source_start: Vec2,
    source_end: Vec2,
    target_start: Vec2,
    target_end: Vec2,
) -> Affine {
    match_segment(target_start, target_end).then(match_segment(source_start, source_end).inverse())
}

pub fn line_intersection(p1: Vec2, q1: Vec2, p2: Vec2, q2: Vec2) -> Vec2 {
    let denominator = (q2.y - p2.y) * (q1.x - p1.x) - (q2.x - p2.x) * (q1.y - p1.y);
    let u = ((q2.x - p2.x) * (p1.y - p2.y) - (q2.y - p2.y) * (p1.x - p2.x)) / denominator;
    Vec2::new(p1.x + u * (q1.x - p1.x), p1.y + u * (q1.y - p1.y))
}

pub fn escape_xml(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn affine_composition_applies_right_hand_transform_first() {
        let transform =
            Affine::translation(4.0, -1.0).then(Affine::rotation(std::f64::consts::FRAC_PI_2));
        let point = transform.apply(Vec2::new(2.0, 0.0));
        assert!((point.x - 4.0).abs() < 1e-12);
        assert!((point.y - 1.0).abs() < 1e-12);
    }

    #[test]
    fn xml_attribute_values_are_escaped() {
        assert_eq!(escape_xml("<&\"'>"), "&lt;&amp;&quot;&apos;&gt;");
    }
}
