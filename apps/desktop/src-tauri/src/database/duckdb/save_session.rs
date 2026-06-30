//! Materialize readonly data-file DuckDB views into a persistent `.duckdb` file.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

#[cfg(feature = "duckdb-engine")]
use super::file_source::DataFileSourceEntry;
use super::file_source::DataFileSourceStatus;

#[cfg(feature = "duckdb-engine")]
use duckdb::Connection;
#[cfg(feature = "duckdb-engine")]
use std::collections::HashSet;

#[cfg(feature = "duckdb-engine")]
const DEST_ALIAS: &str = "dora_dest";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SaveDataFileSessionResult {
    pub path: String,
    pub tables: Vec<SavedDataFileTable>,
    pub skipped: Vec<SkippedDataFileSource>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedDataFileTable {
    pub name: String,
    pub source_path: String,
    pub row_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SkippedDataFileSource {
    pub path: String,
    pub view_name: String,
    pub status: DataFileSourceStatus,
    pub error: Option<String>,
}

pub fn validate_destination_path(destination_path: &str) -> Result<PathBuf, String> {
    let trimmed = destination_path.trim();
    if trimmed.is_empty() {
        return Err("Destination path is required".to_string());
    }

    let path = PathBuf::from(trimmed);
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase);

    if extension.as_deref() != Some("duckdb") {
        return Err("Destination must be a .duckdb file".to_string());
    }

    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));

    if !parent.exists() {
        return Err(format!(
            "Destination directory does not exist: {}",
            parent.display()
        ));
    }

    Ok(path)
}

#[cfg(feature = "duckdb-engine")]
fn escape_sql_string(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(feature = "duckdb-engine")]
fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

#[cfg(feature = "duckdb-engine")]
fn resolve_table_name(base: &str, taken: &HashSet<String>) -> String {
    if !taken.contains(base) {
        return base.to_string();
    }

    let mut suffix = 2;
    loop {
        let candidate = format!("{base}_{suffix}");
        if !taken.contains(&candidate) {
            return candidate;
        }
        suffix += 1;
    }
}

#[cfg(feature = "duckdb-engine")]
fn existing_dest_tables(conn: &Connection) -> Result<HashSet<String>, String> {
    let sql =
        format!("SELECT table_name FROM duckdb_tables() WHERE database_name = '{DEST_ALIAS}'");
    let mut stmt = conn.prepare(&sql).map_err(|error| error.to_string())?;
    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;

    let mut taken = HashSet::new();
    for row in rows {
        taken.insert(row.map_err(|error| error.to_string())?);
    }
    Ok(taken)
}

