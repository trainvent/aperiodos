use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
struct GoldenCase {
    name: String,
    operation: String,
    input: Value,
    output: Value,
}

#[test]
fn authoring_operations_match_the_established_browser_goldens() {
    let cases: Vec<GoldenCase> = serde_json::from_str(include_str!("goldens/geometry.json"))
        .expect("Studio geometry golden fixture must be valid JSON");
    for case in cases {
        let actual = aperiodos_studio::call(&case.operation, &case.input)
            .unwrap_or_else(|error| panic!("golden case {:?} failed: {error}", case.name));
        assert_eq!(actual, case.output, "Studio golden drifted: {}", case.name);
    }
}
