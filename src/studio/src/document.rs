use std::collections::{HashMap, HashSet};

use serde_json::{json, Value};

const KINDS: [(&str, &str); 5] = [
    ("polygon", "polygons"),
    ("path", "paths"),
    ("line", "lines"),
    ("circle", "circles"),
    ("circularPath", "circularPaths"),
];

fn fail(message: &str) -> Result<Value, String> {
    Err(message.to_owned())
}

fn array<'a>(design: &'a Value, key: &str) -> &'a [Value] {
    design
        .get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn non_empty_string(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty())
}

fn finite_number(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(value) => value.as_f64().filter(|value| value.is_finite()),
        Value::String(value) => value.parse::<f64>().ok().filter(|value| value.is_finite()),
        _ => None,
    }
}

fn point_is_finite(value: &Value) -> bool {
    finite_number(value.get("u")).is_some() && finite_number(value.get("v")).is_some()
}

pub fn normalize_layer_order(design: &Value) -> Value {
    let available = KINDS
        .into_iter()
        .flat_map(|(kind, collection)| {
            array(design, collection).iter().filter_map(move |item| {
                item.get("id")
                    .and_then(Value::as_str)
                    .map(|id| (kind.to_owned(), id.to_owned()))
            })
        })
        .collect::<HashSet<_>>();
    let mut seen = HashSet::new();
    let mut order = Vec::new();
    for entry in array(design, "layerOrder") {
        let Some(kind) = entry.get("kind").and_then(Value::as_str) else {
            continue;
        };
        let Some(id) = entry.get("id").and_then(Value::as_str) else {
            continue;
        };
        let key = (kind.to_owned(), id.to_owned());
        if available.contains(&key) && seen.insert(key) {
            order.push(json!({"kind": kind, "id": id}));
        }
    }
    for (kind, collection) in KINDS {
        for item in array(design, collection) {
            let Some(id) = item.get("id").and_then(Value::as_str) else {
                continue;
            };
            if seen.insert((kind.to_owned(), id.to_owned())) {
                order.push(json!({"kind": kind, "id": id}));
            }
        }
    }
    Value::Array(order)
}

pub fn design_layers(design: &Value) -> Value {
    let collections = KINDS
        .into_iter()
        .map(|(kind, collection)| {
            let items = array(design, collection)
                .iter()
                .filter_map(|item| Some((item.get("id")?.as_str()?.to_owned(), item.clone())))
                .collect::<HashMap<_, _>>();
            (kind, items)
        })
        .collect::<HashMap<_, _>>();
    Value::Array(
        normalize_layer_order(design)
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|entry| {
                let kind = entry.get("kind")?.as_str()?;
                let id = entry.get("id")?.as_str()?;
                Some(json!({"kind": kind, "id": id, "item": collections.get(kind)?.get(id)?}))
            })
            .collect(),
    )
}

pub fn create_empty_design(tile: &str) -> Value {
    let (suffix, label) = match tile {
        "spectre" => ("spectre", "Spectre"),
        "penrose" => ("penrose", "Penrose"),
        _ => ("einstein", "Einstein"),
    };
    let mut design = json!({
        "schema":"aperiodos.material-design","version":1,
        "id":format!("builtin-empty-{suffix}-pattern"),"name":format!("Untitled {label} pattern"),
        "tile":tile,"colors":{"base":"#ffffff","ink":"#00c200"},"outline":"#17313b",
        "strokeWidth":if tile == "spectre" { 1 } else { 2 },
        "polygons":[],"paths":[],"lines":[],"circles":[],"circularPaths":[],"layerOrder":[]
    });
    if tile == "spectre" {
        design["tileShape"] = json!({"roundness":0.18,"weight":0.5,"lean":1});
    }
    design
}

pub fn element_material_color(design: &Value, element: &Value) -> Value {
    if non_empty_string(element.get("color")) {
        element["color"].clone()
    } else {
        design["colors"]["ink"].clone()
    }
}

/// Resolve a tile fill from the canonical Studio document. Penrose designs may
/// override the document base color for each prototile while older designs keep
/// using `colors.base` unchanged.
pub fn tile_base_color<'a>(design: &'a Value, tile_type: Option<&str>) -> &'a str {
    tile_type
        .and_then(|tile_type| design.get("tileColors")?.get(tile_type)?.as_str())
        .or_else(|| {
            tile_type
                .filter(|tile_type| tile_type.starts_with("pentagon-"))
                .and_then(|_| design.get("tileColors")?.get("pentagon")?.as_str())
        })
        .or_else(|| design.pointer("/colors/base").and_then(Value::as_str))
        .unwrap_or("#ffffff")
}

