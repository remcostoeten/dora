//! Querying flat files (CSV / TSV / Parquet / JSON) as if they were database
//! tables, backed by an in-memory DuckDB connection.
//!
//! Each file is registered as a read-only `VIEW` over DuckDB's
//! `read_csv_auto` / `read_parquet` / `read_json_auto` table functions. Views
//! (not materialized tables) keep large Parquet scans lazy and make the
//! read-only contract structural rather than advisory — `INSERT`/`UPDATE`
//! against a view fails at the engine level even before our own guard rails.

use std::collections::HashSet;
use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

#[cfg(feature = "duckdb-engine")]
use duckdb::Connection;

/// Outcome of registering a batch of file sources. A missing or malformed file
/// never aborts the whole connection; it is reported so the UI can surface it.
#[derive(Debug, Default, Clone)]
pub struct RegisterReport {
    /// View names that were created successfully.
    pub registered: Vec<String>,
    /// Source paths that do not exist on disk.
    pub missing: Vec<String>,
    /// Source paths that failed to register, with the DuckDB error text.
    pub failed: Vec<(String, String)>,
}

impl RegisterReport {
    pub fn from_entries(entries: &[DataFileSourceEntry]) -> Self {
        let mut report = RegisterReport::default();
        for entry in entries {
            match entry.status {
                DataFileSourceStatus::Active => report.registered.push(entry.view_name.clone()),
                DataFileSourceStatus::Missing => report.missing.push(entry.path.clone()),
                DataFileSourceStatus::Failed => report.failed.push((
                    entry.path.clone(),
                    entry
                        .error
                        .clone()
                        .unwrap_or_else(|| "Registration failed".to_string()),
                )),
            }
        }
        report
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum DataFileSourceStatus {
    Active,
    Missing,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DataFileSourceEntry {
    pub path: String,
    pub view_name: String,
    pub file_type: String,
    pub status: DataFileSourceStatus,
    pub error: Option<String>,
}

pub fn has_active_sources(entries: &[DataFileSourceEntry]) -> bool {
    entries
        .iter()
        .any(|entry| entry.status == DataFileSourceStatus::Active)
}

/// Returns the DuckDB table-function expression for a path based on its
/// extension, or `None` when the extension is not a supported data file.
pub fn reader_expr(path: &str) -> Option<String> {
    let escaped = path.replace('\'', "''");
    match extension(path).as_deref() {
        Some("csv") | Some("tsv") | Some("txt") => Some(format!("read_csv_auto('{}')", escaped)),
        Some("parquet") | Some("pq") => Some(format!("read_parquet('{}')", escaped)),
        Some("json") | Some("ndjson") | Some("jsonl") => {
            Some(format!("read_json_auto('{}')", escaped))
        }
        _ => None,
    }
}

/// True when the path looks like a flat data file we can open as a view.
pub fn is_data_file(path: &str) -> bool {
    reader_expr(path).is_some()
}

pub fn file_type_label(path: &str) -> String {
    match extension(path).as_deref() {
        Some("csv") => "CSV".to_string(),
        Some("tsv") => "TSV".to_string(),
        Some("txt") => "Text".to_string(),
        Some("parquet") | Some("pq") => "Parquet".to_string(),
        Some("json") => "JSON".to_string(),
        Some("ndjson") => "NDJSON".to_string(),
        Some("jsonl") => "JSON Lines".to_string(),
        Some(ext) => ext.to_uppercase(),
        None => "Unknown".to_string(),
    }
}

/// Derives a SQL-safe, collision-free view name from a file path. The stem is
/// lower-cased and non-identifier characters become underscores; a numeric
/// suffix disambiguates collisions within one session.
pub fn view_name_for(path: &str, taken: &HashSet<String>) -> String {
    let stem = Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "data".to_string());

    let mut sanitized: String = stem
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();

    if sanitized.is_empty() || sanitized.chars().next().unwrap().is_ascii_digit() {
        sanitized = format!("t_{}", sanitized);
    }
    let base = sanitized.to_lowercase();

    if !taken.contains(&base) {
        return base;
    }
    let mut n = 2;
    loop {
        let candidate = format!("{}_{}", base, n);
        if !taken.contains(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

/// Registers every file source as a view on `conn`. Missing/failed files are
/// collected rather than propagated so a connection with one bad path still
/// opens with the rest of its tables.
#[cfg(feature = "duckdb-engine")]
pub fn register_sources(conn: &Connection, sources: &[String]) -> Vec<DataFileSourceEntry> {
    let mut entries = Vec::with_capacity(sources.len());
    let mut taken: HashSet<String> = HashSet::new();

    for path in sources {
        let view_name = view_name_for(path, &taken);
        let file_type = file_type_label(path);

        if !Path::new(path).exists() {
            entries.push(DataFileSourceEntry {
                path: path.clone(),
                view_name,
                file_type,
                status: DataFileSourceStatus::Missing,
                error: Some("File not found".to_string()),
            });
            continue;
        }

        let Some(reader) = reader_expr(path) else {
            entries.push(DataFileSourceEntry {
                path: path.clone(),
                view_name,
                file_type,
                status: DataFileSourceStatus::Failed,
                error: Some("Unsupported file type".to_string()),
            });
            continue;
        };

        let quoted = view_name.replace('"', "\"\"");
        let sql = format!(
            "CREATE OR REPLACE VIEW \"{}\" AS SELECT * FROM {}",
            quoted, reader
        );

        match conn.execute_batch(&sql) {
            Ok(()) => {
                taken.insert(view_name.clone());
                entries.push(DataFileSourceEntry {
                    path: path.clone(),
                    view_name,
                    file_type,
                    status: DataFileSourceStatus::Active,
                    error: None,
                });
            }
            Err(error) => entries.push(DataFileSourceEntry {
                path: path.clone(),
                view_name,
                file_type,
                status: DataFileSourceStatus::Failed,
                error: Some(error.to_string()),
            }),
        }
    }

    entries
}

fn extension(path: &str) -> Option<String> {
    Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(feature = "duckdb-engine")]
    use std::io::Write;

    #[test]
    fn reader_expr_maps_extensions() {
        assert!(reader_expr("/tmp/a.csv").unwrap().contains("read_csv_auto"));
        assert!(reader_expr("/tmp/a.tsv").unwrap().contains("read_csv_auto"));
        assert!(reader_expr("/tmp/a.parquet")
            .unwrap()
            .contains("read_parquet"));
        assert!(reader_expr("/tmp/a.json")
            .unwrap()
            .contains("read_json_auto"));
        assert!(reader_expr("/tmp/a.ndjson")
            .unwrap()
            .contains("read_json_auto"));
        assert!(reader_expr("/tmp/a.sqlite").is_none());
        assert!(reader_expr("/tmp/a.duckdb").is_none());
    }

    #[test]
    fn reader_expr_escapes_quotes() {
        let expr = reader_expr("/tmp/o'brien.csv").unwrap();
        assert!(expr.contains("o''brien"));
    }

    #[test]
    fn view_name_sanitizes_and_dedupes() {
        let mut taken = HashSet::new();
        let a = view_name_for("/data/My Sales-2024.csv", &taken);
        assert_eq!(a, "my_sales_2024");
        taken.insert(a);
        let b = view_name_for("/other/My Sales-2024.csv", &taken);
        assert_eq!(b, "my_sales_2024_2");

        taken.clear();
        assert_eq!(view_name_for("/x/123.csv", &taken), "t_123");
    }

    #[test]
    #[cfg(feature = "duckdb-engine")]
    fn register_reports_missing_files() {
        let conn = Connection::open_in_memory().unwrap();
        let entries = register_sources(&conn, &["/no/such/file.csv".to_string()]);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, DataFileSourceStatus::Missing);
        assert!(!has_active_sources(&entries));
    }

    #[test]
    #[cfg(feature = "duckdb-engine")]
    fn register_creates_queryable_view_from_csv() {
        let dir = std::env::temp_dir();
        let path = dir.join("dora_filesource_test.csv");
        {
            let mut f = std::fs::File::create(&path).unwrap();
            writeln!(f, "id,name,amount").unwrap();
            writeln!(f, "1,alice,10.5").unwrap();
            writeln!(f, "2,bob,20.0").unwrap();
        }
        let path_str = path.to_string_lossy().to_string();

        let conn = Connection::open_in_memory().unwrap();
        let entries = register_sources(&conn, &[path_str]);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, DataFileSourceStatus::Active);
        let view = &entries[0].view_name;

        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", view), [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 2);

        let total: f64 = conn
            .query_row(&format!("SELECT SUM(amount) FROM \"{}\"", view), [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!((total - 30.5).abs() < 1e-9);

        let insert = conn.execute(&format!("INSERT INTO \"{}\" VALUES (3,'x',1)", view), []);
        assert!(insert.is_err(), "views must reject inserts");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn register_partial_success_keeps_active_views() {
        let dir = std::env::temp_dir();
        let good_path = dir.join("dora_filesource_good.csv");
        let bad_json_path = dir.join("dora_filesource_bad.json");
        {
            let mut f = std::fs::File::create(&good_path).unwrap();
            writeln!(f, "id").unwrap();
            writeln!(f, "1").unwrap();
        }
        std::fs::write(&bad_json_path, "{ invalid").unwrap();

        let conn = Connection::open_in_memory().unwrap();
        let entries = register_sources(
            &conn,
            &[
                good_path.to_string_lossy().to_string(),
                "/definitely/missing/dora_file.csv".to_string(),
                bad_json_path.to_string_lossy().to_string(),
            ],
        );

        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].status, DataFileSourceStatus::Active);
        assert_eq!(entries[1].status, DataFileSourceStatus::Missing);
        assert_eq!(entries[2].status, DataFileSourceStatus::Failed);
        assert!(has_active_sources(&entries));

        let view = &entries[0].view_name;
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", view), [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 1);

        let _ = std::fs::remove_file(&good_path);
        let _ = std::fs::remove_file(&bad_json_path);
    }

    #[test]
    fn duplicate_stems_get_stable_view_names_in_one_session() {
        let dir = std::env::temp_dir();
        let first = dir.join("dora_filesource_dup_a.csv");
        let second = dir.join("dora_filesource_dup_b.csv");
        for path in [&first, &second] {
            let mut f = std::fs::File::create(path).unwrap();
            writeln!(f, "value").unwrap();
            writeln!(f, "1").unwrap();
        }

        let conn = Connection::open_in_memory().unwrap();
        let entries = register_sources(
            &conn,
            &[
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
            ],
        );

        assert_eq!(entries[0].view_name, "dora_filesource_dup_a");
        assert_eq!(entries[1].view_name, "dora_filesource_dup_b");
        assert!(entries
            .iter()
            .all(|entry| entry.status == DataFileSourceStatus::Active));

        let _ = std::fs::remove_file(&first);
        let _ = std::fs::remove_file(&second);
    }

    #[test]
    fn register_reports_invalid_json_as_failed() {
        let dir = std::env::temp_dir();
        let path = dir.join("dora_filesource_invalid.json");
        std::fs::write(&path, "{ this is not valid json").unwrap();

        let conn = Connection::open_in_memory().unwrap();
        let entries = register_sources(&conn, &[path.to_string_lossy().to_string()]);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].status, DataFileSourceStatus::Failed);
        assert!(entries[0].error.as_ref().unwrap().len() > 0);

        let _ = std::fs::remove_file(&path);
    }
}
