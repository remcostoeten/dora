use std::collections::{HashMap, HashSet};

use anyhow::Context;
use tokio_postgres::Client;

use crate::{
    database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo},
    Error,
};

pub async fn get_database_schema(client: &Client) -> Result<DatabaseSchema, Error> {
    // Main columns query with primary key detection
    let schema_query = r#"
        SELECT 
            c.table_schema,
            c.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable = 'YES' as is_nullable,
            c.column_default,
            -- Check if column is part of primary key
            CASE 
                WHEN pk.column_name IS NOT NULL THEN true 
                ELSE false 
            END as is_primary_key,
            -- Check if column has SERIAL/auto-increment
            CASE 
                WHEN c.column_default LIKE 'nextval%' THEN true
                WHEN c.is_identity = 'YES' THEN true
                ELSE false 
            END as is_auto_increment
        FROM 
            information_schema.columns c
        JOIN 
            information_schema.tables t 
            ON c.table_name = t.table_name 
            AND c.table_schema = t.table_schema
        LEFT JOIN (
            -- Get primary key columns
            SELECT 
                kcu.table_schema,
                kcu.table_name, 
                kcu.column_name
            FROM 
                information_schema.table_constraints tc
            JOIN 
                information_schema.key_column_usage kcu 
                ON tc.constraint_name = kcu.constraint_name 
                AND tc.table_schema = kcu.table_schema
            WHERE 
                tc.constraint_type = 'PRIMARY KEY'
        ) pk 
            ON c.table_schema = pk.table_schema 
            AND c.table_name = pk.table_name 
            AND c.column_name = pk.column_name
        WHERE 
            t.table_type = 'BASE TABLE'
            AND c.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY 
            c.table_schema, c.table_name, c.ordinal_position
    "#;

    let rows = client
        .query(schema_query, &[])
        .await
        .context("Failed to query database schema")?;

    // Query for foreign keys
    let fk_query = r#"
        SELECT
            kcu.table_schema,
            kcu.table_name,
            kcu.column_name,
            ccu.table_schema AS referenced_schema,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM
            information_schema.table_constraints tc
        JOIN
            information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN
            information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE
            tc.constraint_type = 'FOREIGN KEY'
    "#;

    let fk_rows = client
        .query(fk_query, &[])
        .await
        .context("Failed to query foreign keys")?;

    // Build foreign key lookup: (schema, table, column) -> ForeignKeyInfo
    let mut fk_map: HashMap<(String, String, String), ForeignKeyInfo> = HashMap::new();
    for row in &fk_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let column: &str = row.get(2);
        let ref_schema: &str = row.get(3);
        let ref_table: &str = row.get(4);
        let ref_column: &str = row.get(5);

        fk_map.insert(
            (schema.to_owned(), table.to_owned(), column.to_owned()),
            ForeignKeyInfo {
                referenced_schema: ref_schema.to_owned(),
                referenced_table: ref_table.to_owned(),
                referenced_column: ref_column.to_owned(),
            },
        );
    }

    // Query for indexes
    let index_query = r#"
        SELECT
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM
            pg_indexes
        WHERE
            schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    "#;

    let index_rows = client
        .query(index_query, &[])
        .await
        .context("Failed to query indexes")?;

    let mut index_map: HashMap<(String, String), Vec<IndexInfo>> = HashMap::new();
    for row in &index_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let index_name: &str = row.get(2);
        let index_def: &str = row.get(3);

        // Simple parsing of index definition to extract columns and uniqueness
        // Example: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
        let is_unique = index_def.to_uppercase().contains("UNIQUE INDEX");
        let is_primary = index_name.ends_with("_pkey"); // simplistic check, but widely applicable

        let columns_part = index_def
            .split("USING")
            .nth(1)
            .unwrap_or("")
            .split("(")
            .nth(1)
            .unwrap_or("")
            .split(")")
            .next()
            .unwrap_or("");

        let column_names: Vec<String> = columns_part
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let index_info = IndexInfo {
            name: index_name.to_owned(),
            column_names,
            is_unique,
            is_primary,
        };

        index_map
            .entry((schema.to_owned(), table.to_owned()))
            .or_default()
            .push(index_info);
    }

    // Query for row count estimates (fast, uses pg_stat)
    let count_query = r#"
        SELECT 
            schemaname,
            relname,
            n_live_tup
        FROM 
            pg_stat_user_tables
    "#;

    let count_rows = client
        .query(count_query, &[])
        .await
        .context("Failed to query row counts")?;

    // Build row count lookup
    let mut count_map: HashMap<(String, String), u64> = HashMap::new();
    for row in &count_rows {
        let schema: &str = row.get(0);
        let table: &str = row.get(1);
        let count: i64 = row.get(2);
        count_map.insert((schema.to_owned(), table.to_owned()), count as u64);
    }

    // Key is (schema, table_name)
    let mut tables_map: HashMap<(&str, &str), TableInfo> = HashMap::new();
    let mut schemas_set = HashSet::new();
    let mut unique_columns_set = HashSet::new();

    for row in &rows {
        let schema: &str = row.get(0);
        let table_name: &str = row.get(1);
        let column_name: &str = row.get(2);
        let data_type: &str = row.get(3);
        let is_nullable: bool = row.get(4);
        let default_value: Option<&str> = row.get(5);
        let is_primary_key: bool = row.get(6);
        let is_auto_increment: bool = row.get(7);

        schemas_set.insert(schema);
        unique_columns_set.insert(column_name);

        let table_key = (schema, table_name);

        let table_info = tables_map.entry(table_key).or_insert_with(|| {
            let row_count = count_map
                .get(&(schema.to_owned(), table_name.to_owned()))
                .copied();
            
            let indexes = index_map
                .remove(&(schema.to_owned(), table_name.to_owned()))
                .unwrap_or_default();

            TableInfo {
                name: table_name.to_owned(),
                schema: schema.to_owned(),
                columns: Vec::new(),
                primary_key_columns: Vec::new(),
                row_count_estimate: row_count,
                indexes,
            }
        });

        // Track primary key columns at table level
        if is_primary_key {
            let col_name = column_name.to_owned();
            if !table_info.primary_key_columns.contains(&col_name) {
                table_info.primary_key_columns.push(col_name);
            }
        }

        // Look up foreign key info
        let foreign_key = fk_map
            .get(&(
                schema.to_owned(),
                table_name.to_owned(),
                column_name.to_owned(),
            ))
            .cloned();

        table_info.columns.push(ColumnInfo {
            name: column_name.to_owned(),
            data_type: data_type.to_owned(),
            is_nullable,
            default_value: default_value.map(|s| s.to_owned()),
            is_primary_key,
            is_auto_increment,
            foreign_key,
        });
    }

    let tables = tables_map.into_values().collect();
    let schemas = schemas_set.into_iter().map(ToOwned::to_owned).collect();
    let unique_columns = unique_columns_set
        .into_iter()
        .map(ToOwned::to_owned)
        .collect();

    Ok(DatabaseSchema {
        tables,
        schemas,
        unique_columns,
    })
}
