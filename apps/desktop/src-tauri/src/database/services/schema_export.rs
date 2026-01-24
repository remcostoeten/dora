//! Schema export service for generating SQL DDL and Drizzle ORM schemas.
//!
//! Supports exporting to:
//! - SQL DDL (PostgreSQL or SQLite dialect)
//! - Drizzle ORM TypeScript (PostgreSQL or SQLite dialect)

use std::sync::Arc;
use dashmap::DashMap;
use uuid::Uuid;
use anyhow::Context;
use serde::{Deserialize, Serialize};

use crate::{
    database::types::{ColumnInfo, DatabaseSchema, TableInfo},
    Error,
};

/// SQL dialect for export
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ExportDialect {
    PostgreSQL,
    SQLite,
}

impl TryFrom<&str> for ExportDialect {
    type Error = Error;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "postgresql" | "postgres" | "pg" => Ok(ExportDialect::PostgreSQL),
            "sqlite" | "sqlite3" => Ok(ExportDialect::SQLite),
            _ => Err(Error::Any(anyhow::anyhow!(
                "Unknown dialect: {}. Expected 'postgresql' or 'sqlite'",
                value
            ))),
        }
    }
}

/// Service for exporting database schemas
pub struct SchemaExportService<'a> {
    pub schemas: &'a DashMap<Uuid, Arc<DatabaseSchema>>,
}

impl<'a> SchemaExportService<'a> {
    /// Export schema to SQL DDL format
    pub fn export_to_sql(
        &self,
        connection_id: Uuid,
        dialect: ExportDialect,
    ) -> Result<String, Error> {
        let schema = self
            .schemas
            .get(&connection_id)
            .with_context(|| format!("Schema not loaded for connection: {}", connection_id))?;

        Ok(SqlGenerator::new(dialect).generate(&schema))
    }

    /// Export schema to Drizzle ORM format
    pub fn export_to_drizzle(
        &self,
        connection_id: Uuid,
        dialect: ExportDialect,
    ) -> Result<String, Error> {
        let schema = self
            .schemas
            .get(&connection_id)
            .with_context(|| format!("Schema not loaded for connection: {}", connection_id))?;

        Ok(DrizzleGenerator::new(dialect).generate(&schema))
    }
}

// =============================================================================
// SQL DDL Generator
// =============================================================================

struct SqlGenerator {
    dialect: ExportDialect,
}

impl SqlGenerator {
    fn new(dialect: ExportDialect) -> Self {
        Self { dialect }
    }

    fn generate(&self, schema: &DatabaseSchema) -> String {
        let mut output = String::new();
        let mut foreign_keys: Vec<String> = Vec::new();

        // Header comment
        output.push_str(&format!(
            "-- Generated SQL DDL ({} dialect)\n",
            match self.dialect {
                ExportDialect::PostgreSQL => "PostgreSQL",
                ExportDialect::SQLite => "SQLite",
            }
        ));
        output.push_str(&format!(
            "-- Generated at: {}\n\n",
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
        ));

        // Generate CREATE TABLE statements
        for table in &schema.tables {
            output.push_str(&self.generate_create_table(table, &mut foreign_keys));
            output.push_str("\n\n");
        }

        // For PostgreSQL, add ALTER TABLE for foreign keys (better for ordering)
        if self.dialect == ExportDialect::PostgreSQL && !foreign_keys.is_empty() {
            output.push_str("-- Foreign Key Constraints\n");
            for fk in foreign_keys {
                output.push_str(&fk);
                output.push_str("\n");
            }
        }

        output.trim_end().to_string()
    }

    fn generate_create_table(&self, table: &TableInfo, foreign_keys: &mut Vec<String>) -> String {
        let mut output = String::new();
        let table_name = self.quote_identifier(&table.name);
        let qualified_name = if !table.schema.is_empty() && table.schema != "public" {
            format!("{}.{}", self.quote_identifier(&table.schema), table_name)
        } else {
            table_name.clone()
        };

        output.push_str(&format!("CREATE TABLE {} (\n", qualified_name));

        let mut column_defs: Vec<String> = Vec::new();

        for column in &table.columns {
            column_defs.push(self.generate_column_def(column, table, foreign_keys));
        }

        // Add PRIMARY KEY constraint for composite keys
        if table.primary_key_columns.len() > 1 {
            let pk_cols: Vec<String> = table
                .primary_key_columns
                .iter()
                .map(|c| self.quote_identifier(c))
                .collect();
            column_defs.push(format!("    PRIMARY KEY ({})", pk_cols.join(", ")));
        }

        // For SQLite, add inline FOREIGN KEY constraints
        if self.dialect == ExportDialect::SQLite {
            for column in &table.columns {
                if let Some(fk) = &column.foreign_key {
                    column_defs.push(format!(
                        "    FOREIGN KEY ({}) REFERENCES {}({})",
                        self.quote_identifier(&column.name),
                        self.quote_identifier(&fk.referenced_table),
                        self.quote_identifier(&fk.referenced_column)
                    ));
                }
            }
        }

        output.push_str(&column_defs.join(",\n"));
        output.push_str("\n);");

        output
    }

