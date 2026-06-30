//! Import flat data files as physical tables in a native DuckDB database file.

use serde::{Deserialize, Serialize};
use specta::Type;

#[cfg(feature = "duckdb-engine")]
use duckdb::Connection;
#[cfg(feature = "duckdb-engine")]
use std::collections::HashSet;
#[cfg(feature = "duckdb-engine")]
use std::path::Path;

#[cfg(feature = "duckdb-engine")]
use super::file_source::{file_type_label, reader_expr, view_name_for};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportFilesIntoDuckDbResult {
    pub tables: Vec<ImportedDuckDbTable>,
    pub failed: Vec<FailedDuckDbImport>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ImportedDuckDbTable {
    pub name: String,
    pub source_path: String,
    pub file_type: String,
    pub row_count: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FailedDuckDbImport {
    pub path: String,
    pub file_type: String,
    pub error: String,
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
fn existing_main_tables(conn: &Connection) -> Result<HashSet<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT table_name FROM duckdb_tables() \
             WHERE NOT internal AND schema_name = 'main'",
        )
        .map_err(|error| error.to_string())?;
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
    let sql = format!("SELECT COUNT(*) FROM main.{}", quote_ident(table_name));
    conn.query_row(&sql, [], |row| row.get(0))
        .map_err(|error| error.to_string())
}

/// Imports each supported file as a physical table in the connected DuckDB database.
#[cfg(feature = "duckdb-engine")]
pub fn import_files_into_duckdb(
    conn: &Connection,
    file_paths: &[String],
) -> Result<ImportFilesIntoDuckDbResult, String> {
    if file_paths.is_empty() {
        return Err("At least one file path is required".to_string());
    }

    let mut taken = existing_main_tables(conn)?;
    let mut tables = Vec::new();
    let mut failed = Vec::new();
    let mut warnings = Vec::new();

    for path in file_paths {
        let file_type = file_type_label(path);

        if !Path::new(path).exists() {
            failed.push(FailedDuckDbImport {
                path: path.clone(),
                file_type,
                error: "File not found".to_string(),
            });
            continue;
        }

        let Some(reader) = reader_expr(path) else {
            failed.push(FailedDuckDbImport {
                path: path.clone(),
                file_type,
                error: "Unsupported file type".to_string(),
            });
            continue;
        };

        let natural_name = view_name_for(path, &HashSet::new());
        let base_name = view_name_for(path, &taken);
        let table_name = resolve_table_name(&base_name, &taken);

        if table_name != natural_name {
            warnings.push(format!(
                "Renamed table '{natural_name}' to '{table_name}' because a table already exists"
            ));
        }

        let create_sql = format!(
            "CREATE TABLE main.{} AS SELECT * FROM {}",
            quote_ident(&table_name),
            reader
        );

        match conn.execute_batch(&create_sql) {
            Ok(()) => {
                let row_count = count_rows(conn, &table_name).ok();
                taken.insert(table_name.clone());
                tables.push(ImportedDuckDbTable {
                    name: table_name,
                    source_path: path.clone(),
                    file_type,
                    row_count,
                });
            }
            Err(error) => failed.push(FailedDuckDbImport {
                path: path.clone(),
                file_type,
                error: error.to_string(),
            }),
        }
    }

    if tables.is_empty() {
        return Err(if failed.is_empty() {
            "No files were imported".to_string()
        } else {
            format!("No files were imported ({} failed)", failed.len())
        });
    }

    if !failed.is_empty() {
        warnings.push(format!("Failed to import {} file(s)", failed.len()));
    }

    Ok(ImportFilesIntoDuckDbResult {
        tables,
        failed,
        warnings,
    })
}

#[cfg(all(test, feature = "duckdb-engine"))]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_csv(name: &str, rows: &[&str]) -> String {
        let path = std::env::temp_dir().join(name);
        let mut file = std::fs::File::create(&path).unwrap();
        for row in rows {
            writeln!(file, "{row}").unwrap();
        }
        path.to_string_lossy().to_string()
    }

    fn temp_db(name: &str) -> String {
        std::env::temp_dir()
            .join(name)
            .to_string_lossy()
            .to_string()
    }

    #[test]
    fn imports_valid_files_as_tables() {
        let db_path = temp_db("dora_import_files_out.duckdb");
        let csv = temp_csv("dora_import_files_a.csv", &["id", "1", "2"]);
        let _ = std::fs::remove_file(&db_path);

        let conn = Connection::open(&db_path).unwrap();
        let result = import_files_into_duckdb(&conn, &[csv.clone()]).unwrap();

        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.tables[0].name, "dora_import_files_a");
        assert_eq!(result.tables[0].row_count, Some(2));
        assert!(result.failed.is_empty());

        let count: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM \"{}\"", result.tables[0].name),
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(&csv);
    }

    #[test]
    fn handles_duplicate_table_names_with_suffixes() {
        let db_path = temp_db("dora_import_files_dup.duckdb");
        let csv = temp_csv("sales.csv", &["id", "1"]);
        let _ = std::fs::remove_file(&db_path);

        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE main.sales AS SELECT 1 AS id")
            .unwrap();

        let result = import_files_into_duckdb(&conn, &[csv.clone()]).unwrap();

        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.tables[0].name, "sales_2");
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("Renamed table")));

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(&csv);
    }

    #[test]
    fn reports_partial_failures() {
        let db_path = temp_db("dora_import_files_partial.duckdb");
        let good = temp_csv("dora_import_files_good.csv", &["id", "1"]);
        let _ = std::fs::remove_file(&db_path);

        let conn = Connection::open(&db_path).unwrap();
        let result = import_files_into_duckdb(
            &conn,
            &[
                good.clone(),
                "/no/such/dora_import_files.csv".to_string(),
                std::env::temp_dir()
                    .join("dora_import_files_bad.sqlite")
                    .to_string_lossy()
                    .to_string(),
            ],
        )
        .unwrap();

        assert_eq!(result.tables.len(), 1);
        assert_eq!(result.failed.len(), 2);
        assert!(result
            .warnings
            .iter()
            .any(|warning| warning.contains("Failed to import")));

        let _ = std::fs::remove_file(&db_path);
        let _ = std::fs::remove_file(&good);
    }

    #[test]
    fn fails_when_no_files_imported() {
        let db_path = temp_db("dora_import_files_empty.duckdb");
        let _ = std::fs::remove_file(&db_path);

        let conn = Connection::open(&db_path).unwrap();
        let error =
            import_files_into_duckdb(&conn, &["/no/such/dora_import_files.csv".to_string()])
                .unwrap_err();

        assert!(error.contains("No files were imported"));

        let _ = std::fs::remove_file(&db_path);
    }
}
