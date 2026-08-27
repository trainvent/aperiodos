use std::fmt::Write as _;

use serde_json::Value;

use crate::{escape_xml, Vec2};

#[derive(Clone, Debug)]
pub struct Polygon {
    pub points: Vec<Vec2>,
    pub fill: String,
    pub stroke: String,
    pub stroke_width: f64,
    pub extra_attributes: String,
}

impl Polygon {
    pub fn new(
        points: Vec<Vec2>,
        fill: impl Into<String>,
        stroke: impl Into<String>,
        stroke_width: f64,
    ) -> Self {
        Self {
            points,
            fill: fill.into(),
            stroke: stroke.into(),
            stroke_width,
            extra_attributes: "stroke-linejoin=\"round\"".to_owned(),
        }
    }
}

#[derive(Clone, Debug)]
pub enum SvgElement {
    Polygon(Polygon),
    Raw(String),
}

#[derive(Clone, Debug)]
pub struct Scene {
    pub width: u32,
    pub height: u32,
    pub background: String,
    pub generator: String,
    pub configuration: Value,
    pub definitions: Vec<String>,
    pub elements: Vec<SvgElement>,
}

impl Scene {
    pub fn new(
        width: u32,
        height: u32,
        background: impl Into<String>,
        generator: impl Into<String>,
        configuration: Value,
    ) -> Self {
        Self {
            width,
            height,
            background: background.into(),
            generator: generator.into(),
            configuration,
            definitions: Vec::new(),
            elements: Vec::new(),
        }
    }

    pub fn push_polygon(&mut self, polygon: Polygon) {
        self.elements.push(SvgElement::Polygon(polygon));
    }

    pub fn push_raw(&mut self, svg: impl Into<String>) {
        self.elements.push(SvgElement::Raw(svg.into()));
    }

    pub fn to_svg(&self) -> String {
        let mut document = String::new();
        let _ = writeln!(
            document,
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {} {}\" width=\"{}\" height=\"{}\">",
            self.width, self.height, self.width, self.height
        );
        let metadata = serde_json::json!({
            "schema": "aperiodos.render",
            "version": 1,
            "generator": self.generator,
            "configuration": self.configuration,
        });
        let _ = writeln!(
            document,
            "<metadata id=\"aperiodos-render\">{}</metadata>",
            escape_xml(&metadata.to_string())
        );
        if !self.definitions.is_empty() {
            document.push_str("<defs>");
            for definition in &self.definitions {
                document.push_str(definition);
            }
            document.push_str("</defs>\n");
        }
        let _ = writeln!(
            document,
            "<rect width=\"100%\" height=\"100%\" fill=\"{}\" />",
            escape_xml(&self.background)
        );
        for element in &self.elements {
            match element {
                SvgElement::Polygon(polygon) => {
                    let points = polygon
                        .points
                        .iter()
                        .map(|point| format!("{:.2},{:.2}", point.x, point.y))
                        .collect::<Vec<_>>()
                        .join(" ");
                    let _ = writeln!(
                        document,
                        "<polygon points=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\" {} />",
                        points,
                        escape_xml(&polygon.fill),
                        escape_xml(&polygon.stroke),
                        polygon.stroke_width,
                        polygon.extra_attributes,
                    );
                }
                SvgElement::Raw(svg) => {
                    document.push_str(svg);
                    if !svg.ends_with('\n') {
                        document.push('\n');
                    }
                }
            }
        }
        document.push_str("</svg>\n");
        document
    }
}

pub trait Renderer {
    type Config;

    fn scene(&self, config: &Self::Config) -> Result<Scene, String>;

    fn render_svg(&self, config: &Self::Config) -> Result<String, String> {
        self.scene(config).map(|scene| scene.to_svg())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_serializes_reproducible_metadata_and_escaped_svg() {
        let mut scene = Scene::new(10, 20, "<&", "test", serde_json::json!({"seed": 42}));
        scene.push_polygon(Polygon::new(vec![Vec2::new(0.0, 1.0)], "red", "none", 0.0));
        let svg = scene.to_svg();
        assert!(svg.contains("id=\"aperiodos-render\""));
        assert!(svg.contains("&quot;seed&quot;:42"));
        assert!(svg.contains("fill=\"&lt;&amp;\""));
    }
}
