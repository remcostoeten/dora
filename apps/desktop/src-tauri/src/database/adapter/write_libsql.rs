use async_trait::async_trait;
use anyhow::anyhow;

use super::read::LibSqlAdapter;
use super::write::WriteAdapter;
use crate::database::adapter::DatabaseAdapter;
use crate::database::maintenance;
use crate::database::services::mutation::{
    json_to_libsql_value, libsql_value_to_json, MutationResult,
};
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::Error;

#[async_trait]
impl WriteAdapter for LibSqlAdapter {
    async fn update_cell(
        &self,
        table: String,
        _schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let query = format!(
            "UPDATE `{}` SET `{}` = ? WHERE `{}` = ?",
            table, column, pk_column
        );
        let new_val = json_to_libsql_value(&new_value);
        let pk_val = json_to_libsql_value(&pk_value);
        let result = self
            .connection()
            .execute(&query, vec![new_val, pk_val])
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL update failed: {}", e)))? as usize;

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

        let placeholders: Vec<&str> = pk_values.iter().map(|_| "?").collect();
        let query = format!(
            "DELETE FROM `{}` WHERE `{}` IN ({})",
            table, pk_column, placeholders.join(", ")
        );
        let params: Vec<libsql::Value> = pk_values.iter().map(json_to_libsql_value).collect();
        let total_deleted = self
            .connection()
            .execute(&query, params)
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL delete failed: {}", e)))? as usize;

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

        let columns: Vec<&String> = row_data.keys().collect();
        let col_names: String = columns.iter().map(|c| format!("\"{}\"", c)).collect::<Vec<_>>().join(", ");
        let placeholders: String = std::iter::repeat("?").take(row_data.len()).collect::<Vec<_>>().join(", ");
        let query = format!("INSERT INTO \"{}\" ({}) VALUES ({})", table, col_names, placeholders);
        let params: Vec<libsql::Value> = row_data.values().map(json_to_libsql_value).collect();

        self.connection()
            .execute(&query, params)
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL insert failed: {}", e)))?;

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
        let query = format!(
            "SELECT * FROM \"{}\" WHERE \"{}\" = ? LIMIT 1",
            table, pk_column
        );
        let params = vec![json_to_libsql_value(&pk_value)];
        let mut rows = self
            .connection()
            .query(&query, params)
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL duplicate lookup failed: {}", e)))?;

        let column_names: Vec<String> = (0..rows.column_count())
            .filter_map(|idx| rows.column_name(idx as i32).map(|name| name.to_string()))
            .collect();

        let row = rows
            .next()
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL duplicate fetch failed: {}", e)))?
            .ok_or_else(|| {
                Error::Any(anyhow!(
                    "No row found in \"{}\" where {} matches the provided primary key",
                    table, pk_column
                ))
            })?;

        let mut data = serde_json::Map::new();
        for (idx, col_name) in column_names.iter().enumerate() {
            data.insert(col_name.clone(), libsql_value_to_json(&row, idx as i32));
        }
        data.remove(&pk_column);

        if data.is_empty() {
            return Err(Error::Any(anyhow!(
                "Cannot duplicate row because only the primary key column is available"
            )));
        }

        self.insert_row(table, schema, data).await
    }

    async fn truncate_table(
        &self,
        table: String,
        _schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        maintenance::truncate_table_libsql(self.connection(), &table).await
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        Err(Error::NotImplemented("WriteAdapter::truncate_database for LibSQL"))
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
        maintenance::soft_delete_libsql(self.connection(), &table, &pk_column, &pk_values, &col).await
    }

    async fn undo_soft_delete(
        &self,
        _table: String,
        _schema: Option<String>,
        _pk_column: String,
        _pk_values: Vec<serde_json::Value>,
        _soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        Err(Error::NotImplemented("WriteAdapter::undo_soft_delete for LibSQL"))
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        let schema = self.get_schema().await?;
        maintenance::dump_database_libsql(self.connection(), &schema, &output_path).await
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        self.connection()
            .execute("BEGIN", ())
            .await
            .map_err(|e| Error::Any(anyhow!("LibSQL BEGIN failed: {}", e)))?;

        let mut affected_rows = 0usize;
        let result: Result<(), Error> = async {
            for stmt in &statements {
                let res = self
                    .connection()
                    .execute(stmt, ())
                    .await
                    .map_err(|e| Error::Any(anyhow!("LibSQL execution failed: {}", e)))?;
                affected_rows += res as usize;
            }
            Ok(())
        }
        .await;

        if result.is_ok() {
            self.connection()
                .execute("COMMIT", ())
                .await
                .map_err(|e| Error::Any(anyhow!("LibSQL COMMIT failed: {}", e)))?;
        } else {
            let _ = self.connection().execute("ROLLBACK", ()).await;
            result?;
        }

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}
