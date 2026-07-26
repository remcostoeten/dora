use anyhow::anyhow;
use async_trait::async_trait;

use super::read::PostgresAdapter;
use super::write::WriteAdapter;
use crate::database::adapter::DatabaseAdapter;
use crate::database::ident::quote_ansi;
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
        // Bind the new value as text and let Postgres parse it into the
        // column's type ($1::text::<type>). The UI edits cells as strings, so
        // binding straight to a typed parameter ($1::int4 etc.) makes Postgres
        // infer $1 as that type and tokio-postgres fails with
        // "error serializing parameter" when the Rust value is a String.
        // Routing through text works for ints, timestamps, bools, uuids, ….
        let col_type = pg_column_type(self.client(), &table, schema.as_deref(), &column).await?;
        let query =
            build_update_cell_sql(&table, schema.as_deref(), &column, &col_type, &pk_column);
        let new_val_text: Option<String> = match &new_value {
            serde_json::Value::Null => None,
            serde_json::Value::String(s) => Some(s.clone()),
            other => Some(other.to_string()),
        };
        let new_val_param: Box<dyn tokio_postgres::types::ToSql + Sync + Send> =
            Box::new(new_val_text);
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

        let query = build_delete_rows_sql(&table, schema.as_deref(), &pk_column, pk_values.len());

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

        // Bind every value as text and let Postgres parse it into the column's
        // type via `$n::text::<type>` — same rationale as update_cell: the UI
        // sends edits as strings, and a string bound straight to a typed param
        // (e.g. a timestamp/uuid column) makes tokio-postgres fail with
        // "error serializing parameter".
        let mut col_names_vec: Vec<String> = Vec::with_capacity(row_data.len());
        let mut placeholders_vec: Vec<String> = Vec::with_capacity(row_data.len());
        let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> =
            Vec::with_capacity(row_data.len());
        for (idx, (col, value)) in row_data.iter().enumerate() {
            let col_type = pg_column_type(self.client(), &table, schema.as_deref(), col).await?;
            col_names_vec.push(quote_ansi(col));
            placeholders_vec.push(format!("${}::text::{}", idx + 1, col_type));
            let text: Option<String> = match value {
                serde_json::Value::Null => None,
                serde_json::Value::String(s) => Some(s.clone()),
                other => Some(other.to_string()),
            };
            params.push(Box::new(text));
        }

        let query =
            build_insert_row_sql(&table, schema.as_deref(), &col_names_vec, &placeholders_vec);

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
            "SELECT * FROM {} WHERE {} = $1 LIMIT 1",
            qualified_table_name(&table, schema.as_deref()),
            quote_ansi(&pk_column)
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

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error> {
        let query = format!(
            "SELECT {} FROM {} WHERE {} = $1 LIMIT 1",
            quote_ansi(&column),
            qualified_table_name(&table, schema.as_deref()),
            quote_ansi(&pk_column)
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
        let bytes: Option<Vec<u8>> = row.try_get(0)?;
        Ok(bytes.unwrap_or_default())
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

fn build_update_cell_sql(
    table: &str,
    schema: Option<&str>,
    column: &str,
    col_type: &str,
    pk_column: &str,
) -> String {
    format!(
        "UPDATE {} SET {} = $1::text::{} WHERE {} = $2",
        qualified_table_name(table, schema),
        quote_ansi(column),
        col_type,
        quote_ansi(pk_column)
    )
}

fn build_delete_rows_sql(
    table: &str,
    schema: Option<&str>,
    pk_column: &str,
    pk_count: usize,
) -> String {
    let placeholders: Vec<String> = (1..=pk_count).map(|i| format!("${}", i)).collect();
    format!(
        "DELETE FROM {} WHERE {} IN ({})",
        qualified_table_name(table, schema),
        quote_ansi(pk_column),
        placeholders.join(", ")
    )
}

fn build_insert_row_sql(
    table: &str,
    schema: Option<&str>,
    quoted_columns: &[String],
    placeholders: &[String],
) -> String {
    format!(
        "INSERT INTO {} ({}) VALUES ({})",
        qualified_table_name(table, schema),
        quoted_columns.join(", "),
        placeholders.join(", ")
    )
}

async fn pg_column_type(
    client: &tokio_postgres::Client,
    table: &str,
    schema: Option<&str>,
    column: &str,
) -> Result<String, Error> {
    let schema = schema.unwrap_or("public");
    let row = client
        .query_opt(
            r#"
            SELECT format_type(a.atttypid, a.atttypmod)
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relname = $2
              AND a.attname = $3
              AND a.attnum > 0
              AND NOT a.attisdropped
            "#,
            &[&schema, &table, &column],
        )
        .await?;

    let Some(row) = row else {
        return Ok("text".to_string());
    };

    Ok(row.get::<_, String>(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_cell_sql_quotes_identifiers_and_casts_via_text() {
        assert_eq!(
            build_update_cell_sql("users", Some("public"), "name", "text", "id"),
            "UPDATE \"public\".\"users\" SET \"name\" = $1::text::text WHERE \"id\" = $2"
        );
        assert_eq!(
            build_update_cell_sql("we\"ird", None, "na\"me", "int4", "i\"d"),
            "UPDATE \"we\"\"ird\" SET \"na\"\"me\" = $1::text::int4 WHERE \"i\"\"d\" = $2"
        );
    }

    #[test]
    fn delete_rows_sql_numbers_placeholders_and_quotes_identifiers() {
        assert_eq!(
            build_delete_rows_sql("users", None, "id", 3),
            "DELETE FROM \"users\" WHERE \"id\" IN ($1, $2, $3)"
        );
        assert_eq!(
            build_delete_rows_sql("t", Some("we\"ird"), "id", 1),
            "DELETE FROM \"we\"\"ird\".\"t\" WHERE \"id\" IN ($1)"
        );
    }

    #[test]
    fn insert_row_sql_joins_prequoted_columns() {
        let cols = vec![quote_ansi("a"), quote_ansi("b\"b")];
        let placeholders = vec!["$1::text::text".to_string(), "$2::text::int4".to_string()];
        assert_eq!(
            build_insert_row_sql("users", Some("public"), &cols, &placeholders),
            "INSERT INTO \"public\".\"users\" (\"a\", \"b\"\"b\") VALUES ($1::text::text, $2::text::int4)"
        );
    }
}
