use anyhow::anyhow;
use async_trait::async_trait;

use super::read::PostgresAdapter;
use super::write::{
    duplicate_rows_in_order, insert_rows_concurrently, update_cells_concurrently, WriteAdapter,
};
use crate::database::adapter::DatabaseAdapter;
use crate::database::ident::quote_ansi;
use crate::database::maintenance;
use crate::database::maintenance::{DumpResult, SoftDeleteResult, TruncateResult};
use crate::database::services::mutation::{
    json_to_pg_text, pg_column_type, qualified_table_name, CellUpdate, MutationResult,
};
use crate::Error;

#[async_trait]
impl WriteAdapter for PostgresAdapter {
    async fn update_cells(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        cells: Vec<CellUpdate>,
    ) -> Result<MutationResult, Error> {
        self.client().batch_execute("BEGIN").await?;
        let result = update_cells_concurrently(self, table, schema, pk_column, cells).await;
        finish_transaction(self.client(), result).await
    }

    async fn insert_rows(
        &self,
        table: String,
        schema: Option<String>,
        rows: Vec<serde_json::Map<String, serde_json::Value>>,
    ) -> Result<MutationResult, Error> {
        self.client().batch_execute("BEGIN").await?;
        let result = insert_rows_concurrently(self, table, schema, rows).await;
        finish_transaction(self.client(), result).await
    }

    async fn duplicate_rows(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_values: Vec<serde_json::Value>,
    ) -> Result<MutationResult, Error> {
        self.client().batch_execute("BEGIN").await?;
        let result = duplicate_rows_in_order(self, table, schema, pk_column, pk_values).await;
        finish_transaction(self.client(), result).await
    }