pub fn set_tile_base_color(design: &Value, tile_type: &str, color: &str) -> Value {
    let mut output = design.clone();
    if design.get("tile").and_then(Value::as_str) != Some("penrose")
        || tile_type.trim().is_empty()
        || color.trim().is_empty()
    {
        return output;
    }
    if !output.get("tileColors").is_some_and(Value::is_object) {
        output["tileColors"] = json!({});
    }
    output["tileColors"][tile_type] = json!(color);
    output
}

pub fn common_tile_base_color<'a>(design: &'a Value, tile_types: &[Value]) -> Option<&'a str> {
    let mut colors = tile_types
        .iter()
        .filter_map(Value::as_str)
        .map(|tile_type| tile_base_color(design, Some(tile_type)));
    let first = colors.next()?;
    colors.all(|color| color == first).then_some(first)
}

pub fn set_tile_base_colors(design: &Value, tile_types: &[Value], color: &str) -> Value {
    tile_types
        .iter()
        .filter_map(Value::as_str)
        .fold(design.clone(), |output, tile_type| {
            set_tile_base_color(&output, tile_type, color)
        })
}

pub fn set_default_material_color(design: &Value, color: &str) -> Value {
    let mut output = design.clone();
    for (_, collection) in KINDS {
        let items = array(design, collection)
            .iter()
            .map(|item| {
                let mut item = item.clone();
                item["color"] = element_material_color(design, &item);
                item
            })
            .collect();
        output[collection] = Value::Array(items);
    }
    output["colors"]["ink"] = json!(color);
    output
}

fn validate_scope(item: &Value) -> Result<(), String> {
    if item.get("tileType").is_some() && !non_empty_string(item.get("tileType")) {
        Err("Tile-specific material must name a target tile type.".to_owned())
    } else {
        Ok(())
    }
}

fn validate_color(item: &Value, message: &str) -> Result<(), String> {
    if item.get("color").is_some() && !non_empty_string(item.get("color")) {
        Err(message.to_owned())
    } else {
        Ok(())
    }
}

