use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use mysql_async::prelude::Queryable;
use mysql_async::{Pool, Row, Value as MysqlValue};

use crate::{
    database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo},
    Error,
};

pub async fn get_database_schema(pool: Arc<Pool>) -> Result<DatabaseSchema, Error> {
    let mut conn = pool
        .get_conn()
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("MySQL connect failed: {}", e)))?;

    let current_db: String = conn
        .query_first("SELECT DATABASE()")
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to get current database: {}", e)))?
        .unwrap_or_default();

    if current_db.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("No database selected")));
    }

    // -- columns + primary-key flag -----------------------------------------
    let column_query = r#"
        SELECT
            c.TABLE_SCHEMA,
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.COLUMN_TYPE,
            c.IS_NULLABLE = 'YES'        AS is_nullable,
            c.COLUMN_DEFAULT,
            CASE WHEN c.COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END AS is_primary_key,
            CASE WHEN c.EXTRA LIKE '%auto_increment%' THEN 1 ELSE 0 END AS is_auto_increment
        FROM
            information_schema.COLUMNS c
        JOIN
            information_schema.TABLES t
            ON c.TABLE_NAME = t.TABLE_NAME
            AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
        WHERE
            t.TABLE_TYPE = 'BASE TABLE'
            AND c.TABLE_SCHEMA = ?
        ORDER BY
            c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    "#;

    let column_rows: Vec<Row> = conn
        .exec(column_query, (&current_db,))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query columns: {}", e)))?;

    // -- foreign keys -------------------------------------------------------
    let fk_query = r#"
        SELECT
            kcu.TABLE_SCHEMA,
            kcu.TABLE_NAME,
            kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_SCHEMA,
            kcu.REFERENCED_TABLE_NAME,
            kcu.REFERENCED_COLUMN_NAME
        FROM
            information_schema.KEY_COLUMN_USAGE kcu
        WHERE
            kcu.REFERENCED_TABLE_NAME IS NOT NULL
            AND kcu.TABLE_SCHEMA = ?
    "#;

    let fk_rows: Vec<Row> = conn
        .exec(fk_query, (&current_db,))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query foreign keys: {}", e)))?;

    let mut fk_map: HashMap<(String, String, String), ForeignKeyInfo> = HashMap::new();
    for row in &fk_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let column: String = mysql_get_string(row, 2);
        let ref_schema: String = mysql_get_string(row, 3);
        let ref_table: String = mysql_get_string(row, 4);
        let ref_column: String = mysql_get_string(row, 5);

        fk_map.insert(
            (schema, table, column),
            ForeignKeyInfo {
                referenced_schema: ref_schema,
                referenced_table: ref_table,
                referenced_column: ref_column,
            },
        );
    }

    // -- indexes ------------------------------------------------------------
    let index_query = r#"
        SELECT
            TABLE_SCHEMA,
            TABLE_NAME,
            INDEX_NAME,
            NON_UNIQUE,
            COLUMN_NAME
        FROM
            information_schema.STATISTICS
        WHERE
            TABLE_SCHEMA = ?
        ORDER BY
            TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    "#;

    let index_rows: Vec<Row> = conn
        .exec(index_query, (&current_db,))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query indexes: {}", e)))?;

    // Group columns per index
    let mut index_builder: HashMap<(String, String, String), (bool, Vec<String>)> = HashMap::new();
    for row in &index_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let index_name: String = mysql_get_string(row, 2);
        let non_unique: i64 = mysql_get_i64(row, 3);
        let col_name: String = mysql_get_string(row, 4);

        let entry = index_builder
            .entry((schema, table, index_name))
            .or_insert_with(|| (non_unique == 0, Vec::new()));
        entry.1.push(col_name);
    }

    let mut index_map: HashMap<(String, String), Vec<IndexInfo>> = HashMap::new();
    for ((schema, table, index_name), (is_unique, column_names)) in index_builder {
        let is_primary = index_name == "PRIMARY";
        index_map
            .entry((schema, table))
            .or_default()
            .push(IndexInfo {
                name: index_name,
                column_names,
                is_unique,
                is_primary,
            });
    }

    // -- row count estimates ------------------------------------------------
    let count_query = r#"
        SELECT
            TABLE_SCHEMA,
            TABLE_NAME,
            TABLE_ROWS
        FROM
            information_schema.TABLES
        WHERE
            TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA = ?
    "#;

    let count_rows: Vec<Row> = conn
        .exec(count_query, (&current_db,))
        .await
        .map_err(|e| Error::Any(anyhow::anyhow!("Failed to query row counts: {}", e)))?;

    let mut count_map: HashMap<(String, String), u64> = HashMap::new();
    for row in &count_rows {
        let schema: String = mysql_get_string(row, 0);
        let table: String = mysql_get_string(row, 1);
        let count: i64 = mysql_get_i64(row, 2);
        count_map.insert((schema, table), count.max(0) as u64);
    }

    // -- assemble tables ----------------------------------------------------
    let mut tables_map: HashMap<(String, String), TableInfo> = HashMap::new();
    let mut schemas_set = HashSet::new();
    let mut unique_columns_set = HashSet::new();

    for row in &column_rows {
        let schema: String = mysql_get_string(row, 0);
        let table_name: String = mysql_get_string(row, 1);
        let column_name: String = mysql_get_string(row, 2);
        let data_type: String = mysql_get_string(row, 3);
        let is_nullable: bool = mysql_get_i64(row, 4) != 0;
        let default_value: Option<String> = mysql_get_opt_string(row, 5);
        let is_primary_key: bool = mysql_get_i64(row, 6) != 0;
        let is_auto_increment: bool = mysql_get_i64(row, 7) != 0;

        schemas_set.insert(schema.clone());
        unique_columns_set.insert(column_name.clone());

        let table_key = (schema.clone(), table_name.clone());

        let table_info = tables_map.entry(table_key.clone()).or_insert_with(|| {
            let row_count = count_map.get(&table_key).copied();
            let indexes = index_map.remove(&table_key).unwrap_or_default();

            TableInfo {
                name: table_name.clone(),
                schema: schema.clone(),
                columns: Vec::new(),
                primary_key_columns: Vec::new(),
                row_count_estimate: row_count,
                indexes,
            }
        });

        if is_primary_key {
            let col = column_name.clone();
            if !table_info.primary_key_columns.contains(&col) {
                table_info.primary_key_columns.push(col);
            }
        }

        let foreign_key = fk_map
            .get(&(schema, table_name, column_name.clone()))
            .cloned();

        table_info.columns.push(ColumnInfo {
            name: column_name,
            data_type,
            is_nullable,
            default_value,
            is_primary_key,
            is_auto_increment,
            foreign_key,
        });
    }

    let tables = tables_map.into_values().collect();
    let schemas = schemas_set.into_iter().collect();
    let unique_columns = unique_columns_set.into_iter().collect();

    Ok(DatabaseSchema {
        tables,
        schemas,
        unique_columns,
    })
}

// -- helpers to extract values from mysql_async::Row without panicking ------

fn mysql_get_string(row: &Row, idx: usize) -> String {
    match row.as_ref(idx) {
        Some(MysqlValue::Bytes(b)) => String::from_utf8_lossy(b).into_owned(),
        Some(MysqlValue::NULL) | None => String::new(),
        Some(other) => format!("{:?}", other),
    }
}

fn mysql_get_opt_string(row: &Row, idx: usize) -> Option<String> {
    match row.as_ref(idx) {
        Some(MysqlValue::Bytes(b)) => Some(String::from_utf8_lossy(b).into_owned()),
        Some(MysqlValue::NULL) | None => None,
        Some(other) => Some(format!("{:?}", other)),
    }
}

fn mysql_get_i64(row: &Row, idx: usize) -> i64 {
    match row.as_ref(idx) {
        Some(MysqlValue::Int(i)) => *i,
        Some(MysqlValue::UInt(u)) => *u as i64,
        Some(MysqlValue::Bytes(b)) => String::from_utf8_lossy(b).parse().unwrap_or(0),
        _ => 0,
    }
}
