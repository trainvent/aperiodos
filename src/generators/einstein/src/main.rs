use std::env;
use std::path::PathBuf;

use einstein::{write_svg, ColorMode, EinsteinSvgConfig, MaterialMode};

fn main() {
    let (output, config) = parse_args(env::args().skip(1));
    if let Err(error) = write_svg(&output, &config) {
        eprintln!("failed to write {}: {error}", output.display());
        std::process::exit(1);
    }
    println!("{}", output.display());
}

fn parse_args(args: impl Iterator<Item = String>) -> (PathBuf, EinsteinSvgConfig) {
    let mut config = EinsteinSvgConfig::default();
    let mut output = PathBuf::from("output/einstein.svg");
    let mut args = args;

    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--output" => output = PathBuf::from(next_arg(&mut args, &flag)),
            "--width" => config.width = parse_value(next_arg(&mut args, &flag), &flag),
            "--height" => config.height = parse_value(next_arg(&mut args, &flag), &flag),
            "--iterations" => config.iterations = parse_value(next_arg(&mut args, &flag), &flag),
            "--scalar" | "--scale" => config.scale = parse_value(next_arg(&mut args, &flag), &flag),
            "--center-x" => config.center_x = parse_value(next_arg(&mut args, &flag), &flag),
            "--center-y" => config.center_y = parse_value(next_arg(&mut args, &flag), &flag),
            "--background" => config.background = next_arg(&mut args, &flag),
            "--outline" => config.outline = next_arg(&mut args, &flag),
            "--stroke-width" => {
                config.stroke_width = parse_value(next_arg(&mut args, &flag), &flag)
            }
            "--colors" => config.colors = (0..5).map(|_| next_arg(&mut args, &flag)).collect(),
            "--four-colors" => {
                config.four_colors = (0..4).map(|_| next_arg(&mut args, &flag)).collect()
            }
            "--color-mode" => {
                config.color_mode = match next_arg(&mut args, &flag).as_str() {
                    "families" | "simple" => ColorMode::Families,
                    "four_color" => ColorMode::FourColor,
                    value => invalid(&flag, value),
                }
            }
            "--material-mode" => {
                config.material_mode = match next_arg(&mut args, &flag).as_str() {
                    "solid" => MaterialMode::Solid,
                    "pattern" => MaterialMode::Pattern,
                    value => invalid(&flag, value),
                }
            }
            "--pattern-style" => {
                let value = next_arg(&mut args, &flag);
                if value != "curves" {
                    invalid::<()>(&flag, &value);
                }
            }
            "--pattern-base" => config.pattern_base = next_arg(&mut args, &flag),
            "--pattern-color" => config.pattern_color = next_arg(&mut args, &flag),
            "--studio-pattern" => {
                let value = next_arg(&mut args, &flag);
                config.studio_pattern =
                    Some(serde_json::from_str(&value).unwrap_or_else(|error| {
                        eprintln!("invalid value for {flag}: {error}");
                        std::process::exit(2);
                    }));
            }
            "--seed" => config.seed = Some(parse_value(next_arg(&mut args, &flag), &flag)),
            "--no-outline" => config.stroke_width = 0.0,
            "--help" | "-h" => {
                print_help();
                std::process::exit(0);
            }
            _ => {
                eprintln!("unknown flag: {flag}");
                print_help();
                std::process::exit(2);
            }
        }
    }
    (output, config)
}

fn next_arg(args: &mut impl Iterator<Item = String>, flag: &str) -> String {
    args.next().unwrap_or_else(|| {
        eprintln!("missing value for {flag}");
        std::process::exit(2);
    })
}

fn parse_value<T: std::str::FromStr>(raw: String, flag: &str) -> T {
    raw.parse().unwrap_or_else(|_| {
        eprintln!("invalid value for {flag}: {raw}");
        std::process::exit(2);
    })
}

fn invalid<T>(flag: &str, value: &str) -> T {
    eprintln!("invalid value for {flag}: {value}");
    std::process::exit(2);
}

fn print_help() {
    println!(
        "einstein\n\nGenerates an Einstein hat tiling as SVG.\n\nFlags:\n  --output PATH\n  --width PX\n  --height PX\n  --iterations N\n  --scale WORLD_TO_PIXEL\n  --center-x X\n  --center-y Y\n  --background COLOR\n  --outline COLOR\n  --stroke-width PX\n  --colors H1 H T P F\n  --color-mode families|four_color\n  --four-colors C1 C2 C3 C4\n  --material-mode solid|pattern\n  --pattern-base COLOR\n  --pattern-color COLOR\n  --studio-pattern JSON\n  --seed N"
    );
}
