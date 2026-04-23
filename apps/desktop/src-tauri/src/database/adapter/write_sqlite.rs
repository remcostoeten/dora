use async_trait::async_trait;
use anyhow::anyhow;

use super::read::SqliteAdapter;
use super::write::WriteAdapter;
use crate::database::maintenance;
use crate::database::services::mutation::{
    json_to_sqlite_value, sqlite_value_to_json, MutationResult,
};
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::Error;

#[async_trait]
impl WriteAdapter for SqliteAdapter {
    async fn update_cell(
        &self,
        table: String,
        _schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let query = format!(
            "UPDATE \"{}\" SET \"{}\" = ? WHERE \"{}\" = ?",
            table, column, pk_column
        );
        let new_val = json_to_sqlite_value(&new_value);
        let pk_val = json_to_sqlite_value(&pk_value);
        let result = conn.execute(
            &query,
            [&new_val as &dyn rusqlite::ToSql, &pk_val as &dyn rusqlite::ToSql],
        )?;

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
        _schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if pk_values.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No rows to delete".to_string()),
            });
        }

        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let placeholders: Vec<&str> = pk_values.iter().map(|_| "?").collect();
        let query = format!(
            "DELETE FROM \"{}\" WHERE \"{}\" IN ({})",
            table, pk_column, placeholders.join(", ")
        );
        let params: Vec<rusqlite::types::Value> = pk_values.iter().map(json_to_sqlite_value).collect();
        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
        let total_deleted = conn.execute(&query, params_ref.as_slice())? as usize;

        Ok(MutationResult {
            success: total_deleted > 0,
            affected_rows: total_deleted,
            message: Some(format!("Deleted {} row(s)", total_deleted)),
        })
    }

    async fn insert_row(
        &self,
        table: String,
        _schema: Option<String>,
        row_data: serde_json::Map<String, serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        if row_data.is_empty() {
            return Ok(MutationResult {
                success: false,
                affected_rows: 0,
                message: Some("No data to insert".to_string()),
            });
        }

        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        let columns: Vec<&String> = row_data.keys().collect();
        let col_names: String = columns.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", ");
        let placeholders: String = std::iter::repeat("?").take(row_data.len()).collect::<Vec<_>>().join(", ");
        let query = format!("INSERT INTO \"{}\" ({}) VALUES ({})", table, col_names, placeholders);
        let params: Vec<rusqlite::types::Value> = row_data.values().map(json_to_sqlite_value).collect();
        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p as &dyn rusqlite::ToSql).collect();
        conn.execute(&query, params_ref.as_slice())?;

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
        let mut row_data = {
            let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
            let query = format!("SELECT * FROM \"{}\" WHERE \"{}\" = ? LIMIT 1", table, pk_column);
            let pk_val = json_to_sqlite_value(&pk_value);
            let mut stmt = conn.prepare(&query)?;
            let column_names: Vec<String> = stmt.column_names().into_iter().map(|n| n.to_string()).collect();
            let row_data = stmt.query_row([&pk_val as &dyn rusqlite::ToSql], |row| {
                let mut data = serde_json::Map::new();
                for (idx, col_name) in column_names.iter().enumerate() {
                    data.insert(col_name.clone(), sqlite_value_to_json(row, idx));
                }
                Ok(data)
            });

            match row_data {
                Ok(data) => data,
                Err(rusqlite::Error::QueryReturnedNoRows) => {
                    return Err(Error::Any(anyhow!(
                        "No row found in \"{}\" where {} matches the provided primary key",
                        table, pk_column
                    )));
                }
                Err(error) => return Err(error.into()),
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
        _schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        maintenance::truncate_table_sqlite(&conn, &table)
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        Err(Error::NotImplemented("WriteAdapter::truncate_database for SQLite"))
    }

    async fn soft_delete_rows(
        &self,
        table: String,
        _schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        let col = soft_delete_column.ok_or_else(|| {
            Error::InvalidInput("soft_delete_column is required for adapter dispatch".into())
        })?;
        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        maintenance::soft_delete_sqlite(&conn, &table, &pk_column, &pk_values, &col)
    }

    async fn undo_soft_delete(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        Err(Error::NotImplemented("WriteAdapter::undo_soft_delete for SQLite"))
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        let conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
        maintenance::dump_database_sqlite(&conn, &output_path)
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        let mut conn = self.connection().lock().map_err(|_| Error::Internal("Mutex poisoned".into()))?;
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
