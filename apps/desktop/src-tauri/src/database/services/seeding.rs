use std::sync::Arc;
use dashmap::DashMap;
use uuid::Uuid;
use serde::Serialize;
use fake::{Fake, Faker};
use fake::faker::lorem::en::Sentence;
use fake::faker::name::en::{FirstName, LastName, Name};
use fake::faker::internet::en::{FreeEmail, Username};
use fake::faker::boolean::en::Boolean;
use rand::Rng;

use crate::database::types::{DatabaseConnection, DatabaseSchema, ColumnInfo};
use crate::error::Error;

#[derive(Debug, Clone, Serialize)]
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
        let target_schema = schema_name.as_deref().unwrap_or("public");
        let table = schema.tables.iter()
            .find(|t| t.name == table_name && (t.schema == target_schema || t.schema.is_empty()))
            .ok_or_else(|| Error::Any(anyhow::anyhow!("Table '{}' not found", table_name)))?;

        // 4. Filter columns we can seed (skip auto-increment PKs)
        let seedable_columns: Vec<&ColumnInfo> = table.columns.iter()
            .filter(|c| !c.is_auto_increment)
            .collect();

        if seedable_columns.is_empty() {
            return Err(Error::Any(anyhow::anyhow!("No seedable columns found")));
        }

        // 5. Generate fake data
        let mut rng = rand::rng();
        let mut all_values: Vec<String> = Vec::with_capacity(count as usize);

        for _ in 0..count {
            let row_values: Vec<String> = seedable_columns.iter()
                .map(|col| generate_fake_value(col, &mut rng))
                .collect();
            all_values.push(format!("({})", row_values.join(", ")));
        }

        // 6. Build INSERT statement
        let column_names: Vec<&str> = seedable_columns.iter().map(|c| c.name.as_str()).collect();
        let qualified_table = if target_schema == "public" || target_schema.is_empty() {
            format!("\"{}\"", table_name)
        } else {
            format!("\"{}\".\"{}\"", target_schema, table_name)
        };

        // Batch inserts (100 rows per statement to avoid query size limits)
        let batch_size = 100;
        let client = conn.get_client()?;
        let mut inserted = 0u32;

        for chunk in all_values.chunks(batch_size) {
            let sql = format!(
                "INSERT INTO {} ({}) VALUES {}",
                qualified_table,
                column_names.iter().map(|n| format!("\"{}\"", n)).collect::<Vec<_>>().join(", "),
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
        return format!("'{}'", FreeEmail().fake::<String>());
    }
    if col_name_lower.contains("name") {
        if col_name_lower.contains("first") {
            return format!("'{}'", FirstName().fake::<String>());
        }
        if col_name_lower.contains("last") {
            return format!("'{}'", LastName().fake::<String>());
        }
        return format!("'{}'", Name().fake::<String>());
    }
    if col_name_lower.contains("username") || col_name_lower.contains("user_name") {
        return format!("'{}'", Username().fake::<String>());
    }

    // Type-based fallback
    if data_type_lower.contains("text") || data_type_lower.contains("varchar") || data_type_lower.contains("char") {
        let sentence: String = Sentence(3..8).fake();
        return format!("'{}'", sentence.replace('\'', "''"));
    }
    if data_type_lower.contains("int") || data_type_lower.contains("serial") {
        return rng.random_range(1..10000).to_string();
    }
    if data_type_lower.contains("bool") {
        let b: bool = Boolean(50).fake();
        return b.to_string();
    }
    if data_type_lower.contains("uuid") {
        return format!("'{}'", Uuid::new_v4());
    }
    if data_type_lower.contains("timestamp") || data_type_lower.contains("date") {
        // Random date in past year
        let days_ago = rng.random_range(1..365);
        let dt = chrono::Utc::now() - chrono::Duration::days(days_ago);
        return format!("'{}'", dt.format("%Y-%m-%d %H:%M:%S"));
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
