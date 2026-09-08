use std::collections::BTreeMap;
use std::f64::consts::{PI, TAU};
use std::fmt;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const ROOT: f64 = 0.866_025_403_784_438_6;
const CARTESIAN_GRID_STEP: f64 = 0.125;

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub struct LatticePoint {
    pub u: f64,
    pub v: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct BoundaryPoint {
    point: LatticePoint,
    edge: usize,
    t: f64,
    distance: f64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GeometryError(String);

impl GeometryError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl fmt::Display for GeometryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for GeometryError {}

pub const HAT_LATTICE: [LatticePoint; 13] = [
    LatticePoint { u: 0.0, v: 0.0 },
    LatticePoint { u: -1.0, v: -1.0 },
    LatticePoint { u: 0.0, v: -2.0 },
    LatticePoint { u: 2.0, v: -2.0 },
    LatticePoint { u: 2.0, v: -1.0 },
    LatticePoint { u: 4.0, v: -2.0 },
    LatticePoint { u: 5.0, v: -1.0 },
    LatticePoint { u: 4.0, v: 0.0 },
    LatticePoint { u: 3.0, v: 0.0 },
    LatticePoint { u: 2.0, v: 2.0 },
    LatticePoint { u: 0.0, v: 3.0 },
    LatticePoint { u: 0.0, v: 2.0 },
    LatticePoint { u: -1.0, v: 2.0 },
];

pub fn lattice_to_cartesian(point: LatticePoint) -> Point {
    Point {
        x: point.u + point.v / 2.0,
        y: point.v * ROOT,
    }
}

pub fn cartesian_to_lattice(point: Point) -> LatticePoint {
    let v = point.y / ROOT;
    LatticePoint {
        u: point.x - v / 2.0,
        v,
    }
}

pub fn snap_lattice_point(point: LatticePoint, step: f64) -> LatticePoint {
    if step == 0.0 {
        point
    } else {
        LatticePoint {
            u: (point.u / step).round() * step,
            v: (point.v / step).round() * step,
        }
    }
}

pub fn snap_cartesian_point(point: LatticePoint, step: f64) -> LatticePoint {
    if step == 0.0 {
        return point;
    }
    let point = lattice_to_cartesian(point);
    cartesian_to_lattice(Point {
        x: (point.x / step).round() * step,
        y: (point.y / step).round() * step,
    })
}

fn point(x: f64, y: f64) -> Point {
    Point { x, y }
}

fn hat_cartesian() -> Vec<Point> {
    HAT_LATTICE.into_iter().map(lattice_to_cartesian).collect()
}

fn spectre_points() -> Vec<Point> {
    vec![
        point(0.0, 0.0),
        point(1.0, 0.0),
        point(2.0, 0.0),
        point(2.5, ROOT),
        point(2.5 + ROOT, ROOT - 0.5),
        point(2.5 + ROOT * 2.0, ROOT),
        point(2.0 + ROOT * 2.0, ROOT * 2.0),
        point(1.0 + ROOT * 2.0, ROOT * 2.0),
        point(1.0 + ROOT * 2.0, 1.0 + ROOT * 2.0),
        point(1.0 + ROOT, 1.5 + ROOT * 2.0),
        point(0.5 + ROOT, 1.5 + ROOT),
        point(ROOT - 0.5, 1.5 + ROOT),
        point(ROOT - 0.5, 0.5 + ROOT),
        point(-0.5, ROOT),
    ]
}

fn nearest_polygon_boundary_cartesian(target: Point, points: &[Point]) -> (Point, usize, f64, f64) {
    let mut nearest = (Point { x: 0.0, y: 0.0 }, 0, 0.0, f64::INFINITY);
    for (edge, start) in points.iter().copied().enumerate() {
        let end = points[(edge + 1) % points.len()];
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let length_squared = dx * dx + dy * dy;
        let raw_t = if length_squared == 0.0 {
            0.0
        } else {
            ((target.x - start.x) * dx + (target.y - start.y) * dy) / length_squared
        };
        let t = raw_t.clamp(0.0, 1.0);
        let projected = point(start.x + dx * t, start.y + dy * t);
        let distance = (projected.x - target.x).hypot(projected.y - target.y);
        if distance < nearest.3 {
            nearest = (projected, edge, t, distance);
        }
    }
    nearest
}

fn nearest_polygon_boundary(target: LatticePoint, points: &[Point]) -> BoundaryPoint {
    let (point, edge, t, distance) =
        nearest_polygon_boundary_cartesian(lattice_to_cartesian(target), points);
    BoundaryPoint {
        point: cartesian_to_lattice(point),
        edge,
        t,
        distance,
    }
}

pub(crate) fn material_transform(points: &[Point]) -> ([f64; 6], [f64; 6], f64) {
    let origin = points[0];
    let unit = points[1];
    let third = points[2];
    let ax = unit.x - origin.x;
    let ay = unit.y - origin.y;
    let cx = (third.x - origin.x - ax / 2.0) / ROOT;
    let cy = (third.y - origin.y - ay / 2.0) / ROOT;
    let determinant = ax * cy - ay * cx;
    let forward = [ax, cx, origin.x, ay, cy, origin.y];
    let inverse = [
        cy / determinant,
        -cx / determinant,
        (cx * origin.y - cy * origin.x) / determinant,
        -ay / determinant,
        ax / determinant,
        (ay * origin.x - ax * origin.y) / determinant,
    ];
    (forward, inverse, ax.hypot(ay))
}

fn apply(transform: [f64; 6], point: Point) -> Point {
    Point {
        x: transform[0] * point.x + transform[1] * point.y + transform[2],
        y: transform[3] * point.x + transform[4] * point.y + transform[5],
    }
}

fn selected_shape(family: &str, tile_type: &str) -> Result<Shape, GeometryError> {
    let shapes = shapes_for_family(family)?;
    shapes
        .iter()
        .find(|shape| shape.tile_type == tile_type)
        .or_else(|| shapes.first())
        .cloned()
        .ok_or_else(|| GeometryError::new(format!("unknown Studio tile type for {family}")))
}

pub fn penrose_editor_geometry(family: &str, tile_type: &str) -> Result<Value, GeometryError> {
    let shape = selected_shape(family, tile_type)?;
    let (forward, inverse, material_scale) = material_transform(&shape.points);
    let material_vertices = shape
        .points
        .iter()
        .copied()
        .map(|point| cartesian_to_lattice(apply(inverse, point)))
        .collect::<Vec<_>>();
    let center_shape = shape.points.iter().fold(point(0.0, 0.0), |sum, candidate| {
        point(
            sum.x + candidate.x / shape.points.len() as f64,
            sum.y + candidate.y / shape.points.len() as f64,
        )
    });
    let center_material = apply(inverse, center_shape);
    let center = cartesian_to_lattice(center_material);
    let (boundary, _, _, _) = nearest_polygon_boundary_cartesian(center_shape, &shape.points);
    let boundary_material = apply(inverse, boundary);
    let inset_radius = 0.125_f64.max(
        (boundary_material.x - center_material.x).hypot(boundary_material.y - center_material.y)
            * 0.35,
    );
    let start = material_vertices[0];
    let end = material_vertices[material_vertices.len() / 2];
    let interpolate = |amount: f64| LatticePoint {
        u: start.u + (end.u - start.u) * amount,
        v: start.v + (end.v - start.v) * amount,
    };
    let arc_offset = inset_radius * 0.8;
    let cartesian_grid_lines = cartesian_grid_lines(-10.0, 10.0, CARTESIAN_GRID_STEP)
        .into_iter()
        .map(|line| {
            line.map(|point| cartesian_to_lattice(apply(inverse, lattice_to_cartesian(point))))
        })
        .collect::<Vec<_>>();
    let mut geometry = geometry_adapter(family)?;
    geometry["label"] = json!(format!(
        "{} · {}",
        geometry["label"].as_str().unwrap(),
        shape.name
    ));
    geometry["points"] = json!(shape.points);
    geometry["allPoints"] = geometry["points"].clone();
    geometry["fitCanvas"] = json!(true);
    geometry["shapes"] = Value::Null;
    geometry["materialTransform"] = json!(forward);
    geometry["shapeTransform"] = json!(inverse);
    geometry["materialScale"] = json!(material_scale);
    geometry["materialVertices"] = json!(material_vertices);
    geometry["cartesianGridLines"] = json!(cartesian_grid_lines);
    geometry["activeTileType"] = json!(shape.tile_type);
    geometry["defaultElements"] = json!({
        "pathPoints":[start,interpolate(1.0/3.0),interpolate(2.0/3.0),end],
        "linePoints":[start,end],"circleCenter":center,"circleRadius":inset_radius,
        "circularPathPoints":[cartesian_to_lattice(point(center_material.x-arc_offset,center_material.y)),center,cartesian_to_lattice(point(center_material.x+arc_offset,center_material.y))]
    });
    Ok(geometry)
}

fn penrose_nearest_boundary(
    family: &str,
    tile_type: &str,
    target: LatticePoint,
) -> Result<Value, GeometryError> {
    let shape = selected_shape(family, tile_type)?;
    let (forward, inverse, _) = material_transform(&shape.points);
    let target_shape = apply(forward, lattice_to_cartesian(target));
    let (point, edge, t, distance) =
        nearest_polygon_boundary_cartesian(target_shape, &shape.points);
    Ok(
        json!({"point":cartesian_to_lattice(apply(inverse,point)),"edge":edge,"t":t,"distance":distance}),
    )
}

fn snap_penrose_cartesian(
    family: &str,
    tile_type: &str,
    target: LatticePoint,
    step: f64,
) -> Result<Value, GeometryError> {
    if step == 0.0 {
        return Ok(json!(target));
    }
    let shape = selected_shape(family, tile_type)?;
    let (forward, inverse, _) = material_transform(&shape.points);
    let point = apply(forward, lattice_to_cartesian(target));
    Ok(json!(cartesian_to_lattice(apply(
        inverse,
        Point {
            x: (point.x / step).round() * step,
            y: (point.y / step).round() * step
        }
    ))))
}

pub fn nearest_boundary(
    family: &str,
    target: LatticePoint,
    tile_type: Option<&str>,
) -> Result<Value, GeometryError> {
    let shapes = shapes_for_family(family)?;
    let candidates = match tile_type {
        Some(tile_type) => shapes
            .into_iter()
            .filter(|shape| shape.tile_type == tile_type)
            .collect(),
        None => shapes,
    };
    candidates
        .iter()
        .map(|shape| nearest_polygon_boundary(target, &shape.points))
        .min_by(|left, right| left.distance.total_cmp(&right.distance))
        .map(|answer| serde_json::to_value(answer).expect("boundary is serializable"))
        .ok_or_else(|| GeometryError::new(format!("unknown Studio tile type for {family}")))
}

fn bind_path_endpoints(path: &Value) -> Result<Value, GeometryError> {
    let mut output = path.clone();
    let Some(points) = output.get_mut("points").and_then(Value::as_array_mut) else {
        return Ok(output);
    };
    if points.is_empty() {
        return Ok(output);
    }
    let first: LatticePoint = serde_json::from_value(points[0].clone())
        .map_err(|error| GeometryError::new(format!("invalid path endpoint: {error}")))?;
    points[0] = nearest_boundary("einstein", first, None)?["point"].clone();
    let last_index = points.len() - 1;
    let last_point: LatticePoint = serde_json::from_value(points[last_index].clone())
        .map_err(|error| GeometryError::new(format!("invalid path endpoint: {error}")))?;
    points[last_index] = nearest_boundary("einstein", last_point, None)?["point"].clone();
    Ok(output)
}

pub fn snap_circle_handle(
    center: LatticePoint,
    handle: LatticePoint,
    lattice_step: f64,
    angle_step: f64,
) -> Value {
    let center_cartesian = lattice_to_cartesian(center);
    let handle_cartesian = lattice_to_cartesian(handle);
    let dx = handle_cartesian.x - center_cartesian.x;
    let dy = handle_cartesian.y - center_cartesian.y;
    let raw_radius = dx.hypot(dy);
    let raw_angle = dy.atan2(dx).to_degrees();
    let snapped_angle = if angle_step == 0.0 {
        raw_angle
    } else {
        (raw_angle / angle_step).round() * angle_step
    };
    let handle_angle = snapped_angle.rem_euclid(360.0);
    let mut radius = raw_radius;

    if lattice_step != 0.0 {
        let radians = handle_angle.to_radians();
        let direction = cartesian_to_lattice(point(radians.cos(), radians.sin()));
        let families = [
            (center.u, direction.u),
            (center.v, direction.v),
            (center.u + center.v, direction.u + direction.v),
        ];
        let mut candidates = Vec::new();
        for (center_coordinate, direction_coordinate) in families {
            if direction_coordinate.abs() < 1e-10 {
                continue;
            }
            let raw_coordinate = center_coordinate + raw_radius * direction_coordinate;
            let nearest_line = (raw_coordinate / lattice_step).round();
            for offset in -2..=2 {
                let line_coordinate = (nearest_line + f64::from(offset)) * lattice_step;
                let candidate = (line_coordinate - center_coordinate) / direction_coordinate;
                if candidate >= 0.125 {
                    candidates.push(candidate);
                }
            }
        }
        if let Some(candidate) = candidates.into_iter().min_by(|left, right| {
            (left - raw_radius)
                .abs()
                .total_cmp(&(right - raw_radius).abs())
        }) {
            radius = candidate;
        }
    }
    json!({"radius": radius.max(0.125), "handleAngle": handle_angle})
}

pub fn circle_handle_point(center: LatticePoint, radius: f64, handle_angle: f64) -> LatticePoint {
    let center = lattice_to_cartesian(center);
    let angle = handle_angle.to_radians();
    cartesian_to_lattice(point(
        center.x + radius * angle.cos(),
        center.y + radius * angle.sin(),
    ))
}

fn directed_angle_delta(start: f64, end: f64, direction: f64) -> f64 {
    if direction > 0.0 {
        (end - start).rem_euclid(TAU)
    } else {
        -(start - end).rem_euclid(TAU)
    }
}

pub fn circular_path_geometry(
    points: [LatticePoint; 3],
    side: &str,
    steps_per_turn: usize,
) -> Value {
    let [point1, point2, point3] = points.map(lattice_to_cartesian);
    let vector12 = point(point2.x - point1.x, point2.y - point1.y);
    let vector23 = point(point3.x - point2.x, point3.y - point2.y);
    let distance12 = vector12.x.hypot(vector12.y);
    let distance23 = vector23.x.hypot(vector23.y);
    if distance12 < 1e-9 || distance23 < 1e-9 {
        return json!({"points": [], "segments": [], "radius": 0.0, "distance12": distance12, "distance23": distance23, "mismatch": true});
    }
    let radius = distance12 / 2.0;
    let angle12 = vector12.y.atan2(vector12.x);
    let angle23 = vector23.y.atan2(vector23.x);
    let direction = if side == "right" { -1.0 } else { 1.0 };
    let arcs = [
        (point1, angle12 + PI, direction * PI, true, 0usize),
        (
            point2,
            angle12 + PI,
            directed_angle_delta(angle12 + PI, angle23, -direction),
            false,
            0usize,
        ),
        (point3, angle23 + PI, direction * PI, true, 1usize),
    ];
    let mut segments = [Vec::new(), Vec::new()];
    for (center, start, delta, include_start, segment) in arcs {
        let steps = ((delta.abs() / TAU * steps_per_turn as f64).ceil() as usize).max(2);
        let first = usize::from(!include_start);
        for index in first..=steps {
            let angle = start + delta * index as f64 / steps as f64;
            segments[segment].push(cartesian_to_lattice(point(
                center.x + radius * angle.cos(),
                center.y + radius * angle.sin(),
            )));
        }
    }
    let all = segments.iter().flatten().copied().collect::<Vec<_>>();
    json!({
        "points": all,
        "segments": segments,
        "radius": radius,
        "distance12": distance12,
        "distance23": distance23,
        "mismatch": (distance12 - distance23).abs() > 1e-4,
    })
}

pub fn spectre_edge_control(
    start: Point,
    end: Point,
    index: usize,
    roundness: f64,
    lean: f64,
    weight: f64,
) -> Point {
    let dx = end.x - start.x;
    let dy = end.y - start.y;
    let length = dx.hypot(dy).max(f64::EPSILON);
    let direction = if index % 2 == 1 { -1.0 } else { 1.0 };
    let progress = if index % 2 == 1 { 1.0 - weight } else { weight };
    let bulge = roundness * lean * direction * length;
    point(
        start.x + dx * progress - dy / length * bulge,
        start.y + dy * progress + dx / length * bulge,
    )
}

pub fn spectre_path(points: &[Point], roundness: f64, lean: f64, weight: f64) -> String {
    let Some(first) = points.first() else {
        return String::new();
    };
    let mut result = format!("M {:.4} {:.4}", first.x, first.y);
    for (index, start) in points.iter().copied().enumerate() {
        let end = points[(index + 1) % points.len()];
        let control = spectre_edge_control(start, end, index, roundness, lean, weight);
        result.push_str(&format!(
            " Q {:.4} {:.4} {:.4} {:.4}",
            control.x, control.y, end.x, end.y
        ));
    }
    result.push_str(" Z");
    result
}

fn spectre_segments(points: &[Point], roundness: f64, lean: f64, weight: f64) -> Value {
    Value::Array(
        points
            .iter()
            .copied()
            .enumerate()
            .map(|(index, start)| {
                let end = points[(index + 1) % points.len()];
                json!({
                    "start": start,
                    "control": spectre_edge_control(start, end, index, roundness, lean, weight),
                    "end": end,
                    "index": index,
                })
            })
            .collect(),
    )
}

#[derive(Clone)]
pub(crate) struct Shape {
    pub(crate) name: &'static str,
    pub(crate) tile_type: &'static str,
    pub(crate) points: Vec<Point>,
}

fn translate(mut points: Vec<Point>, x: f64, y: f64) -> Vec<Point> {
    for point in &mut points {
        point.x += x;
        point.y += y;
    }
    points
}

fn rotate(points: Vec<Point>, degrees: f64) -> Vec<Point> {
    let center = points.iter().fold(point(0.0, 0.0), |sum, point| Point {
        x: sum.x + point.x / points.len() as f64,
        y: sum.y + point.y / points.len() as f64,
    });
    let (sin, cos) = degrees.to_radians().sin_cos();
    points
        .into_iter()
        .map(|point| {
            let dx = point.x - center.x;
            let dy = point.y - center.y;
            Point {
                x: center.x + dx * cos - dy * sin,
                y: center.y + dx * sin + dy * cos,
            }
        })
        .collect()
}

fn degrees_cos(value: f64) -> f64 {
    value.to_radians().cos()
}
fn degrees_sin(value: f64) -> f64 {
    value.to_radians().sin()
}

pub(crate) fn shapes_for_family(family: &str) -> Result<Vec<Shape>, GeometryError> {
    let simple = |name, tile_type, points| Shape {
        name,
        tile_type,
        points,
    };
    Ok(match family {
        "einstein" => vec![simple("Einstein", "einstein-hat", hat_cartesian())],
        "spectre" => vec![simple("Spectre", "spectre", spectre_points())],
        "penrose-kite-dart" => vec![
            simple(
                "Dart",
                "dart",
                translate(
                    rotate(
                        vec![
                            point(0.0, 0.0),
                            point(0.3090169944, -0.9510565163),
                            point(0.8090169944, -0.5877852523),
                            point(1.0, 0.0),
                        ],
                        -18.0,
                    ),
                    -1.25,
                    0.6,
                ),
            ),
            simple(
                "Kite",
                "kite",
                translate(
                    vec![
                        point(0.0, 0.0),
                        point(0.1909830056, -0.5877852523),
                        point(0.0, -1.1755705046),
                        point(0.8090169944, -0.5877852523),
                    ],
                    0.25,
                    0.6,
                ),
            ),
        ],
        "penrose-rhombs" => vec![
            simple(
                "Thin rhomb",
                "thin-rhomb",
                translate(
                    vec![
                        point(0.0, 0.0),
                        point(degrees_cos(18.0), -degrees_sin(18.0)),
                        point(2.0 * degrees_cos(18.0), 0.0),
                        point(degrees_cos(18.0), degrees_sin(18.0)),
                    ],
                    -1.4,
                    0.0,
                ),
            ),
            simple(
                "Thick rhomb",
                "thick-rhomb",
                translate(
                    vec![
                        point(0.0, 0.0),
                        point(degrees_cos(54.0), degrees_sin(54.0)),
                        point(
                            degrees_cos(54.0) + degrees_cos(18.0),
                            degrees_sin(54.0) - degrees_sin(18.0),
                        ),
                        point(degrees_cos(18.0), -degrees_sin(18.0)),
                    ],
                    0.55,
                    0.0,
                ),
            ),
        ],
        "penrose-p1" => vec![
            simple(
                "Pentagon",
                "pentagon",
                translate(
                    vec![
                        point(0.0, 0.0),
                        point(degrees_cos(108.0), degrees_sin(108.0)),
                        point(
                            1.0 + degrees_cos(72.0) + degrees_cos(144.0),
                            degrees_sin(72.0) + degrees_sin(144.0),
                        ),
                        point(1.0 + degrees_cos(72.0), degrees_sin(72.0)),
                        point(1.0, 0.0),
                    ],
                    -1.9,
                    0.9,
                ),
            ),
            simple(
                "Star",
                "star",
                translate(
                    vec![
                        point(1.0, 0.0),
                        point(1.0 - degrees_cos(36.0), -degrees_sin(36.0)),
                        point(
                            1.0 - degrees_cos(36.0) - degrees_cos(108.0),
                            -degrees_sin(36.0) - degrees_sin(108.0),
                        ),
                        point(degrees_cos(108.0), -degrees_sin(108.0)),
                        point(
                            -1.0 + 3.0 * degrees_cos(108.0) + degrees_cos(36.0),
                            -degrees_sin(36.0) - degrees_sin(108.0),
                        ),
                        point(
                            -1.0 + 2.0 * degrees_cos(108.0) + degrees_cos(36.0),
                            -degrees_sin(36.0),
                        ),
                        point(-1.0 + 2.0 * degrees_cos(108.0), 0.0),
                        point(2.0 * degrees_cos(108.0), 0.0),
                        point(degrees_cos(108.0), degrees_sin(108.0)),
                        point(0.0, 0.0),
                    ],
                    1.4,
                    0.9,
                ),
            ),
            simple(
                "Boat",
                "boat",
                translate(
                    vec![
                        point(-1.0 + 2.0 * degrees_cos(108.0), 0.0),
                        point(2.0 * degrees_cos(108.0), 0.0),
                        point(degrees_cos(108.0), degrees_sin(108.0)),
                        point(0.0, 0.0),
                        point(1.0, 0.0),
                        point(1.0 - degrees_cos(36.0), -degrees_sin(36.0)),
                        point(
                            -1.0 + 2.0 * degrees_cos(108.0) + degrees_cos(36.0),
                            -degrees_sin(36.0),
                        ),
                    ],
                    -1.1,
                    -1.5,
                ),
            ),
            simple(
                "Diamond",
                "diamond",
                translate(
                    vec![
                        point(0.0, 0.0),
                        point(degrees_cos(18.0), degrees_sin(18.0)),
                        point(2.0 * degrees_cos(18.0), 0.0),
                        point(degrees_cos(18.0), -degrees_sin(18.0)),
                    ],
                    1.2,
                    -1.5,
                ),
            ),
        ],
        _ => {
            return Err(GeometryError::new(format!(
                "unknown Studio family: {family}"
            )))
        }
    })
}

fn cartesian_grid_lines(min: f64, max: f64, step: f64) -> Vec<[LatticePoint; 2]> {
    let mut lines = Vec::new();
    let count = ((max - min) / step).round() as usize;
    for index in 0..=count {
        let value = ((min + index as f64 * step) / step).round() * step;
        lines.push([
            cartesian_to_lattice(point(value, min)),
            cartesian_to_lattice(point(value, max)),
        ]);
        lines.push([
            cartesian_to_lattice(point(min, value)),
            cartesian_to_lattice(point(max, value)),
        ]);
    }
    lines
}

fn lattice_lines() -> Vec<[LatticePoint; 2]> {
    let (low, high) = (-7, 8);
    let mut lines = Vec::new();
    for index in low..=high {
        lines.push([
            LatticePoint {
                u: f64::from(index),
                v: f64::from(low),
            },
            LatticePoint {
                u: f64::from(index),
                v: f64::from(high),
            },
        ]);
        lines.push([
            LatticePoint {
                u: f64::from(low),
                v: f64::from(index),
            },
            LatticePoint {
                u: f64::from(high),
                v: f64::from(index),
            },
        ]);
        lines.push([
            LatticePoint {
                u: f64::from(low),
                v: f64::from(index - low),
            },
            LatticePoint {
                u: f64::from(high),
                v: f64::from(index - high),
            },
        ]);
    }
    lines
}

fn spectre_construction_lines() -> Vec<[LatticePoint; 2]> {
    #[derive(Clone)]
    struct Family {
        dx: f64,
        dy: f64,
        nx: f64,
        ny: f64,
        offsets: Vec<f64>,
    }
    let points = spectre_points();
    let mut families: BTreeMap<i64, Family> = BTreeMap::new();
    for (index, start) in points.iter().copied().enumerate() {
        let end = points[(index + 1) % points.len()];
        let mut dx = end.x - start.x;
        let mut dy = end.y - start.y;
        let length = dx.hypot(dy).max(f64::EPSILON);
        dx /= length;
        dy /= length;
        if dx < -1e-6 || (dx.abs() < 1e-6 && dy < 0.0) {
            dx *= -1.0;
            dy *= -1.0;
        }
        let nx = -dy;
        let ny = dx;
        let angle = dy.atan2(dx).to_degrees().round() as i64;
        let offset = nx * start.x + ny * start.y;
        let family = families.entry(angle).or_insert(Family {
            dx,
            dy,
            nx,
            ny,
            offsets: Vec::new(),
        });
        if !family
            .offsets
            .iter()
            .any(|candidate| (candidate - offset).abs() < 1e-6)
        {
            family.offsets.push(offset);
        }
    }
    families
        .values()
        .flat_map(|family| {
            family.offsets.iter().map(|offset| {
                let center = point(family.nx * offset, family.ny * offset);
                [
                    cartesian_to_lattice(point(
                        center.x - family.dx * 12.0,
                        center.y - family.dy * 12.0,
                    )),
                    cartesian_to_lattice(point(
                        center.x + family.dx * 12.0,
                        center.y + family.dy * 12.0,
                    )),
                ]
            })
        })
        .collect()
}

fn snap_to_spectre_construction(target: LatticePoint, step: f64) -> LatticePoint {
    if step == 0.0 {
        return target;
    }
    let target = lattice_to_cartesian(target);
    let points = spectre_points();
    let mut nearest = (Point { x: 0.0, y: 0.0 }, f64::INFINITY);
    for (index, start) in points.iter().copied().enumerate() {
        let end = points[(index + 1) % points.len()];
        let dx = end.x - start.x;
        let dy = end.y - start.y;
        let length = dx.hypot(dy).max(f64::EPSILON);
        let ux = dx / length;
        let uy = dy / length;
        let along = (target.x - start.x) * ux + (target.y - start.y) * uy;
        let snapped_along = (along / step).round() * step;
        let candidate = point(start.x + ux * snapped_along, start.y + uy * snapped_along);
        let distance = (candidate.x - target.x).hypot(candidate.y - target.y);
        if distance < nearest.1 {
            nearest = (candidate, distance);
        }
    }
    cartesian_to_lattice(nearest.0)
}

fn shape_values(shapes: &[Shape]) -> Vec<Value> {
    shapes.iter().map(|shape| json!({"name": shape.name, "tileType": shape.tile_type, "points": shape.points})).collect()
}

pub fn geometry_adapter(family: &str) -> Result<Value, GeometryError> {
    let shapes = shapes_for_family(family)?;
    let points = shapes[0].points.clone();
    let all_points = shapes
        .iter()
        .flat_map(|shape| shape.points.iter().copied())
        .collect::<Vec<_>>();
    let grid = cartesian_grid_lines(-10.0, 10.0, CARTESIAN_GRID_STEP);
    let mut adapter = match family {
        "einstein" => json!({
            "family":"einstein","tile":"einstein-hat","label":"Einstein","points":points,"allPoints":all_points,
            "gridLines":lattice_lines(),"cartesianGridLines":grid,"outlineD":null,
            "previewTransforms":[
                [0.25,0.4330127019,1.375,-0.4330127019,0.25,-2.3815698598],
                [0.25,0.4330127019,2.875,-0.4330127019,0.25,0.2165063516],
                [-0.5,0.0,1.375,0.0,-0.5,-0.6495190522],
                [-0.5,0.0,2.875,0.0,0.5,-1.5155444562]
            ]
        }),
        "spectre" => json!({
            "family":"spectre","tile":"spectre","label":"Spectre","points":points,"allPoints":all_points,
            "centerCanvas":true,"gridLines":spectre_construction_lines(),"cartesianGridLines":grid,
            "previewTransforms":[[1.0,0.0,0.0,0.0,1.0,0.0],[ROOT,-0.5,-0.5-ROOT,0.5,ROOT,ROOT-0.5],[0.0,-1.0,2.5+3.0*ROOT,1.0,0.0,0.5+ROOT],[ROOT,0.5,1.0,-0.5,ROOT,-1.0]],
            "previewReflectX":true,"previewRotation":150.0,"previewStroke":"#050806",
            "spectreSegments":points.iter().copied().enumerate().map(|(index,start)| { let end=points[(index+1)%points.len()]; json!({"start":start,"control":spectre_edge_control(start,end,index,0.18,1.0,0.5),"end":end,"index":index}) }).collect::<Vec<_>>()
        }),
        "penrose-kite-dart" | "penrose-rhombs" | "penrose-p1" => {
            let (label, tile_mode) = match family {
                "penrose-kite-dart" => ("Penrose P2 · Kite & Dart", "kite-dart"),
                "penrose-rhombs" => ("Penrose P3 · Rhombs", "rhombs"),
                _ => ("Penrose P1 · Stars", "p1"),
            };
            json!({
                "family":family,"tile":"penrose","tileMode":tile_mode,"label":label,"points":points,
                "allPoints":all_points,"shapes":shape_values(&shapes),"editorShapes":shape_values(&shapes),
                "centerCanvas":true,"cartesianGridLines":grid,"defaultGridMode":"cartesian",
                "previewTransforms":[[1.0,0.0,0.0,0.0,1.0,0.0]],"previewStroke":"#050806","outlineD":null
            })
        }
        _ => unreachable!(),
    };
    adapter["nativeStudioApiVersion"] = json!(1);
    Ok(adapter)
}

fn required<T: for<'de> Deserialize<'de>>(value: &Value, key: &str) -> Result<T, GeometryError> {
    serde_json::from_value(
        value
            .get(key)
            .cloned()
            .ok_or_else(|| GeometryError::new(format!("missing {key}")))?,
    )
    .map_err(|error| GeometryError::new(format!("invalid {key}: {error}")))
}

pub fn call(operation: &str, input: &Value) -> Result<Value, GeometryError> {
    match operation {
        "geometryAdapter" => geometry_adapter(required::<String>(input, "family")?.as_str()),
        "latticeToCartesian" => {
            Ok(serde_json::to_value(lattice_to_cartesian(required(input, "point")?)).unwrap())
        }
        "cartesianToLattice" => {
            Ok(serde_json::to_value(cartesian_to_lattice(required(input, "point")?)).unwrap())
        }
        "snapLatticePoint" => Ok(serde_json::to_value(snap_lattice_point(
            required(input, "point")?,
            required(input, "step")?,
        ))
        .unwrap()),
        "snapCartesianPoint" => Ok(serde_json::to_value(snap_cartesian_point(
            required(input, "point")?,
            required(input, "step")?,
        ))
        .unwrap()),
        "cartesianGridLines" => Ok(json!(cartesian_grid_lines(
            input.get("min").and_then(Value::as_f64).unwrap_or(-10.0),
            input.get("max").and_then(Value::as_f64).unwrap_or(10.0),
            input
                .get("step")
                .and_then(Value::as_f64)
                .unwrap_or(CARTESIAN_GRID_STEP),
        ))),
        "nearestBoundary" => nearest_boundary(
            &required::<String>(input, "family")?,
            required(input, "point")?,
            input.get("tileType").and_then(Value::as_str),
        ),
        "bindPathEndpoints" => bind_path_endpoints(input.get("path").unwrap_or(input)),
        "penroseEditorGeometry" => penrose_editor_geometry(
            &required::<String>(input, "family")?,
            input
                .get("tileType")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        ),
        "penroseNearestBoundary" => penrose_nearest_boundary(
            &required::<String>(input, "family")?,
            input
                .get("tileType")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            required(input, "point")?,
        ),
        "snapPenroseCartesian" => snap_penrose_cartesian(
            &required::<String>(input, "family")?,
            input
                .get("tileType")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            required(input, "point")?,
            required(input, "step")?,
        ),
        "snapSpectreConstruction" => Ok(json!(snap_to_spectre_construction(
            required(input, "point")?,
            required(input, "step")?
        ))),
        "snapCircleHandle" => Ok(snap_circle_handle(
            required(input, "center")?,
            required(input, "handle")?,
            required(input, "latticeStep")?,
            required(input, "angleStep")?,
        )),
        "circleHandlePoint" => Ok(serde_json::to_value(circle_handle_point(
            required(input, "center")?,
            required(input, "radius")?,
            required(input, "handleAngle")?,
        ))
        .unwrap()),
        "circularPathGeometry" => Ok(circular_path_geometry(
            required(input, "points")?,
            input.get("side").and_then(Value::as_str).unwrap_or("left"),
            input
                .get("stepsPerTurn")
                .and_then(Value::as_u64)
                .unwrap_or(72) as usize,
        )),
        "spectreEdgeControl" => Ok(serde_json::to_value(spectre_edge_control(
            required(input, "start")?,
            required(input, "end")?,
            required(input, "index")?,
            required(input, "roundness")?,
            required(input, "lean")?,
            required(input, "weight")?,
        ))
        .unwrap()),
        "spectrePath" => Ok(json!(spectre_path(
            &required::<Vec<Point>>(input, "points")?,
            required(input, "roundness")?,
            required(input, "lean")?,
            required(input, "weight")?
        ))),
        "spectreSegments" => Ok(spectre_segments(
            &required::<Vec<Point>>(input, "points")?,
            required(input, "roundness")?,
            required(input, "lean")?,
            required(input, "weight")?,
        )),
        _ => Err(GeometryError::new(format!(
            "unknown Studio operation: {operation}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(left: f64, right: f64) {
        assert!((left - right).abs() < 1e-9, "{left} != {right}");
    }

    #[test]
    fn lattice_coordinates_round_trip() {
        let source = LatticePoint { u: 1.25, v: -0.75 };
        let result = cartesian_to_lattice(lattice_to_cartesian(source));
        close(result.u, source.u);
        close(result.v, source.v);
    }

    #[test]
    fn all_family_descriptors_are_native_and_complete() {
        for (family, count) in [
            ("einstein", 1),
            ("spectre", 1),
            ("penrose-kite-dart", 2),
            ("penrose-rhombs", 2),
            ("penrose-p1", 4),
        ] {
            let adapter = geometry_adapter(family).unwrap();
            assert_eq!(adapter["nativeStudioApiVersion"], 1);
            if family.starts_with("penrose") {
                assert_eq!(adapter["shapes"].as_array().unwrap().len(), count);
            }
        }
    }

    #[test]
    fn spectre_curve_closes() {
        let path = spectre_path(&spectre_points(), 0.2, 1.0, 0.5);
        assert!(path.starts_with("M 0.0000 0.0000 Q "));
        assert!(path.ends_with(" Z"));
    }
}
