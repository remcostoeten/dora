use anyhow::anyhow;
use async_trait::async_trait;

use super::read::DuckDbAdapter;
use super::write::WriteAdapter;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::MutationResult;
use crate::Error;

use crate::database::ident::quote_ansi as quote_ident;

/// Error returned when a mutation is attempted against a read-only data-file
/// source (a CSV/Parquet/JSON view).
fn read_only_error() -> Error {
    Error::Any(anyhow!(
        "This is a read-only data file source (CSV/Parquet/JSON). Open it in a writable database to make changes."
    ))
}

fn qualified_table(schema: Option<&str>, table: &str) -> String {
    match schema.filter(|s| !s.is_empty()) {
        Some(schema) => format!("{}.{}", quote_ident(schema), quote_ident(table)),
        None => quote_ident(table),
    }
}

pub(crate) fn json_to_duckdb_value(value: &serde_json::Value) -> duckdb::types::Value {
    use duckdb::types::Value;

    match value {
        serde_json::Value::Null => Value::Null,
        serde_json::Value::Bool(b) => Value::Boolean(*b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::BigInt(i)
            } else {
                Value::Double(n.as_f64().unwrap_or(0.0))
            }
        }
        serde_json::Value::String(s) => Value::Text(s.clone()),
        other => Value::Text(other.to_string()),
    }
}

#[async_trait]
impl WriteAdapter for DuckDbAdapter {
    async fn update_cell(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        let conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let query = format!(
            "UPDATE {} SET {} = ? WHERE {} = ?",
            qualified_table(schema.as_deref(), &table),
            quote_ident(&column),
            quote_ident(&pk_column)
        );
        let params = [
            json_to_duckdb_value(&new_value),
            json_to_duckdb_value(&pk_value),
        ];
        let result = conn.execute(&query, duckdb::params_from_iter(params.iter()))?;

        Ok(MutationResult {
            success: result > 0,
            affected_rows: result,
            message: if result > 0 {
                Some(format!("Updated {} row(s)", result))
            } else {
                Some("No rows were updated".to_string())
            },
        })
    }

    async fn delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        if pk_values.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No rows to delete".to_string()),
            });
        }

        let conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let placeholders: Vec<&str> = pk_values.iter().map(|_| "?").collect();
        let query = format!(
            "DELETE FROM {} WHERE {} IN ({})",
            qualified_table(schema.as_deref(), &table),
            quote_ident(&pk_column),
            placeholders.join(", ")
        );
        let params: Vec<duckdb::types::Value> =
            pk_values.iter().map(json_to_duckdb_value).collect();
        let total_deleted = conn.execute(&query, duckdb::params_from_iter(params.iter()))?;

        Ok(MutationResult {
            success: total_deleted > 0,
            affected_rows: total_deleted,
            message: Some(format!("Deleted {} row(s)", total_deleted)),
        })
    }

    async fn insert_row(
        &self,
        table: String,
        schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        if row_data.is_empty() {
            return Ok(MutationResult {
                success: false,
                affected_rows: 0,
                message: Some("No data to insert".to_string()),
            });
        }

        let conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let col_names: String = row_data
            .keys()
            .map(|c| quote_ident(c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders: String = std::iter::repeat("?")
            .take(row_data.len())
            .collect::<Vec<_>>()
            .join(", ");
        let query = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            qualified_table(schema.as_deref(), &table),
            col_names,
            placeholders
        );
        let params: Vec<duckdb::types::Value> =
            row_data.values().map(json_to_duckdb_value).collect();
        conn.execute(&query, duckdb::params_from_iter(params.iter()))?;

        Ok(MutationResult {
            success: true,
            affected_rows: 1,
            message: Some("Inserted 1 row".to_string()),
        })
    }

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        let mut row_data = {
            let conn = self
                .connection()
                .lock()
                .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
            let query = format!(
                "SELECT * FROM {} WHERE {} = ? LIMIT 1",
                qualified_table(schema.as_deref(), &table),
                quote_ident(&pk_column)
            );
            let pk_val = json_to_duckdb_value(&pk_value);
            let mut stmt = conn.prepare(&query)?;
            let mut rows = stmt.query(duckdb::params_from_iter([pk_val].iter()))?;

            let column_names: Vec<String> =
                rows.as_ref().map(|s| s.column_names()).unwrap_or_default();

            match rows.next()? {
                Some(row) => {
                    let mut data = serde_json::Map::new();
                    for (idx, col_name) in column_names.iter().enumerate() {
                        let value = row
                            .get_ref(idx)
                            .map(crate::database::duckdb::row_writer::value_ref_to_json)
                            .unwrap_or(serde_json::Value::Null);
                        data.insert(col_name.clone(), value);
                    }
                    data
                }
                None => {
                    return Err(Error::Any(anyhow!(
                        "No row found in \"{}\" where {} matches the provided primary key",
                        table,
                        pk_column
                    )));
                }
            }
        };

        row_data.remove(&pk_column);
        if row_data.is_empty() {
            return Err(Error::Any(anyhow!(
                "Cannot duplicate row because only the primary key column is available"
            )));
        }

        self.insert_row(table, schema, row_data).await
    }

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        let conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let qualified = qualified_table(schema.as_deref(), &table);

        let row_count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {}", qualified), [], |row| {
                row.get(0)
            })
            .unwrap_or(0);

        conn.execute(&format!("DELETE FROM {}", qualified), [])
            .map_err(|e| Error::Any(anyhow!("Truncate failed: {}", e)))?;

        Ok(TruncateResult {
            success: true,
            affected_rows: row_count as usize,
            tables_truncated: vec![table.clone()],
            message: Some(format!(
                "Truncated table '{}', removed {} rows",
                table, row_count
            )),
        })
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::truncate_database for DuckDB",
        ))
    }

    async fn soft_delete_rows(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::soft_delete_rows for DuckDB",
        ))
    }

    async fn undo_soft_delete(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::undo_soft_delete for DuckDB",
        ))
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        let conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;

        // EXPORT DATABASE writes schema + data (CSV) into a directory
        conn.execute_batch(&format!(
            "EXPORT DATABASE '{}'",
            output_path.replace('\'', "''")
        ))
        .map_err(|e| Error::Any(anyhow!("Failed to dump database: {}", e)))?;

        let table_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM duckdb_tables() WHERE NOT internal",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(DumpResult {
            success: true,
            file_path: output_path.clone(),
            size_bytes: dir_size(&output_path),
            tables_dumped: table_count as u32,
            rows_dumped: 0,
            message: Some(format!("Database exported to {}", output_path)),
        })
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if self.is_read_only() {
            return Err(read_only_error());
        }
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        let mut conn = self
            .connection()
            .lock()
            .map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let tx = conn.transaction()?;
        let mut affected_rows = 0usize;
        for stmt in &statements {
            let rows = tx.execute(stmt.as_str(), [])?;
            affected_rows += rows;
        }
        tx.commit()?;

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}

