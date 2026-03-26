use std::env;
use std::path::PathBuf;

use spectre_rs::{write_svg, DrawMode, SpectreSvgConfig};

fn main() {
    let (output, config) = parse_args(env::args().skip(1));
    if let Err(err) = write_svg(&output, &config) {
        eprintln!("failed to write {}: {err}", output.display());
        std::process::exit(1);
    }
    println!("{}", output.display());
}

fn parse_args(args: impl Iterator<Item = String>) -> (PathBuf, SpectreSvgConfig) {
    let mut config = SpectreSvgConfig::default();
    let mut output = PathBuf::from("output/spectre.svg");
    let mut args = args;

    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--output" => output = PathBuf::from(next_arg(&mut args, "--output")),
            "--width" => config.width = parse_value(next_arg(&mut args, "--width"), "--width"),
            "--height" => config.height = parse_value(next_arg(&mut args, "--height"), "--height"),
            "--level" => config.level = parse_value(next_arg(&mut args, "--level"), "--level"),
            "--scale" => config.scale = parse_value(next_arg(&mut args, "--scale"), "--scale"),
            "--center-x" => config.center_x = parse_value(next_arg(&mut args, "--center-x"), "--center-x"),
            "--center-y" => config.center_y = parse_value(next_arg(&mut args, "--center-y"), "--center-y"),
            "--background" => config.background = next_arg(&mut args, "--background"),
            "--outline" => config.outline = next_arg(&mut args, "--outline"),
            "--stroke-width" => {
                config.stroke_width = parse_value(next_arg(&mut args, "--stroke-width"), "--stroke-width")
            }
            "--draw-mode" => {
                config.draw_mode = match next_arg(&mut args, "--draw-mode").as_str() {
                    "generated" => DrawMode::Generated,
                    "translation" => DrawMode::Translation,
                    other => {
                        eprintln!("invalid value for --draw-mode: {other}");
                        std::process::exit(2);
                    }
                }
            }
            "--palette" => {
                config.palette = next_arg(&mut args, "--palette")
                    .split(',')
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect();
            }
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

fn print_help() {
    println!(
        "spectre_rs\n\
         \n\
         Generates a Spectre tiling snapshot as SVG.\n\
         \n\
         Flags:\n\
           --output PATH\n\
           --width PX\n\
           --height PX\n\
           --level N\n\
           --scale WORLD_TO_PIXEL\n\
           --center-x X\n\
           --center-y Y\n\
           --background COLOR\n\
           --outline COLOR\n\
           --stroke-width PX\n\
           --draw-mode generated|translation\n\
           --palette c1,c2,c3,..."
    );
}