pub fn validate_design(input: &Value) -> Result<Value, String> {
    if !input.is_object()
        || input.get("schema").and_then(Value::as_str) != Some("aperiodos.material-design")
        || input.get("version").and_then(Value::as_u64) != Some(1)
    {
        return fail("This is not a supported Aperiodos material design.");
    }
    let tile = input
        .get("tile")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let p1_rhomb_overlay = tile == "penrose"
        && input.get("tileMode").and_then(Value::as_str) == Some("p1")
        && input
            .get("penroseOverlay")
            .and_then(|overlay| overlay.get("enabled"))
            .and_then(Value::as_bool)
            == Some(true);
    if !["einstein-hat", "spectre", "penrose"].contains(&tile)
        || !input.get("paths").is_some_and(Value::is_array)
        || (!p1_rhomb_overlay
            && KINDS
                .into_iter()
                .all(|(_, collection)| array(input, collection).is_empty()))
    {
        return fail("The design must contain supported tile material geometry.");
    }
    if tile == "spectre" {
        let shape = input.get("tileShape").unwrap_or(&Value::Null);
        if ["roundness", "weight", "lean"]
            .into_iter()
            .any(|key| finite_number(shape.get(key)).is_none())
        {
            return fail("Spectre designs need finite tile curvature settings.");
        }
    }
    if tile == "penrose" && input.get("tileMode").is_some() {
        let mode = input
            .get("tileMode")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if !["kite-dart", "rhombs", "p1"].contains(&mode) {
            return fail("Penrose designs need a supported tile combination.");
        }
    }
    if let Some(overlay) = input.get("penroseOverlay") {
        if tile != "penrose"
            || input.get("tileMode").and_then(Value::as_str) != Some("p1")
            || !overlay.is_object()
            || overlay.get("type").and_then(Value::as_str) != Some("rhombs")
        {
            return fail("Penrose overlays must be a P1 rhomb overlay.");
        }
        for key in ["thinColor", "thickColor", "edgeColor"] {
            if !non_empty_string(overlay.get(key)) {
                return fail("Penrose overlay colors must be non-empty color values.");
            }
        }
        for key in ["edgeWidth", "scale", "rotation", "offsetX", "offsetY"] {
            if finite_number(overlay.get(key)).is_none() {
                return fail("Penrose overlay geometry must use finite numeric values.");
            }
        }
        if finite_number(overlay.get("edgeWidth"))
            .is_none_or(|value| !(0.0..=20.0).contains(&value))
            || finite_number(overlay.get("scale"))
                .is_none_or(|value| !(0.125..=8.0).contains(&value))
        {
            return fail("Penrose overlay width or scale is outside its supported range.");
        }
    }
    if let Some(tile_colors) = input.get("tileColors") {
        let Some(tile_colors) = tile_colors.as_object() else {
            return fail("Penrose tile colors must be an object keyed by tile type.");
        };
        if tile != "penrose"
            || tile_colors.iter().any(|(tile_type, color)| {
                tile_type.trim().is_empty() || !non_empty_string(Some(color))
            })
        {
            return fail("Every Penrose tile color needs a tile type and a non-empty color value.");
        }
    }
    if let Some(width) = input.get("strokeWidth") {
        let Some(width) = finite_number(Some(width)) else {
            return fail("Pattern stroke width must be between 0 and 20.");
        };
        if !(0.0..=20.0).contains(&width) {
            return fail("Pattern stroke width must be between 0 and 20.");
        }
    }
    if input.get("outline").is_some() && !non_empty_string(input.get("outline")) {
        return fail("Pattern outline colors must be non-empty color values.");
    }

    for polygon in array(input, "polygons") {
        let points = array(polygon, "points");
        if points.len() < 3 {
            return fail("Every polygon must contain at least three points.");
        }
        if points.iter().any(|point| !point_is_finite(point)) {
            return fail("Polygon points must use finite lattice coordinates.");
        }
        validate_color(polygon, "Polygon colors must be non-empty color values.")?;
        if polygon.get("strokeColor").is_some() && !non_empty_string(polygon.get("strokeColor")) {
            return fail("Polygon outline colors must be non-empty color values.");
        }
        if polygon.get("width").is_some()
            && finite_number(polygon.get("width")).is_none_or(|width| width < 0.0)
        {
            return fail("Polygon outline widths must be zero or positive.");
        }
        validate_scope(polygon)?;
    }

    for path in array(input, "paths") {
        let points = array(path, "points");
        if points.len() < 4 || !(points.len() - 1).is_multiple_of(3) {
            return fail("Every path must contain complete cubic Bézier segments.");
        }
        if finite_number(path.get("width")).is_none_or(|width| width <= 0.0) {
            return fail("Every path needs a positive width.");
        }
        if points.iter().any(|point| !point_is_finite(point)) {
            return fail("Path points must use finite lattice coordinates.");
        }
        validate_color(path, "Path colors must be non-empty color values.")?;
        validate_scope(path)?;
    }
    for line in array(input, "lines") {
        let points = array(line, "points");
        if points.len() != 2 {
            return fail("Every line must contain exactly two endpoints.");
        }
        if finite_number(line.get("width")).is_none_or(|width| width <= 0.0) {
            return fail("Every line needs a positive width.");
        }
        if points.iter().any(|point| !point_is_finite(point)) {
            return fail("Line endpoints must use finite lattice coordinates.");
        }
        validate_color(line, "Line colors must be non-empty color values.")?;
        validate_scope(line)?;
    }
    for circle in array(input, "circles") {
        if !circle.get("center").is_some_and(point_is_finite) {
            return fail("Circle centers must use finite lattice coordinates.");
        }
        if finite_number(circle.get("radius")).is_none_or(|radius| radius <= 0.0) {
            return fail("Every circle needs a positive radius.");
        }
        if circle.get("hollow").is_some() && circle.get("hollow").and_then(Value::as_bool).is_none()
        {
            return fail("Circle hollow values must be boolean.");
        }
        if let Some(width) = circle.get("width") {
            let radius = finite_number(circle.get("radius")).unwrap();
            if finite_number(Some(width)).is_none_or(|width| width <= 0.0 || width > radius) {
                return fail(
                    "Circle stroke widths must be positive and no greater than the radius.",
                );
            }
        } else if circle.get("hollow").and_then(Value::as_bool) == Some(true) {
            return fail("Hollow circles need a stroke width.");
        }
        if !matches!(
            circle.get("operation").and_then(Value::as_str),
            Some("ink" | "base")
        ) {
            return fail("Circle operations must use the curve or tile color.");
        }
        if circle.get("handleAngle").is_some() && finite_number(circle.get("handleAngle")).is_none()
        {
            return fail("Circle handle angles must be finite degrees.");
        }
        validate_color(circle, "Circle colors must be non-empty color values.")?;
        validate_scope(circle)?;
    }
    for path in array(input, "circularPaths") {
        let points = array(path, "points");
        if points.len() != 3 {
            return fail("Every circular path must contain exactly three ordered points.");
        }
        if finite_number(path.get("width")).is_none_or(|width| width <= 0.0) {
            return fail("Every circular path needs a positive width.");
        }
        if !matches!(
            path.get("side").and_then(Value::as_str),
            Some("left" | "right")
        ) {
            return fail("Circular paths must use the left or right arc side.");
        }
        if points.iter().any(|point| !point_is_finite(point)) {
            return fail("Circular path points must use finite lattice coordinates.");
        }
        validate_color(path, "Circular path colors must be non-empty color values.")?;
        validate_scope(path)?;
    }

    let mut output = input.clone();
    let object = output.as_object_mut().expect("validated object");
    for (_, collection) in KINDS {
        object
            .entry(collection)
            .or_insert_with(|| Value::Array(Vec::new()));
    }
    object.insert(
        "strokeWidth".to_owned(),
        json!(
            finite_number(input.get("strokeWidth")).unwrap_or(if tile == "spectre" {
                1.0
            } else {
                2.0
            })
        ),
    );
    object.insert("layerOrder".to_owned(), normalize_layer_order(input));
    Ok(output)
}