    async fn update_cell(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
        new_value: serde_json::Value,
    ) -> Result<MutationResult, Error> {
        let col_type = pg_column_type(self.client(), &table, schema.as_deref(), &column).await?;
        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        let query = build_update_cell_sql(
            &table,
            schema.as_deref(),
            &column,
            &col_type,
            &pk_column,
            &pk_type,
        );
        let new_val_text = json_to_pg_text(&new_value, &col_type);
        let pk_text = json_to_pg_text(&pk_value, &pk_type);
        let result = self
            .client()
            .execute(&query, &[&new_val_text, &pk_text])
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

        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        let query = build_delete_rows_sql(
            &table,
            schema.as_deref(),
            &pk_column,
            &pk_type,
            pk_values.len(),
        );

        let params: Vec<Option<String>> = pk_values
            .iter()
            .map(|value| json_to_pg_text(value, &pk_type))
            .collect();
        let params_ref: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = params
            .iter()
            .map(|p| p as &(dyn tokio_postgres::types::ToSql + Sync))
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

        let mut col_names_vec: Vec<String> = Vec::with_capacity(row_data.len());
        let mut placeholders_vec: Vec<String> = Vec::with_capacity(row_data.len());
        let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> =
            Vec::with_capacity(row_data.len());
        for (idx, (col, value)) in row_data.iter().enumerate() {
            let col_type = pg_column_type(self.client(), &table, schema.as_deref(), col).await?;
            col_names_vec.push(quote_ansi(col));
            placeholders_vec.push(format!("${}::text::{}", idx + 1, col_type));
            params.push(Box::new(json_to_pg_text(value, &col_type)));
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
        let columns =
            pg_copyable_columns(self.client(), &table, schema.as_deref(), &pk_column).await?;
        if columns.is_empty() {
            return Err(Error::Any(anyhow!(
                "Cannot duplicate row in {} because only the primary key column is available",
                qualified_table_name(&table, schema.as_deref())
            )));
        }
        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        let query =
            build_duplicate_row_sql(&table, schema.as_deref(), &columns, &pk_column, &pk_type);
        let pk_text = json_to_pg_text(&pk_value, &pk_type);
        let rows = self.client().execute(&query, &[&pk_text]).await? as usize;
        if rows == 0 {
            return Err(Error::Any(anyhow!(
                "No row found in {} where {} matches the provided primary key",
                qualified_table_name(&table, schema.as_deref()),
                pk_column
            )));
        }

        Ok(MutationResult {
            success: true,
            affected_rows: rows,
            message: Some(format!("Inserted {} row(s)", rows)),
        })
    }

    async fn get_blob_bytes(
        &self,
        table: String,
        schema: Option<String>,
        pk_column: String,
        pk_value: serde_json::Value,
        column: String,
    ) -> Result<Vec<u8>, Error> {
        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        let query = format!(
            "SELECT {} FROM {} WHERE {} = $1::text::{} LIMIT 1",
            quote_ansi(&column),
            qualified_table_name(&table, schema.as_deref()),
            quote_ansi(&pk_column),
            pk_type
        );
        let pk_text = json_to_pg_text(&pk_value, &pk_type);
        let row = self
            .client()
            .query_opt(&query, &[&pk_text])
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
        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        maintenance::soft_delete_postgres(
            self.client(),
            &table,
            schema.as_deref(),
            &pk_column,
            &pk_type,
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
        let pk_type = pg_column_type(self.client(), &table, schema.as_deref(), &pk_column).await?;
        let affected = maintenance::undo_soft_delete_postgres(
            self.client(),
            &table,
            schema.as_deref(),
            &pk_column,
            &pk_type,
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
    pk_type: &str,
) -> String {
    format!(
        "UPDATE {} SET {} = $1::text::{} WHERE {} = $2::text::{}",
        qualified_table_name(table, schema),
        quote_ansi(column),
        col_type,
        quote_ansi(pk_column),
        pk_type
    )
}

fn build_duplicate_row_sql(
    table: &str,
    schema: Option<&str>,
    columns: &[String],
    pk_column: &str,
    pk_type: &str,
) -> String {
    let column_list = columns
        .iter()
        .map(|column| quote_ansi(column))
        .collect::<Vec<_>>()
        .join(", ");
    let qualified = qualified_table_name(table, schema);
    format!(
        "INSERT INTO {qualified} ({column_list}) SELECT {column_list} FROM {qualified} WHERE {} = $1::text::{}",
        quote_ansi(pk_column),
        pk_type
    )
}

/// Lists the columns a row copy may write: everything except the key and the
/// columns Postgres computes itself (generated and `GENERATED ALWAYS` identity).
async fn pg_copyable_columns(
    client: &tokio_postgres::Client,
    table: &str,
    schema: Option<&str>,
    pk_column: &str,
) -> Result<Vec<String>, Error> {
    let schema = schema.unwrap_or("public");
    let rows = client
        .query(
            r#"
            SELECT a.attname::text
            FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = $1
              AND c.relname = $2
              AND a.attname <> $3
              AND a.attnum > 0
              AND NOT a.attisdropped
              AND a.attgenerated = ''
              AND a.attidentity <> 'a'
            ORDER BY a.attnum
            "#,
            &[&schema, &table, &pk_column],
        )
        .await?;
    Ok(rows.iter().map(|row| row.get::<_, String>(0)).collect())
}

fn build_delete_rows_sql(
    table: &str,
    schema: Option<&str>,
    pk_column: &str,
    pk_type: &str,
    pk_count: usize,
) -> String {
    let placeholders: Vec<String> = (1..=pk_count)
        .map(|i| format!("${}::text::{}", i, pk_type))
        .collect();
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

/// Commits a batch that succeeded and rolls back one that failed. The writes
/// are pipelined on the adapter's single connection, so they all land inside
/// the transaction opened just before them.
async fn finish_transaction(
    client: &tokio_postgres::Client,
    result: Result<MutationResult, Error>,
) -> Result<MutationResult, Error> {
    match result {
        Ok(result) => {
            client.batch_execute("COMMIT").await?;
            Ok(result)
        }
        Err(error) => {
            let _ = client.batch_execute("ROLLBACK").await;
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_cell_sql_quotes_identifiers_and_casts_via_text() {
        assert_eq!(
            build_update_cell_sql("users", Some("public"), "name", "text", "id", "uuid"),
            "UPDATE \"public\".\"users\" SET \"name\" = $1::text::text WHERE \"id\" = $2::text::uuid"
        );
        assert_eq!(
            build_update_cell_sql("we\"ird", None, "na\"me", "int4", "i\"d", "int4"),
            "UPDATE \"we\"\"ird\" SET \"na\"\"me\" = $1::text::int4 WHERE \"i\"\"d\" = $2::text::int4"
        );
    }

    #[test]
    fn delete_rows_sql_numbers_placeholders_and_quotes_identifiers() {
        assert_eq!(
            build_delete_rows_sql("users", None, "id", "int4", 3),
            "DELETE FROM \"users\" WHERE \"id\" IN ($1::text::int4, $2::text::int4, $3::text::int4)"
        );
        assert_eq!(
            build_delete_rows_sql("t", Some("we\"ird"), "id", "uuid", 1),
            "DELETE FROM \"we\"\"ird\".\"t\" WHERE \"id\" IN ($1::text::uuid)"
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