fn dir_size(path: &str) -> u64 {
    std::fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .filter_map(|e| e.metadata().ok())
                .map(|m| m.len())
                .sum()
        })
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::{Arc, Mutex};

    fn setup() -> (DuckDbAdapter, Arc<Mutex<duckdb::Connection>>) {
        let conn = duckdb::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE t (
                id INTEGER PRIMARY KEY,
                n INTEGER,
                price DOUBLE,
                name TEXT
            );
            INSERT INTO t VALUES (1, 0, 0, '');",
        )
        .unwrap();
        let shared = Arc::new(Mutex::new(conn));
        (DuckDbAdapter::new(shared.clone()), shared)
    }

    #[tokio::test]
    async fn update_cell_and_set_null() {
        let (adapter, shared) = setup();

        adapter
            .update_cell(
                "t".into(),
                None,
                "id".into(),
                json!(1),
                "n".into(),
                json!(123),
            )
            .await
            .unwrap();
        adapter
            .update_cell(
                "t".into(),
                None,
                "id".into(),
                json!(1),
                "name".into(),
                json!(null),
            )
            .await
            .unwrap();

        let conn = shared.lock().unwrap();
        let (n, name): (i64, Option<String>) = conn
            .query_row("SELECT n, name FROM t WHERE id = 1", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(n, 123);
        assert_eq!(name, None);
    }

    #[tokio::test]
    async fn insert_delete_and_duplicate() {
        let (adapter, shared) = setup();

        let mut row = serde_json::Map::new();
        row.insert("id".into(), json!(2));
        row.insert("n".into(), json!(456));
        row.insert("name".into(), json!("world"));
        adapter.insert_row("t".into(), None, row).await.unwrap();

        // DuckDB has no autoincrement, so duplicating a PK-only-different row
        // fails on the NOT NULL pk — verify duplicate_row reads the row first
        let err = adapter
            .duplicate_row("t".into(), None, "id".into(), json!(99))
            .await
            .unwrap_err();
        assert!(err.to_string().contains("No row found"));

        let result = adapter
            .delete_rows("t".into(), None, "id".into(), vec![json!(2)])
            .await
            .unwrap();
        assert_eq!(result.affected_rows, 1);

        let conn = shared.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn truncate_table_reports_removed_rows() {
        let (adapter, shared) = setup();

        let result = adapter
            .truncate_table("t".into(), None, None)
            .await
            .unwrap();
        assert!(result.success);
        assert_eq!(result.affected_rows, 1);

        let conn = shared.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn read_only_adapter_refuses_mutations() {
        let conn = duckdb::Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE t (id INTEGER, name TEXT); INSERT INTO t VALUES (1,'a');")
            .unwrap();
        let shared = Arc::new(Mutex::new(conn));
        let adapter = DuckDbAdapter::new_with_read_only(shared.clone(), true);

        let mut row = serde_json::Map::new();
        row.insert("id".into(), json!(2));
        let insert = adapter.insert_row("t".into(), None, row).await;
        assert!(insert.is_err());
        assert!(insert.unwrap_err().to_string().contains("read-only"));

        let update = adapter
            .update_cell(
                "t".into(),
                None,
                "id".into(),
                json!(1),
                "name".into(),
                json!("x"),
            )
            .await;
        assert!(update.is_err());

        let delete = adapter
            .delete_rows("t".into(), None, "id".into(), vec![json!(1)])
            .await;
        assert!(delete.is_err());

        // Table contents are untouched.
        let conn = shared.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
    }

    #[tokio::test]
    async fn execute_batch_runs_in_transaction() {
        let (adapter, shared) = setup();

        adapter
            .execute_batch(vec![
                "INSERT INTO t VALUES (10, 1, 1.0, 'a')".into(),
                "INSERT INTO t VALUES (11, 2, 2.0, 'b')".into(),
            ])
            .await
            .unwrap();

        let conn = shared.lock().unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM t", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 3);
    }
}
