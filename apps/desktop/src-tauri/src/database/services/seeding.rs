use std::sync::Arc;
use dashmap::DashMap;
use mysql_async::prelude::Queryable;
use uuid::Uuid;
use serde::Serialize;
use fake::Fake;
use fake::faker::lorem::en::Sentence;
use fake::faker::name::en::{FirstName, LastName, Name};
use fake::faker::internet::en::{FreeEmail, Username};
use fake::faker::boolean::en::Boolean;
use rand::Rng;

use crate::database::types::{DatabaseConnection, DatabaseSchema, ColumnInfo};
use crate::error::Error;

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct SeedResult {
    pub rows_inserted: u32,
    pub table: String,
}

pub struct SeedingService<'a> {
    pub connections: &'a DashMap<Uuid, DatabaseConnection>,
    pub schemas: &'a DashMap<Uuid, Arc<DatabaseSchema>>,
}

impl<'a> SeedingService<'a> {
    pub async fn seed_table(
        &self,
        connection_id: Uuid,
        table_name: String,
        schema_name: Option<String>,
        count: u32,
    ) -> Result<SeedResult, Error> {
        // 1. Get connection
        let conn = self.connections.get(&connection_id)
            .ok_or_else(|| Error::Any(anyhow::anyhow!("Connection not found")))?;

        // 2. Get schema for this connection
        let schema = self.schemas.get(&connection_id)
            .ok_or_else(|| Error::Any(anyhow::anyhow!("Schema not loaded for this connection")))?;

        // 3. Find the target table
        let table = schema.tables.iter()
            .find(|t| table_matches_schema(&t.schema, schema_name.as_deref()) && t.name == table_name)
            .ok_or_else(|| Error::Any(anyhow::anyhow!("Table '{}' not found", table_name)))?;

        // 4. Filter columns we can seed (skip auto-increment PKs)
        let seedable_columns: Vec<&ColumnInfo> = table.columns.iter()
            .filter(|c| !c.is_auto_increment)
            .collect();

        if seedable_columns.is_empty() {
            return Err(Error::Any(anyhow::anyhow!("No seedable columns found")));
        }

        // 5. Generate fake data
        let all_values = {
            let mut rng = rand::rng();
            let mut values = Vec::with_capacity(count as usize);

            for _ in 0..count {
                let row_values: Vec<String> = seedable_columns.iter()
                    .map(|col| generate_fake_value(col, &mut rng))
                    .collect();
                values.push(format!("({})", row_values.join(", ")));
            }
            values
        };

        let client = conn.get_client()?;
        let (identifier_quote, qualified_table) =
            seed_target_for_client(&client, &table.name, &table.schema, schema_name.as_deref());
        let column_names: Vec<String> = seedable_columns
            .iter()
            .map(|c| quote_identifier(&c.name, identifier_quote))
            .collect();
        let column_list = column_names.join(", ");

        // Batch inserts (100 rows per statement to avoid query size limits)
        let batch_size = 100;
        let mut inserted = 0u32;

        for chunk in all_values.chunks(batch_size) {
            let sql = format!(
                "INSERT INTO {} ({}) VALUES {}",
                qualified_table,
                column_list,
                chunk.join(", ")
            );

            match &client {
                crate::database::types::DatabaseClient::Postgres { client } => {
                    client.execute(&sql, &[]).await
                        .map_err(|e| Error::Any(anyhow::anyhow!("Postgres insert failed: {}", e)))?;
                }
                crate::database::types::DatabaseClient::SQLite { connection } => {
                    let conn = connection.lock().map_err(|e| Error::Any(anyhow::anyhow!("SQLite lock failed: {}", e)))?;
                    conn.execute(&sql, [])
                        .map_err(|e| Error::Any(anyhow::anyhow!("SQLite insert failed: {}", e)))?;
                }
                crate::database::types::DatabaseClient::LibSQL { connection } => {
                    connection.execute(&sql, ())
                        .await
                        .map_err(|e| Error::Any(anyhow::anyhow!("LibSQL insert failed: {}", e)))?;
                }
                crate::database::types::DatabaseClient::MySQL { pool } => {
                    let mut mysql_conn = pool
                        .get_conn()
                        .await
                        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;
                    mysql_conn
                        .query_drop(sql)
                        .await
                        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL insert failed: {}", e)))?;
                }
            }
            inserted += chunk.len() as u32;
        }

        Ok(SeedResult {
            rows_inserted: inserted,
            table: table_name,
        })
    }
}

