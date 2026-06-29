fn main() {
    ensure_duckdb_helper_placeholder();
    tauri_build::build();
}

fn ensure_duckdb_helper_placeholder() {
    let target = std::env::var("TARGET").unwrap_or_else(|_| {
        format!(
            "{}-unknown-{}",
            std::env::consts::ARCH,
            std::env::consts::OS
        )
    });
    let exe = if target.contains("windows") { ".exe" } else { "" };
    let path = std::path::PathBuf::from("binaries").join(format!("duckdb_helper-{target}{exe}"));
    if path.exists() {
        return;
    }
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, []);
}