#[cfg(feature = "duckdb-engine")]
fn count_rows(conn: &Connection, table_name: &str) -> Result<i64, String> {
    let sql = format!(
        "SELECT COUNT(*) FROM {}.{}",
        quote_ident(DEST_ALIAS),
        quote_ident(table_name)
    );
    conn.query_row(&sql, [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

/// Copies every active data-file view from `source_conn` into `destination_path`.
#[cfg(feature = "duckdb-engine")]
pub fn materialize_data_file_session(
    source_conn: &Connection,
    entries: &[DataFileSourceEntry],
    destination_path: &str,
    overwrite: bool,
) -> Result<SaveDataFileSessionResult, String> {
    let dest_path = validate_destination_path(destination_path)?;
    let dest_path_str = dest_path.to_string_lossy().to_string();

    if dest_path.exists() && !overwrite {
        return Err(format!(
            "Destination already exists: {}",
            dest_path.display()
        ));
    }

    if dest_path.exists() && overwrite {
        std::fs::remove_file(&dest_path).map_err(|error| error.to_string())?;
    }

    let active_entries: Vec<_> = entries
        .iter()
        .filter(|entry| entry.status == DataFileSourceStatus::Active)
        .collect();

    let skipped: Vec<SkippedDataFileSource> = entries
        .iter()
        .filter(|entry| entry.status != DataFileSourceStatus::Active)
        .map(|entry| SkippedDataFileSource {
            path: entry.path.clone(),
            view_name: entry.view_name.clone(),
            status: entry.status,
            error: entry.error.clone(),
        })
        .collect();

    if active_entries.is_empty() {
        return Err("No active data files to save".to_string());
    }

    let mut warnings = Vec::new();
    if !skipped.is_empty() {
        warnings.push(format!(
            "Skipped {} missing or failed source file(s)",
            skipped.len()
        ));
    }

    let attach_sql = format!(
        "ATTACH '{}' AS {} (TYPE DUCKDB)",
        escape_sql_string(&dest_path_str),
        quote_ident(DEST_ALIAS)
    );
    source_conn
        .execute_batch(&attach_sql)
        .map_err(|error| error.to_string())?;

    let materialize_result = (|| {
        let mut taken = existing_dest_tables(source_conn)?;
        let mut tables = Vec::with_capacity(active_entries.len());

        for entry in active_entries {
            let table_name = resolve_table_name(&entry.view_name, &taken);
            if table_name != entry.view_name {
                warnings.push(format!(
                    "Renamed table '{}' to '{}' to avoid a name collision",
                    entry.view_name, table_name
                ));
            }

            let create_sql = format!(
                "CREATE TABLE {}.{} AS SELECT * FROM {}",
                quote_ident(DEST_ALIAS),
                quote_ident(&table_name),
                quote_ident(&entry.view_name)
            );
            source_conn.execute_batch(&create_sql).map_err(|error| {
                format!(
                    "Failed to materialize {} as {}: {}",
                    entry.view_name, table_name, error
                )
            })?;

            let row_count = count_rows(source_conn, &table_name).ok();
            taken.insert(table_name.clone());
            tables.push(SavedDataFileTable {
                name: table_name,
                source_path: entry.path.clone(),
                row_count,
            });
        }

        Ok(tables)
    })();

    let detach_sql = format!("DETACH {}", quote_ident(DEST_ALIAS));
    let _ = source_conn.execute_batch(&detach_sql);

    match materialize_result {
        Ok(tables) => Ok(SaveDataFileSessionResult {
            path: dest_path_str,
            tables,
            skipped,
            warnings,
        }),
        Err(error) => {
            if dest_path.exists() {
                let _ = std::fs::remove_file(&dest_path);
            }
            Err(error)
        }
    }
}

#[cfg(all(test, feature = "duckdb-engine"))]
mod tests {
    use super::*;
    use crate::database::duckdb::file_source::{has_active_sources, register_sources};
    use std::io::Write;

    fn temp_csv(name: &str, rows: &[&str]) -> String {
        let path = std::env::temp_dir().join(name);
        let mut file = std::fs::File::create(&path).unwrap();
        for row in rows {
            writeln!(file, "{row}").unwrap();
        }
        path.to_string_lossy().to_string()
    }

    fn temp_dest(name: &str) -> String {
        std::env::temp_dir()
            .join(name)
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn materializes_active_views_into_physical_tables() {
        let csv = temp_csv("dora_save_session_a.csv", &["id", "1", "2"]);
        let dest = temp_dest("dora_save_session_out.duckdb");
        let _ = std::fs::remove_file(&dest);

        let source = Connection::open_in_memory().unwrap();
        let entries = register_sources(&source, &[csv.clone()]);
        assert!(has_active_sources(&entries));

        let result = materialize_data_file_session(&source, &entries, &dest, false).unwrap();
        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.tables[0].name, entries[0].view_name);
        assert_eq!(result.tables[0].row_count, Some(2));
        assert!(result.skipped.is_empty());
        assert!(Path::new(&dest).exists());

        let dest_conn = Connection::open(&dest).unwrap();
        let count: i64 = dest_conn
            .query_row(
                &format!("SELECT COUNT(*) FROM \"{}\"", result.tables[0].name),
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);

        let insert = dest_conn.execute(
            &format!("INSERT INTO \"{}\" VALUES (3)", result.tables[0].name),
            [],
        );
        assert!(insert.is_ok(), "materialized tables must be editable");

        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_file(&csv);
    }

    #[test]
    fn skips_missing_and_failed_sources_with_warning() {
        let good = temp_csv("dora_save_session_good.csv", &["id", "1"]);
        let bad_json = std::env::temp_dir().join("dora_save_session_bad.json");
        std::fs::write(&bad_json, "{ invalid").unwrap();
        let dest = temp_dest("dora_save_session_partial.duckdb");
        let _ = std::fs::remove_file(&dest);

        let source = Connection::open_in_memory().unwrap();
        let entries = register_sources(
            &source,
            &[
                good.clone(),
                "/no/such/dora_save_session.csv".to_string(),
                bad_json.to_string_lossy().to_string(),
            ],
        );

        let result = materialize_data_file_session(&source, &entries, &dest, false).unwrap();
        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.skipped.len(), 2);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("Skipped 2")));

        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_file(&good);
        let _ = std::fs::remove_file(&bad_json);
    }

    #[test]
    fn fails_when_no_active_sources_exist() {
        let source = Connection::open_in_memory().unwrap();
        let entries = register_sources(&source, &["/no/such/dora_save_session.csv".to_string()]);
        let dest = temp_dest("dora_save_session_empty.duckdb");
        let _ = std::fs::remove_file(&dest);

        let error = materialize_data_file_session(&source, &entries, &dest, false).unwrap_err();
        assert!(error.contains("No active data files"));

        let _ = std::fs::remove_file(&dest);
    }

    #[test]
    fn rejects_existing_destination_without_overwrite() {
        let csv = temp_csv("dora_save_session_overwrite.csv", &["id", "1"]);
        let dest = temp_dest("dora_save_session_existing.duckdb");
        std::fs::write(&dest, "placeholder").unwrap();

        let source = Connection::open_in_memory().unwrap();
        let entries = register_sources(&source, &[csv.clone()]);

        let error = materialize_data_file_session(&source, &entries, &dest, false).unwrap_err();
        assert!(error.contains("already exists"));

        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_file(&csv);
    }

    #[test]
    fn suffixes_colliding_table_names_in_destination() {
        let dir = std::env::temp_dir();
        let first = dir.join("dora_save_session_sales_a.csv");
        let second = dir.join("dora_save_session_sales_b.csv");
        for path in [&first, &second] {
            let mut file = std::fs::File::create(path).unwrap();
            writeln!(file, "id").unwrap();
            writeln!(file, "1").unwrap();
        }

        let dest = temp_dest("dora_save_session_collision.duckdb");
        let _ = std::fs::remove_file(&dest);

        let source = Connection::open_in_memory().unwrap();
        let entries = register_sources(
            &source,
            &[
                first.to_string_lossy().to_string(),
                second.to_string_lossy().to_string(),
            ],
        );
        assert_eq!(entries[0].view_name, "dora_save_session_sales_a");
        assert_eq!(entries[1].view_name, "dora_save_session_sales_b");

        // Force both entries to share the same view/table name to exercise suffixing.
        let entries = vec![
            DataFileSourceEntry {
                path: first.to_string_lossy().to_string(),
                view_name: "sales".to_string(),
                file_type: "CSV".to_string(),
                status: DataFileSourceStatus::Active,
                error: None,
            },
            DataFileSourceEntry {
                path: second.to_string_lossy().to_string(),
                view_name: "sales".to_string(),
                file_type: "CSV".to_string(),
                status: DataFileSourceStatus::Active,
                error: None,
            },
        ];
        source
            .execute_batch("CREATE OR REPLACE VIEW \"sales\" AS SELECT 1 AS id")
            .unwrap();

        let result = materialize_data_file_session(&source, &entries, &dest, false).unwrap();
        assert_eq!(result.tables.len(), 2);
        assert_eq!(result.tables[0].name, "sales");
        assert_eq!(result.tables[1].name, "sales_2");
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("Renamed table")));

        let _ = std::fs::remove_file(&dest);
        let _ = std::fs::remove_file(&first);
        let _ = std::fs::remove_file(&second);
    }
}
