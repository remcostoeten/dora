use std::fs;
use std::path::{Path, PathBuf};

use app_lib::commands::build_cache::{
    clean_build_cache_at, get_build_cache_stats_at, BuildCacheCleanRequest,
};

fn temp_root(name: &str) -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!("dora-build-cache-test-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&path);
    fs::create_dir_all(&path).unwrap();
    path
}

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, bytes).unwrap();
}

#[test]
fn reports_size_for_target_subdirectories() {
    let root = temp_root("stats");
    let target = root.join("target");
    write_file(&target.join("debug/deps/a.bin"), b"debug");
    write_file(&target.join("release/b.bin"), b"release");
    write_file(&target.join("tmp/c.bin"), b"tmp");

    let stats = get_build_cache_stats_at(&target).unwrap();

    assert_eq!(stats.total_bytes, 15);
    assert_eq!(
        stats
            .entries
            .iter()
            .find(|entry| entry.name == "debug")
            .unwrap()
            .bytes,
        5
    );
    assert_eq!(
        stats
            .entries
            .iter()
            .find(|entry| entry.name == "release")
            .unwrap()
            .bytes,
        7
    );

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn cleans_selected_target_subdirectories_only() {
    let root = temp_root("clean");
    let target = root.join("target");
    write_file(&target.join("debug/deps/a.bin"), b"debug");
    write_file(&target.join("release/b.bin"), b"release");
    write_file(&root.join("outside.txt"), b"keep");

    let result = clean_build_cache_at(
        &target,
        BuildCacheCleanRequest {
            entries: vec!["debug".to_string()],
        },
    )
    .unwrap();

    assert_eq!(result.removed_bytes, 5);
    assert!(!target.join("debug").exists());
    assert!(target.join("release/b.bin").exists());
    assert!(root.join("outside.txt").exists());

    fs::remove_dir_all(root).unwrap();
}