    fn generate_column_def(
        &self,
        column: &ColumnInfo,
        table: &TableInfo,
        foreign_keys: &mut Vec<String>,
    ) -> String {
        let mut parts: Vec<String> = Vec::new();

        // Column name
        parts.push(format!("    {}", self.quote_identifier(&column.name)));

        // Data type
        parts.push(self.map_data_type(&column.data_type, column));

        // PRIMARY KEY (for single-column PKs only)
        let is_single_pk =
            table.primary_key_columns.len() == 1 && column.is_primary_key;
        if is_single_pk {
            if self.dialect == ExportDialect::SQLite && column.is_auto_increment {
                // SQLite: INTEGER PRIMARY KEY implies AUTOINCREMENT behavior
                parts.push("PRIMARY KEY".to_string());
            } else if self.dialect == ExportDialect::PostgreSQL {
                parts.push("PRIMARY KEY".to_string());
            }
        }

        // NOT NULL (skip for primary keys as they're implicitly NOT NULL)
        if !column.is_nullable && !is_single_pk {
            parts.push("NOT NULL".to_string());
        }

        // DEFAULT value
        if let Some(default) = &column.default_value {
            // Skip nextval defaults for PostgreSQL SERIAL types
            if !(self.dialect == ExportDialect::PostgreSQL
                && default.to_lowercase().starts_with("nextval"))
            {
                parts.push(format!("DEFAULT {}", self.map_default_value(default)));
            }
        }

        // Collect foreign keys for PostgreSQL (added as ALTER TABLE later)
        if self.dialect == ExportDialect::PostgreSQL {
            if let Some(fk) = &column.foreign_key {
                let constraint_name = format!(
                    "{}_{}_fkey",
                    table.name.to_lowercase(),
                    column.name.to_lowercase()
                );
                let qualified_ref = if !fk.referenced_schema.is_empty()
                    && fk.referenced_schema != "public"
                {
                    format!(
                        "{}.{}",
                        self.quote_identifier(&fk.referenced_schema),
                        self.quote_identifier(&fk.referenced_table)
                    )
                } else {
                    self.quote_identifier(&fk.referenced_table)
                };

                foreign_keys.push(format!(
                    "ALTER TABLE {} ADD CONSTRAINT {} FOREIGN KEY ({}) REFERENCES {}({});",
                    if !table.schema.is_empty() && table.schema != "public" {
                        format!(
                            "{}.{}",
                            self.quote_identifier(&table.schema),
                            self.quote_identifier(&table.name)
                        )
                    } else {
                        self.quote_identifier(&table.name)
                    },
                    self.quote_identifier(&constraint_name),
                    self.quote_identifier(&column.name),
                    qualified_ref,
                    self.quote_identifier(&fk.referenced_column)
                ));
            }
        }

        parts.join(" ")
    }

