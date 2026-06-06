use std::path::{Path, PathBuf};

pub fn install_root() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("dora")
        .join("ollama")
}

pub fn models_dir() -> PathBuf {
    install_root().join("models")
}

pub fn managed_install_exists() -> bool {
    install_root().join(".dora-managed").is_file()
}

pub fn managed_binary_path() -> Option<PathBuf> {
    let root = install_root();
    let candidates = [
        root.join("bin").join(binary_name()),
        root.join(binary_name()),
    ];

    candidates
        .into_iter()
        .find(|path| path.is_file())
        .or_else(|| find_binary_recursive(&root, 4))
}

pub fn lib_dir() -> Option<PathBuf> {
    let lib = install_root().join("lib").join("ollama");
    if lib.is_dir() {
        return Some(lib);
    }
    let lib = install_root().join("lib");
    if lib.is_dir() {
        return Some(lib);
    }
    None
}

fn binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "ollama.exe"
    } else {
        "ollama"
    }
}

fn find_binary_recursive(root: &Path, max_depth: u32) -> Option<PathBuf> {
    if max_depth == 0 {
        return None;
    }

    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
                if name == binary_name() || name == "ollama" {
                    return Some(path);
                }
            }
        } else if path.is_dir() {
            if let Some(found) = find_binary_recursive(&path, max_depth - 1) {
                return Some(found);
            }
        }
    }

    None
}
