use std::{env, fs, path::PathBuf};

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

fn run() -> Result<(), String> {
    let mut args = env::args().skip(1);
    let generator = args.next().ok_or_else(help)?;
    if generator == "--help" || generator == "-h" {
        println!("{}", help());
        return Ok(());
    }
    let mut output = PathBuf::from(format!("output/{generator}.svg"));
    let mut recipe = serde_json::json!({});
    while let Some(flag) = args.next() {
        match flag.as_str() {
            "--output" => output = PathBuf::from(args.next().ok_or("missing value for --output")?),
            "--config" => {
                recipe = serde_json::from_str(&args.next().ok_or("missing value for --config")?)
                    .map_err(|e| format!("invalid --config JSON: {e}"))?
            }
            "--config-file" => {
                let path = args.next().ok_or("missing value for --config-file")?;
                recipe = serde_json::from_str(
                    &fs::read_to_string(&path)
                        .map_err(|e| format!("failed to read {path}: {e}"))?,
                )
                .map_err(|e| format!("invalid recipe in {path}: {e}"))?;
            }
            _ => return Err(format!("unknown flag '{flag}'\n{}", help())),
        }
    }
    let svg = aperiodos_render::render_svg(&generator, &recipe)?;
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&output, svg).map_err(|e| format!("failed to write {}: {e}", output.display()))?;
    println!("{}", output.display());
    Ok(())
}

fn help() -> String {
    "aperiodos-render GENERATOR [--config JSON | --config-file PATH] [--output PATH]\n\nGENERATORS: einstein, spectre, penrose\nThe JSON recipe uses the same field names embedded in exported SVG metadata.".to_owned()
}
