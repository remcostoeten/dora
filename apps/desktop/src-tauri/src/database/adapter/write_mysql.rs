use anyhow::anyhow;
use async_trait::async_trait;
use mysql_async::prelude::Queryable;
use mysql_async::{Params, Row as MySqlRow, Value as MySqlValue};

use super::read::MySqlAdapter;
use super::write::{duplicate_outcome, require_copyable_columns, WriteAdapter};
use crate::database::adapter::DatabaseAdapter;
use crate::database::maintenance;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::{
    json_to_mysql_value, mysql_qualified_table_name, mysql_quote_identifier, MutationResult,
};
use crate::Error;

#[async_trait]
impl WriteAdapter for MySqlAdapter {
    async fn update_cell(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let query = format!(
            "UPDATE {} SET {} = ? WHERE {} = ?",
            mysql_qualified_table_name(&table, schema.as_deref()),
            mysql_quote_identifier(&column),
            mysql_quote_identifier(&pk_column)
        );
        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        conn.exec_drop(
            query,
            Params::Positional(vec![
                json_to_mysql_value(&new_value),
                json_to_mysql_value(&pk_value),
            ]),
        )
        .await
        .map_err(|e| Error::Any(anyhow!("MySQL update failed: {}", e)))?;
        let result = conn.affected_rows() as usize;

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
        if pk_values.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No rows to delete".to_string()),
            });
        }

        let qualified_table = mysql_qualified_table_name(&table, schema.as_deref());
        let placeholders: Vec<&str> = pk_values.iter().map(|_| "?").collect();
        let query = format!(
            "DELETE FROM {} WHERE {} IN ({})",
            qualified_table,
            mysql_quote_identifier(&pk_column),
            placeholders.join(", ")
        );
        let params: Vec<MySqlValue> = pk_values.iter().map(json_to_mysql_value).collect();
        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        conn.exec_drop(query, Params::Positional(params))
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL delete failed: {}", e)))?;
        let total_deleted = conn.affected_rows() as usize;

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
        if row_data.is_empty() {
            return Ok(MutationResult {
                success: false,
                affected_rows: 0,
                message: Some("No data to insert".to_string()),
            });
        }

        let qualified_table = mysql_qualified_table_name(&table, schema.as_deref());
        let columns: Vec<&String> = row_data.keys().collect();
        let col_names: String = columns
            .iter()
            .map(|c| mysql_quote_identifier(c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders: String = std::iter::repeat_n("?", row_data.len())
            .collect::<Vec<_>>()
            .join(", ");
        let query = format!(
            "INSERT INTO {} ({}) VALUES ({})",
            qualified_table, col_names, placeholders
        );

        let params: Vec<MySqlValue> = columns
            .iter()
            .filter_map(|col| row_data.get(*col))
            .map(json_to_mysql_value)
            .collect();

        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        conn.exec_drop(query, Params::Positional(params))
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL insert failed: {}", e)))?;
        let rows = conn.affected_rows() as usize;

        Ok(MutationResult {
            success: true,
            affected_rows: rows,
            message: if rows == 1 {
                Some("Inserted 1 row".to_string())
            } else {
                Some(format!("Inserted {} row(s)", rows))
            },
        })
    }

    async fn duplicate_row(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let qualified_table = mysql_qualified_table_name(&table, schema.as_deref());
        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        // Generated columns are skipped; MySQL reports '' and MariaDB NULL for ordinary ones.
        let columns: Vec<String> = conn
            .exec(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS \
                 WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ? AND COLUMN_NAME <> ? \
                 AND (GENERATION_EXPRESSION IS NULL OR GENERATION_EXPRESSION = '') \
                 ORDER BY ORDINAL_POSITION",
                (schema.clone(), table.clone(), pk_column.clone()),
            )
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL duplicate lookup failed: {}", e)))?;
        require_copyable_columns(&columns)?;

        let column_list = columns
            .iter()
            .map(|column| mysql_quote_identifier(column))
            .collect::<Vec<_>>()
            .join(", ");
        let query = format!(
            "INSERT INTO {qualified_table} ({column_list}) SELECT {column_list} FROM {qualified_table} WHERE {} = ?",
            mysql_quote_identifier(&pk_column)
        );
        conn.exec_drop(
            query,
            Params::Positional(vec![json_to_mysql_value(&pk_value)]),
        )
        .await
        .map_err(|e| Error::Any(anyhow!("MySQL duplicate failed: {}", e)))?;
        duplicate_outcome(conn.affected_rows() as usize, &table, &pk_column)
    }

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error> {
        let qualified_table = mysql_qualified_table_name(&table, schema.as_deref());
        let query = format!(
            "SELECT {} FROM {} WHERE {} = ? LIMIT 1",
            mysql_quote_identifier(&column),
            qualified_table,
            mysql_quote_identifier(&pk_column)
        );
        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        let row: MySqlRow = conn
            .exec_first(
                query,
                Params::Positional(vec![json_to_mysql_value(&pk_value)]),
            )
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL blob lookup failed: {}", e)))?
            .ok_or_else(|| {
                Error::Any(anyhow!(
                    "No row found in {} where {} matches the provided primary key",
                    qualified_table,
                    pk_column
                ))
            })?;
        match row.as_ref(0) {
            Some(MySqlValue::Bytes(bytes)) => Ok(bytes.clone()),
            _ => Ok(Vec::new()),
        }
    }

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        _cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        maintenance::truncate_table_mysql(self.pool(), &table, schema.as_deref()).await
    }

    async fn truncate_database(
        &self,
        _schema: Option<String>,
        _confirm: bool,
    ) -> Result<TruncateResult, Error> {
        Err(Error::NotImplemented(
            "WriteAdapter::truncate_database for MySQL",
        ))
    }

    async fn soft_delete_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: Option<String>,
    ) -> Result<SoftDeleteResult, Error> {
        let col = soft_delete_column.ok_or_else(|| {
            Error::InvalidInput("soft_delete_column is required for adapter dispatch".into())
        })?;
        maintenance::soft_delete_mysql(
            self.pool(),
            &table,
            schema.as_deref(),
            &pk_column,
            &pk_values,
            &col,
        )
        .await
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
            "WriteAdapter::undo_soft_delete for MySQL",
        ))
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        let schema = self.get_schema().await?;
        maintenance::dump_database_mysql(self.pool(), &schema, &output_path).await
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        let mut conn = self
            .pool()
            .get_conn()
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL connect failed: {}", e)))?;
        conn.query_drop("START TRANSACTION")
            .await
            .map_err(|e| Error::Any(anyhow!("MySQL transaction start failed: {}", e)))?;

        let mut affected_rows = 0usize;
        let result: Result<(), Error> = async {
            for stmt in &statements {
                conn.query_drop(stmt.as_str())
                    .await
                    .map_err(|e| Error::Any(anyhow!("MySQL execution failed: {}", e)))?;
                affected_rows += conn.affected_rows() as usize;
            }
            Ok(())
        }
        .await;

        if result.is_ok() {
            conn.query_drop("COMMIT")
                .await
                .map_err(|e| Error::Any(anyhow!("MySQL commit failed: {}", e)))?;
        } else {
            let _ = conn.query_drop("ROLLBACK").await;
            result?;
        }

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}