    fn map_data_type(&self, data_type: &str, column: &ColumnInfo) -> String {
        let dt_lower = data_type.to_lowercase();

        match self.dialect {
            ExportDialect::PostgreSQL => {
                // Handle SERIAL types for auto-increment
                if column.is_auto_increment && column.is_primary_key {
                    if dt_lower.contains("int") {
                        return "SERIAL".to_string();
                    }
                    if dt_lower.contains("bigint") {
                        return "BIGSERIAL".to_string();
                    }
                }
                // Return as-is for PostgreSQL
                data_type.to_uppercase()
            }
            ExportDialect::SQLite => {
                // Map PostgreSQL types to SQLite
                if dt_lower.contains("int") {
                    "INTEGER".to_string()
                } else if dt_lower.contains("char")
                    || dt_lower.contains("text")
                    || dt_lower.contains("varchar")
                    || dt_lower.contains("uuid")
                {
                    "TEXT".to_string()
                } else if dt_lower.contains("float")
                    || dt_lower.contains("double")
                    || dt_lower.contains("real")
                    || dt_lower.contains("numeric")
                    || dt_lower.contains("decimal")
                {
                    "REAL".to_string()
                } else if dt_lower.contains("bool") {
                    "INTEGER".to_string() // SQLite uses 0/1
                } else if dt_lower.contains("blob") || dt_lower.contains("bytea") {
                    "BLOB".to_string()
                } else if dt_lower.contains("date")
                    || dt_lower.contains("time")
                    || dt_lower.contains("timestamp")
                {
                    "TEXT".to_string() // SQLite stores dates as TEXT
                } else if dt_lower.contains("json") {
                    "TEXT".to_string()
                } else {
                    "TEXT".to_string() // Default fallback
                }
            }
        }
    }

    fn map_default_value(&self, default: &str) -> String {
        let lower = default.to_lowercase();

        // Handle common defaults
        if lower == "now()" || lower == "current_timestamp" {
            match self.dialect {
                ExportDialect::PostgreSQL => "NOW()".to_string(),
                ExportDialect::SQLite => "CURRENT_TIMESTAMP".to_string(),
            }
        } else if lower == "true" || lower == "false" {
            match self.dialect {
                ExportDialect::PostgreSQL => default.to_uppercase(),
                ExportDialect::SQLite => {
                    if lower == "true" {
                        "1".to_string()
                    } else {
                        "0".to_string()
                    }
                }
            }
        } else {
            default.to_string()
        }
    }

    fn quote_identifier(&self, name: &str) -> String {
        format!("\"{}\"", name)
    }
}

// =============================================================================
// Drizzle ORM Generator
// =============================================================================

struct DrizzleGenerator {
    dialect: ExportDialect,
}

impl DrizzleGenerator {
    fn new(dialect: ExportDialect) -> Self {
        Self { dialect }
    }

    fn generate(&self, schema: &DatabaseSchema) -> String {
        let mut output = String::new();

        // Import statements
        output.push_str(&self.generate_imports(schema));
        output.push('\n');

        // Generate table definitions
        for table in &schema.tables {
            output.push_str(&self.generate_table(table, schema));
            output.push_str("\n\n");
        }

        output.trim_end().to_string()
    }

    fn generate_imports(&self, schema: &DatabaseSchema) -> String {
        let mut types: std::collections::HashSet<&str> = std::collections::HashSet::new();

        // Collect all types needed
        for table in &schema.tables {
            for column in &table.columns {
                types.insert(self.get_drizzle_type(&column.data_type, column));
                if column.foreign_key.is_some() {
                    // Will need references
                }
            }
        }

        let (module, table_fn) = match self.dialect {
            ExportDialect::PostgreSQL => ("drizzle-orm/pg-core", "pgTable"),
            ExportDialect::SQLite => ("drizzle-orm/sqlite-core", "sqliteTable"),
        };

        let mut type_list: Vec<&str> = types.into_iter().collect();
        type_list.sort();

        format!(
            "import {{ {}, {} }} from '{}';\n",
            table_fn,
            type_list.join(", "),
            module
        )
    }

    fn generate_table(&self, table: &TableInfo, _schema: &DatabaseSchema) -> String {
        let mut output = String::new();
        let table_fn = match self.dialect {
            ExportDialect::PostgreSQL => "pgTable",
            ExportDialect::SQLite => "sqliteTable",
        };

        let var_name = self.to_camel_case(&table.name);

        output.push_str(&format!(
            "export const {} = {}('{}', {{\n",
            var_name, table_fn, table.name
        ));

        let column_defs: Vec<String> = table
            .columns
            .iter()
            .map(|col| self.generate_column(col, table))
            .collect();

        output.push_str(&column_defs.join(",\n"));
        output.push_str("\n});");

        output
    }