fn generate_fake_value<R: Rng>(col: &ColumnInfo, rng: &mut R) -> String {
    let col_name_lower = col.name.to_lowercase();
    let data_type_lower = col.data_type.to_lowercase();

    // Name-based heuristics first
    if col_name_lower.contains("email") {
        return sql_string_literal(&FreeEmail().fake::<String>());
    }
    if col_name_lower.contains("name") {
        if col_name_lower.contains("first") {
            return sql_string_literal(&FirstName().fake::<String>());
        }
        if col_name_lower.contains("last") {
            return sql_string_literal(&LastName().fake::<String>());
        }
        return sql_string_literal(&Name().fake::<String>());
    }
    if col_name_lower.contains("username") || col_name_lower.contains("user_name") {
        return sql_string_literal(&Username().fake::<String>());
    }

    // Type-based fallback
    if data_type_lower.contains("text") || data_type_lower.contains("varchar") || data_type_lower.contains("char") {
        let sentence: String = Sentence(3..8).fake();
        return sql_string_literal(&sentence);
    }
    if data_type_lower.contains("int") || data_type_lower.contains("serial") {
        return rng.random_range(1..10000).to_string();
    }
    if data_type_lower.contains("bool") {
        let b: bool = Boolean(50).fake();
        return b.to_string();
    }
    if data_type_lower.contains("uuid") {
        return sql_string_literal(&Uuid::new_v4().to_string());
    }
    if data_type_lower.contains("timestamp") || data_type_lower.contains("date") {
        // Random date in past year
        let days_ago = rng.random_range(1..365);
        let dt = chrono::Utc::now() - chrono::Duration::days(days_ago);
        return sql_string_literal(&dt.format("%Y-%m-%d %H:%M:%S").to_string());
    }
    if data_type_lower.contains("float") || data_type_lower.contains("double") || data_type_lower.contains("numeric") || data_type_lower.contains("decimal") {
        let val: f64 = rng.random_range(0.0..1000.0);
        return format!("{:.2}", val);
    }

    // Default: NULL or empty string
    if col.is_nullable {
        "NULL".to_string()
    } else {
        "''".to_string()
    }
}

fn table_matches_schema(table_schema: &str, requested_schema: Option<&str>) -> bool {
    requested_schema.is_none() || table_schema == requested_schema.unwrap_or_default() || table_schema.is_empty()
}

fn seed_target_for_client(
    client: &crate::database::types::DatabaseClient,
    table_name: &str,
    table_schema: &str,
    requested_schema: Option<&str>,
) -> (char, String) {
    let quote = match client {
        crate::database::types::DatabaseClient::MySQL { .. } => '`',
        _ => '"',
    };

    let schema = requested_schema
        .filter(|schema| !schema.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            if table_schema.is_empty() {
                None
            } else {
                Some(table_schema.to_owned())
            }
        })
        .or_else(|| match client {
            crate::database::types::DatabaseClient::Postgres { .. } => Some("public".to_string()),
            _ => None,
        });

    let qualified_table = match schema {
        Some(schema_name) => format!(
            "{}.{}",
            quote_identifier(&schema_name, quote),
            quote_identifier(table_name, quote)
        ),
        None => quote_identifier(table_name, quote),
    };

    (quote, qualified_table)
}

fn quote_identifier(identifier: &str, quote: char) -> String {
    format!("{quote}{identifier}{quote}")
}

fn sql_string_literal(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table(name: &str, schema: &str) -> crate::database::types::TableInfo {
        crate::database::types::TableInfo {
            name: name.to_string(),
            schema: schema.to_string(),
            columns: vec![],
            primary_key_columns: vec![],
            indexes: vec![],
            row_count_estimate: None,
        }
    }

    #[test]
    fn mysql_schema_matches_requested_schema() {
        assert!(table_matches_schema("analytics", Some("analytics")));
        assert!(table_matches_schema("", Some("analytics")));
        assert!(!table_matches_schema("sales", Some("analytics")));
        assert!(table_matches_schema("analytics", None));
    }

    #[test]
    fn mysql_seed_target_uses_backticks() {
        let client = crate::database::types::DatabaseClient::MySQL {
            pool: Arc::new(mysql_async::Pool::new(
                mysql_async::Opts::from_url("mysql://user:pass@localhost:3306/db").unwrap(),
            )),
        };

        let (_, qualified) = seed_target_for_client(&client, "users", "tenant_a", None);
        assert_eq!(qualified, "`tenant_a`.`users`");

        let (_, explicit) = seed_target_for_client(&client, "users", "tenant_a", Some("tenant_b"));
        assert_eq!(explicit, "`tenant_b`.`users`");
    }

    #[test]
    fn sql_string_literals_escape_quotes() {
        assert_eq!(sql_string_literal("O'Reilly"), "'O''Reilly'");
    }
}
