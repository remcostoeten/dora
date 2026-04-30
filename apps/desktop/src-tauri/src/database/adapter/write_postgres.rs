use anyhow::anyhow;
use async_trait::async_trait;

use super::read::PostgresAdapter;
use super::write::WriteAdapter;
use crate::database::adapter::DatabaseAdapter;
use crate::database::maintenance;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::{
    json_to_pg_param, pg_value_to_json, qualified_table_name, MutationResult,
};
use crate::Error;

#[async_trait]
impl WriteAdapter for PostgresAdapter {
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
            "UPDATE {} SET \"{}\" = $1 WHERE \"{}\" = $2",
            qualified_table_name(&table, schema.as_deref()),
            column,
            pk_column
        );
        let new_val_param = json_to_pg_param(&new_value);
        let pk_param = json_to_pg_param(&pk_value);
        let result = self
            .client()
            .execute(&query, &[new_val_param.as_ref(), pk_param.as_ref()])
            .await? as usize;

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

        let schema_prefix = schema
            .as_ref()
            .map(|s| format!("\"{}\".", s))
            .unwrap_or_default();

        let placeholders: Vec<String> = (1..=pk_values.len()).map(|i| format!("${}", i)).collect();
        let query = format!(
            "DELETE FROM {}\"{}\" WHERE \"{}\" IN ({})",
            schema_prefix,
            table,
            pk_column,
            placeholders.join(", ")
        );

        let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> =
            pk_values.iter().map(|v| json_to_pg_param(v)).collect();
        let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
            .iter()
            .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
            .collect();

        let total_deleted = self.client().execute(&query, &params_ref[..]).await? as usize;

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

        let schema_prefix = schema
            .as_ref()
            .map(|s| format!("\"{}\".", s))
            .unwrap_or_default();

        let columns: Vec<&String> = row_data.keys().collect();
        let col_names: String = columns
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders: String = (1..=row_data.len())
            .map(|i| format!("${}", i))
            .collect::<Vec<_>>()
            .join(", ");

        let query = format!(
            "INSERT INTO {}\"{}\" ({}) VALUES ({})",
            schema_prefix, table, col_names, placeholders
        );

        let params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> =
            row_data.values().map(|v| json_to_pg_param(v)).collect();
        let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
            .iter()
            .map(|p| p.as_ref() as &(dyn tokio_postgres::types::ToSql + Sync))
            .collect();

        let rows = self.client().execute(&query, &params_ref[..]).await?;
        Ok(MutationResult {
            success: true,
            affected_rows: rows as usize,
            message: Some(format!("Inserted {} row(s)", rows)),
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
            "SELECT * FROM {} WHERE \"{}\" = $1 LIMIT 1",
            qualified_table_name(&table, schema.as_deref()),
            pk_column
        );
        let pk_param = json_to_pg_param(&pk_value);
        let row = self
            .client()
            .query_opt(&query, &[pk_param.as_ref()])
            .await?
            .ok_or_else(|| {
                Error::Any(anyhow!(
                    "No row found in {} where {} matches the provided primary key",
                    qualified_table_name(&table, schema.as_deref()),
                    pk_column
                ))
            })?;

        let mut data = serde_json::Map::new();
        for (idx, column) in row.columns().iter().enumerate() {
            data.insert(column.name().to_string(), pg_value_to_json(&row, idx));
        }
        data.remove(&pk_column);

        if data.is_empty() {
            return Err(Error::Any(anyhow!(
                "Cannot duplicate row in {} because only the primary key column is available",
                qualified_table_name(&table, schema.as_deref())
            )));
        }

        self.insert_row(table, schema, data).await
    }

    async fn truncate_table(
        &self,
        table: String,
        schema: Option<String>,
        cascade: Option<bool>,
    ) -> Result<TruncateResult, Error> {
        maintenance::truncate_table_postgres(
            self.client(),
            &table,
            schema.as_deref(),
            cascade.unwrap_or(false),
        )
        .await
    }

    async fn truncate_database(
        &self,
        schema: Option<String>,
        confirm: bool,
    ) -> Result<TruncateResult, Error> {
        maintenance::truncate_database_postgres(self.client(), schema.as_deref(), confirm).await
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
        maintenance::soft_delete_postgres(
            self.client(),
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
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
        soft_delete_column: String,
    ) -> Result<MutationResult, Error> {
        let affected = maintenance::undo_soft_delete_postgres(
            self.client(),
            &table,
            schema.as_deref(),
            &pk_column,
            &pk_values,
            &soft_delete_column,
        )
        .await?;

        Ok(MutationResult {
            success: affected > 0,
            affected_rows: affected,
            message: Some(format!("Restored {} row(s)", affected)),
        })
    }

    async fn dump_database(&self, output_path: String) -> Result<DumpResult, Error> {
        let schema = self.get_schema().await?;
        maintenance::dump_database_postgres(self.client(), &schema, &output_path).await
    }

    async fn execute_batch(&self, statements: Vec<String>) -> Result<MutationResult, Error> {
        if statements.is_empty() {
            return Ok(MutationResult {
                success: true,
                affected_rows: 0,
                message: Some("No statements to execute".to_string()),
            });
        }

        let mut affected_rows = 0usize;
        self.client().execute("BEGIN", &[]).await?;
        let result: Result<(), Error> = async {
            for stmt in &statements {
                let rows = self.client().execute(stmt.as_str(), &[]).await?;
                affected_rows += rows as usize;
            }
            Ok(())
        }
        .await;

        if result.is_ok() {
            self.client().execute("COMMIT", &[]).await?;
        } else {
            let _ = self.client().execute("ROLLBACK", &[]).await;
            result?;
        }

        Ok(MutationResult {
            success: true,
            affected_rows,
            message: Some(format!("Executed {} statements", statements.len())),
        })
    }
}