pub fn insert_circular_path_template(
    design: &Value,
    id: &str,
    name: Option<&str>,
) -> Result<Value, String> {
    if design.get("tile").and_then(Value::as_str) != Some("einstein-hat") {
        return fail("The Einstein circular-path template needs an Einstein design.");
    }
    let duplicate = id.is_empty()
        || design_layers(design)
            .as_array()
            .unwrap()
            .iter()
            .any(|layer| layer.get("id").and_then(Value::as_str) == Some(id));
    if duplicate {
        return fail("A template element needs a unique identifier.");
    }
    let item = json!({"id":id,"name":name.unwrap_or("Circular path"),"width":1.3,"side":"left","points":[{"u":4,"v":-2},{"u":0,"v":0},{"u":-2,"v":4}]});
    let mut output = design.clone();
    let mut items = array(design, "circularPaths").to_vec();
    items.push(item);
    output["circularPaths"] = Value::Array(items);
    let mut order = normalize_layer_order(design).as_array().unwrap().clone();
    order.push(json!({"kind":"circularPath","id":id}));
    output["layerOrder"] = Value::Array(order);
    Ok(output)
}

const HEX_LINES: [[[f64; 2]; 2]; 7] = [
    [
        [2.7320508075688767, 2.0],
        [3.1547005383792515, 0.4226497308103742],
    ],
    [
        [2.220446049250313e-16, 2.732050807568877],
        [1.1547005383792515, 3.1547005383792515],
    ],
    [
        [0.350480947161671, 1.299038105676658],
        [2.220446049250313e-16, 2.732050807568877],
    ],
    [[0.350480947161671, 1.299038105676658], [2.0, 0.0]],
    [[0.350480947161671, 1.299038105676658], [0.0, 0.0]],
    [[-0.41885662013573544, 1.5877132402714709], [0.0, 0.0]],
    [
        [0.003793110674638722, 2.7424137786507226],
        [-0.41885662013573544, 1.5877132402714709],
    ],
];

pub fn insert_hexagonalization_template(
    design: &Value,
    prefix: &str,
    name: Option<&str>,
) -> Result<Value, String> {
    if design.get("tile").and_then(Value::as_str) != Some("spectre") {
        return fail("The Hexagonalization template needs a Spectre design.");
    }
    if prefix.is_empty() {
        return fail("A template needs a unique identifier prefix.");
    }
    let lines = HEX_LINES.into_iter().enumerate().map(|(index, points)| json!({
        "id":format!("{prefix}-{}",index+1),"name":format!("{} {}",name.unwrap_or("Hexagonalization"),index+1),"width":0.2,
        "points":points.map(|[u,v]| json!({"u":u,"v":v}))
    })).collect::<Vec<_>>();
    let existing = design_layers(design)
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|layer| layer.get("id").and_then(Value::as_str).map(str::to_owned))
        .collect::<HashSet<_>>();
    if lines
        .iter()
        .any(|line| existing.contains(line["id"].as_str().unwrap()))
    {
        return fail("A template element needs a unique identifier.");
    }
    let mut output = design.clone();
    let mut all_lines = array(design, "lines").to_vec();
    all_lines.extend(lines.clone());
    output["lines"] = Value::Array(all_lines);
    let mut order = normalize_layer_order(design).as_array().unwrap().clone();
    order.extend(
        lines
            .iter()
            .map(|line| json!({"kind":"line","id":line["id"]})),
    );
    output["layerOrder"] = Value::Array(order);
    Ok(output)
}