    fn generate_column(&self, column: &ColumnInfo, table: &TableInfo) -> String {
        let field_name = self.to_camel_case(&column.name);
        let drizzle_type = self.get_drizzle_type(&column.data_type, column);

        let mut chain = format!(
            "  {}: {}('{}')",
            field_name, drizzle_type, column.name
        );

        // Add type-specific options
        if drizzle_type == "varchar" {
            chain = format!(
                "  {}: {}('{}', {{ length: 255 }})",
                field_name, drizzle_type, column.name
            );
        }

        // Primary key
        let is_single_pk = table.primary_key_columns.len() == 1 && column.is_primary_key;
        if is_single_pk {
            if self.dialect == ExportDialect::SQLite && column.is_auto_increment {
                chain.push_str(".primaryKey({ autoIncrement: true })");
            } else {
                chain.push_str(".primaryKey()");
            }
        }

        // Not null
        if !column.is_nullable && !is_single_pk {
            chain.push_str(".notNull()");
        }

        // Default value
        if let Some(default) = &column.default_value {
            let lower = default.to_lowercase();
            if lower == "now()" || lower.contains("current_timestamp") {
                chain.push_str(".defaultNow()");
            } else if !lower.starts_with("nextval") {
                // Skip serial/sequence defaults
                chain.push_str(&format!(".default({})", self.map_drizzle_default(default)));
            }
        }

        // Foreign key reference
        if let Some(fk) = &column.foreign_key {
            let ref_table = self.to_camel_case(&fk.referenced_table);
            let ref_col = self.to_camel_case(&fk.referenced_column);
            chain.push_str(&format!(".references(() => {}.{})", ref_table, ref_col));
        }

        chain
    }

    fn get_drizzle_type(&self, data_type: &str, column: &ColumnInfo) -> &'static str {
        let dt_lower = data_type.to_lowercase();

        match self.dialect {
            ExportDialect::PostgreSQL => {
                if column.is_auto_increment && dt_lower.contains("int") {
                    return "serial";
                }
                if column.is_auto_increment && dt_lower.contains("bigint") {
                    return "bigserial";
                }

                if dt_lower.contains("serial") {
                    "serial"
                } else if dt_lower.contains("bigint") {
                    "bigint"
                } else if dt_lower.contains("smallint") {
                    "smallint"
                } else if dt_lower.contains("int") {
                    "integer"
                } else if dt_lower.contains("varchar") || dt_lower.contains("character varying") {
                    "varchar"
                } else if dt_lower.contains("text") {
                    "text"
                } else if dt_lower.contains("bool") {
                    "boolean"
                } else if dt_lower.contains("timestamp") {
                    "timestamp"
                } else if dt_lower.contains("date") {
                    "date"
                } else if dt_lower.contains("time") {
                    "time"
                } else if dt_lower.contains("uuid") {
                    "uuid"
                } else if dt_lower.contains("json") {
                    "json"
                } else if dt_lower.contains("numeric") || dt_lower.contains("decimal") {
                    "numeric"
                } else if dt_lower.contains("real") || dt_lower.contains("float4") {
                    "real"
                } else if dt_lower.contains("double") || dt_lower.contains("float8") {
                    "doublePrecision"
                } else {
                    "text"
                }
            }
            ExportDialect::SQLite => {
                if dt_lower.contains("int") {
                    "integer"
                } else if dt_lower.contains("real")
                    || dt_lower.contains("float")
                    || dt_lower.contains("double")
                {
                    "real"
                } else if dt_lower.contains("blob") {
                    "blob"
                } else {
                    "text"
                }
            }
        }
    }

    fn map_drizzle_default(&self, default: &str) -> String {
        let lower = default.to_lowercase();

        if lower == "true" {
            "true".to_string()
        } else if lower == "false" {
            "false".to_string()
        } else if lower.starts_with('\'') && lower.ends_with('\'') {
            // String literal
            default.to_string()
        } else if lower.parse::<f64>().is_ok() {
            // Numeric literal
            default.to_string()
        } else {
            format!("'{}'", default)
        }
    }

    fn to_camel_case(&self, name: &str) -> String {
        let mut result = String::new();
        let mut capitalize_next = false;

        for (i, ch) in name.chars().enumerate() {
            if ch == '_' || ch == '-' {
                capitalize_next = true;
            } else if capitalize_next {
                result.push(ch.to_ascii_uppercase());
                capitalize_next = false;
            } else if i == 0 {
                result.push(ch.to_ascii_lowercase());
            } else {
                result.push(ch);
            }
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_schema() -> DatabaseSchema {
        DatabaseSchema {
            tables: vec![
                TableInfo {
                    name: "users".to_string(),
                    schema: "public".to_string(),
                    columns: vec![
                        ColumnInfo {
                            name: "id".to_string(),
                            data_type: "integer".to_string(),
                            is_nullable: false,
                            default_value: Some("nextval('users_id_seq')".to_string()),
                            is_primary_key: true,
                            is_auto_increment: true,
                            foreign_key: None,
                        },
                        ColumnInfo {
                            name: "email".to_string(),
                            data_type: "character varying".to_string(),
                            is_nullable: false,
                            default_value: None,
                            is_primary_key: false,
                            is_auto_increment: false,
                            foreign_key: None,
                        },
                        ColumnInfo {
                            name: "name".to_string(),
                            data_type: "text".to_string(),
                            is_nullable: true,
                            default_value: None,
                            is_primary_key: false,
                            is_auto_increment: false,
                            foreign_key: None,
                        },
                    ],
                    primary_key_columns: vec!["id".to_string()],
                    row_count_estimate: Some(100),
                },
                TableInfo {
                    name: "posts".to_string(),
                    schema: "public".to_string(),
                    columns: vec![
                        ColumnInfo {
                            name: "id".to_string(),
                            data_type: "integer".to_string(),
                            is_nullable: false,
                            default_value: None,
                            is_primary_key: true,
                            is_auto_increment: true,
                            foreign_key: None,
                        },
                        ColumnInfo {
                            name: "author_id".to_string(),
                            data_type: "integer".to_string(),
                            is_nullable: false,
                            default_value: None,
                            is_primary_key: false,
                            is_auto_increment: false,
                            foreign_key: Some(ForeignKeyInfo {
                                referenced_table: "users".to_string(),
                                referenced_column: "id".to_string(),
                                referenced_schema: "public".to_string(),
                            }),
                        },
                    ],
                    primary_key_columns: vec!["id".to_string()],
                    row_count_estimate: None,
                },
            ],
            schemas: vec!["public".to_string()],
            unique_columns: vec!["id".to_string(), "email".to_string(), "name".to_string()],
        }
    }

    #[test]
    fn test_sql_postgres_generation() {
        let schema = sample_schema();
        let generator = SqlGenerator::new(ExportDialect::PostgreSQL);
        let sql = generator.generate(&schema);

        assert!(sql.contains("CREATE TABLE"));
        assert!(sql.contains("SERIAL"));
        assert!(sql.contains("PRIMARY KEY"));
        assert!(sql.contains("NOT NULL"));
        assert!(sql.contains("ALTER TABLE"));
        assert!(sql.contains("FOREIGN KEY"));
    }

    #[test]
    fn test_sql_sqlite_generation() {
        let schema = sample_schema();
        let generator = SqlGenerator::new(ExportDialect::SQLite);
        let sql = generator.generate(&schema);

        assert!(sql.contains("CREATE TABLE"));
        assert!(sql.contains("INTEGER"));
        assert!(sql.contains("TEXT"));
        assert!(sql.contains("PRIMARY KEY"));
        assert!(sql.contains("FOREIGN KEY"));
    }

    #[test]
    fn test_drizzle_postgres_generation() {
        let schema = sample_schema();
        let generator = DrizzleGenerator::new(ExportDialect::PostgreSQL);
        let drizzle = generator.generate(&schema);

        assert!(drizzle.contains("import"));
        assert!(drizzle.contains("pgTable"));
        assert!(drizzle.contains("serial"));
        assert!(drizzle.contains("primaryKey()"));
        assert!(drizzle.contains(".references("));
    }

    #[test]
    fn test_drizzle_sqlite_generation() {
        let schema = sample_schema();
        let generator = DrizzleGenerator::new(ExportDialect::SQLite);
        let drizzle = generator.generate(&schema);

        assert!(drizzle.contains("import"));
        assert!(drizzle.contains("sqliteTable"));
        assert!(drizzle.contains("integer"));
        assert!(drizzle.contains("text"));
    }

    #[test]
    fn test_dialect_parsing() {
        assert!(matches!(
            ExportDialect::try_from("postgresql"),
            Ok(ExportDialect::PostgreSQL)
        ));
        assert!(matches!(
            ExportDialect::try_from("postgres"),
            Ok(ExportDialect::PostgreSQL)
        ));
        assert!(matches!(
            ExportDialect::try_from("sqlite"),
            Ok(ExportDialect::SQLite)
        ));
        assert!(ExportDialect::try_from("unknown").is_err());
    }
}