pub fn call(operation: &str, input: &Value) -> Option<Result<Value, String>> {
    let result = match operation {
        "createEmptyDesign" => Ok(create_empty_design(
            input
                .get("tile")
                .and_then(Value::as_str)
                .unwrap_or("einstein-hat"),
        )),
        "normalizeLayerOrder" => Ok(normalize_layer_order(input.get("design").unwrap_or(input))),
        "getDesignLayers" => Ok(design_layers(input.get("design").unwrap_or(input))),
        "elementMaterialColor" => Ok(element_material_color(
            input.get("design").unwrap_or(&Value::Null),
            input.get("element").unwrap_or(&Value::Null),
        )),
        "setDefaultMaterialColor" => Ok(set_default_material_color(
            input.get("design").unwrap_or(&Value::Null),
            input
                .get("color")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )),
        "tileBaseColor" => Ok(json!(tile_base_color(
            input.get("design").unwrap_or(&Value::Null),
            input.get("tileType").and_then(Value::as_str),
        ))),
        "setTileBaseColor" => Ok(set_tile_base_color(
            input.get("design").unwrap_or(&Value::Null),
            input
                .get("tileType")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            input
                .get("color")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )),
        "commonTileBaseColor" => Ok(common_tile_base_color(
            input.get("design").unwrap_or(&Value::Null),
            input
                .get("tileTypes")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
        )
        .map_or(Value::Null, |color| json!(color))),
        "setTileBaseColors" => Ok(set_tile_base_colors(
            input.get("design").unwrap_or(&Value::Null),
            input
                .get("tileTypes")
                .and_then(Value::as_array)
                .map(Vec::as_slice)
                .unwrap_or(&[]),
            input
                .get("color")
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )),
        "validateDesign" => validate_design(input.get("design").unwrap_or(input)),
        "insertCircularPathTemplate" => insert_circular_path_template(
            input.get("design").unwrap_or(&Value::Null),
            input.get("id").and_then(Value::as_str).unwrap_or_default(),
            input.get("name").and_then(Value::as_str),
        ),
        "insertHexagonalizationTemplate" => insert_hexagonalization_template(
            input.get("design").unwrap_or(&Value::Null),
            input
                .get("idPrefix")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            input.get("name").and_then(Value::as_str),
        ),
        _ => return None,
    };
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layer_order_is_normalized_without_losing_layers() {
        let design = json!({"paths":[{"id":"p"}],"lines":[{"id":"l"}],"layerOrder":[{"kind":"line","id":"l"},{"kind":"line","id":"l"}]});
        assert_eq!(
            normalize_layer_order(&design),
            json!([{"kind":"line","id":"l"},{"kind":"path","id":"p"}])
        );
    }

    #[test]
    fn all_three_families_have_native_empty_documents() {
        for tile in ["einstein-hat", "spectre", "penrose"] {
            let design = create_empty_design(tile);
            assert_eq!(design["tile"], tile);
            assert_eq!(design["schema"], "aperiodos.material-design");
        }
    }

    #[test]
    fn penrose_prototile_colors_are_independent_and_backward_compatible() {
        let design = json!({
            "tile":"penrose",
            "colors":{"base":"#ffffff","ink":"#000000"},
            "tileColors":{"dart":"#aa0000","kite":"#00aa00"}
        });
        assert_eq!(tile_base_color(&design, Some("dart")), "#aa0000");
        assert_eq!(tile_base_color(&design, Some("kite")), "#00aa00");
        assert_eq!(tile_base_color(&design, Some("star")), "#ffffff");

        let updated = set_tile_base_color(&design, "dart", "#0000aa");
        assert_eq!(tile_base_color(&updated, Some("dart")), "#0000aa");
        assert_eq!(tile_base_color(&updated, Some("kite")), "#00aa00");
        assert_eq!(
            common_tile_base_color(&updated, &json!(["dart", "kite"]).as_array().unwrap()),
            None
        );
        let unified = set_tile_base_colors(
            &updated,
            json!(["dart", "kite"]).as_array().unwrap(),
            "#123456",
        );
        assert_eq!(
            common_tile_base_color(&unified, json!(["dart", "kite"]).as_array().unwrap()),
            Some("#123456")
        );
    }

    #[test]
    fn enabled_p1_rhomb_overlay_is_valid_without_tile_local_elements() {
        let mut design = create_empty_design("penrose");
        design["tileMode"] = json!("p1");
        design["penroseOverlay"] = json!({
            "enabled": true,
            "type": "rhombs",
            "thinColor": "#204a87",
            "thickColor": "#555753",
            "edgeColor": "#edd400",
            "edgeWidth": 1,
            "scale": 5.0_f64.sqrt(),
            "rotation": 0,
            "offsetX": 0,
            "offsetY": 0
        });
        assert!(validate_design(&design).is_ok());
    }
}
