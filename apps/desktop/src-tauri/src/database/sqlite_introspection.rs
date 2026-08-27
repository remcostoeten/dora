//! Shared schema assembly for the SQLite family (SQLite, libSQL, D1).
//!
//! All three engines expose the same catalog surface (`sqlite_master` plus the
//! `table_info` / `foreign_key_list` / `index_list` / `index_info` PRAGMAs);
//! only the transport differs. Each engine fetches raw rows its own way —
//! ideally in a constant number of round trips — and hands them here, so the
//! grouping, primary-key, auto-increment and index logic exists once.
//!
//! Row counts are deliberately absent: the introspection path returns
//! `row_count_estimate: None` and the background row-count refresher fills
//! counts in afterwards.

use std::collections::{HashMap, HashSet};

use crate::database::types::{ColumnInfo, DatabaseSchema, ForeignKeyInfo, IndexInfo, TableInfo};

pub struct RawTable {
    pub name: String,
    /// The table's CREATE statement from `sqlite_master.sql`, used for
    /// AUTOINCREMENT detection.
    pub create_sql: String,
}

/// One `PRAGMA table_info` row; must arrive in `cid` order per table.
pub struct RawColumn {
    pub table: String,
    pub name: String,
    pub data_type: String,
    pub not_null: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
}

/// One `PRAGMA foreign_key_list` row.
pub struct RawForeignKey {
    pub table: String,
    pub from_column: String,
    pub referenced_table: String,
    pub referenced_column: String,
}

/// One `PRAGMA index_list` × `index_info` row; must arrive in `seqno` order
/// per index. `column` is `None` for expression index members.
pub struct RawIndexColumn {
    pub table: String,
    pub index: String,
    pub is_unique: bool,
    pub column: Option<String>,
}

pub fn assemble(
    raw_tables: Vec<RawTable>,
    raw_columns: Vec<RawColumn>,
    raw_foreign_keys: Vec<RawForeignKey>,
    raw_index_columns: Vec<RawIndexColumn>,
) -> DatabaseSchema {
    let mut columns_by_table: HashMap<String, Vec<RawColumn>> = HashMap::new();
    for column in raw_columns {
        columns_by_table
            .entry(column.table.clone())
            .or_default()
            .push(column);
    }

    let mut fks_by_table: HashMap<(String, String), ForeignKeyInfo> = HashMap::new();
    for fk in raw_foreign_keys {
        fks_by_table.insert(
            (fk.table, fk.from_column),
            ForeignKeyInfo {
                referenced_table: fk.referenced_table,
                referenced_column: fk.referenced_column,
                referenced_schema: String::new(),
            },
        );
    }

    let mut indexes_by_table: HashMap<String, Vec<IndexInfo>> = HashMap::new();
    for index_column in raw_index_columns {
        let indexes = indexes_by_table.entry(index_column.table).or_default();
        let index = match indexes.iter_mut().find(|i| i.name == index_column.index) {
            Some(index) => index,
            None => {
                indexes.push(IndexInfo {
                    name: index_column.index,
                    column_names: Vec::new(),
                    is_unique: index_column.is_unique,
                    is_primary: false,
                });
                indexes.last_mut().expect("just pushed")
            }
        };
        if let Some(column) = index_column.column {
            index.column_names.push(column);
        }
    }

    let mut tables = Vec::new();
    let mut unique_columns_set = HashSet::new();

    for raw_table in raw_tables {
        let has_autoincrement = raw_table
            .create_sql
            .to_uppercase()
            .contains("AUTOINCREMENT");
        let table_columns = columns_by_table.remove(&raw_table.name).unwrap_or_default();

        let mut columns = Vec::new();
        let mut primary_key_columns = Vec::new();

        for raw_column in table_columns {
            unique_columns_set.insert(raw_column.name.clone());

            if raw_column.is_primary_key {
                primary_key_columns.push(raw_column.name.clone());
            }

            // AUTOINCREMENT requires INTEGER PRIMARY KEY; a single INTEGER pk
            // is a rowid alias and auto-increments even without the keyword.
            let is_auto_increment = raw_column.is_primary_key
                && raw_column.data_type.to_uppercase() == "INTEGER"
                && (has_autoincrement || primary_key_columns.len() == 1);

            let foreign_key = fks_by_table
                .get(&(raw_table.name.clone(), raw_column.name.clone()))
                .cloned();

            columns.push(ColumnInfo {
                name: raw_column.name,
                data_type: raw_column.data_type,
                is_nullable: !raw_column.not_null,
                default_value: raw_column.default_value,
                is_primary_key: raw_column.is_primary_key,
                is_auto_increment,
                foreign_key,
                allowed_values: None,
            });
        }

        tables.push(TableInfo {
            name: raw_table.name.clone(),
            schema: String::new(),
            columns,
            primary_key_columns,
            row_count_estimate: None,
            indexes: indexes_by_table.remove(&raw_table.name).unwrap_or_default(),
        });
    }

    DatabaseSchema {
        tables,
        schemas: vec![],
        unique_columns: unique_columns_set.into_iter().collect(),
    }
}

/// The four constant introspection queries every SQLite-family engine can run
/// instead of per-table PRAGMA loops. The pragma table-valued functions
/// (`pragma_table_info(...)`) are plain SELECT sources, available since SQLite
/// 3.16 and supported by libSQL/sqld.
pub struct CollapsedQueries;

impl CollapsedQueries {
    pub const TABLES: &'static str = "SELECT name, sql FROM sqlite_master \
         WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";

    pub const COLUMNS: &'static str =
        "SELECT m.name AS tbl, p.name AS col, p.\"type\" AS col_type, \
                p.\"notnull\" AS not_null, p.dflt_value AS dflt_value, p.pk AS pk \
         FROM sqlite_master m JOIN pragma_table_info(m.name) p \
         WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' \
         ORDER BY m.name, p.cid";

    pub const FOREIGN_KEYS: &'static str = "SELECT m.name AS tbl, f.\"table\" AS ref_table, f.\"from\" AS from_col, f.\"to\" AS to_col \
         FROM sqlite_master m JOIN pragma_foreign_key_list(m.name) f \
         WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%'";

    pub const INDEXES: &'static str =
        "SELECT m.name AS tbl, il.name AS idx, il.\"unique\" AS is_unique, ii.name AS col \
         FROM sqlite_master m \
         JOIN pragma_index_list(m.name) il \
         LEFT JOIN pragma_index_info(il.name) ii \
         WHERE m.type='table' AND m.name NOT LIKE 'sqlite_%' \
         ORDER BY m.name, il.seq, ii.seqno";
}

#[cfg(test)]
mod tests {
    use super::*;

    fn users_table() -> RawTable {
        RawTable {
            name: "users".into(),
            create_sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)".into(),
        }
    }

    #[test]
    fn assembles_columns_pks_and_rowid_autoincrement() {
        let schema = assemble(
            vec![users_table()],
            vec![
                RawColumn {
                    table: "users".into(),
                    name: "id".into(),
                    data_type: "INTEGER".into(),
                    not_null: true,
                    default_value: None,
                    is_primary_key: true,
                },
                RawColumn {
                    table: "users".into(),
                    name: "email".into(),
                    data_type: "TEXT".into(),
                    not_null: false,
                    default_value: None,
                    is_primary_key: false,
                },
            ],
            vec![],
            vec![],
        );
        let table = &schema.tables[0];
        assert_eq!(table.primary_key_columns, vec!["id"]);
        assert!(table.columns[0].is_auto_increment);
        assert!(!table.columns[1].is_auto_increment);
        assert!(table.columns[1].is_nullable);
        assert_eq!(table.row_count_estimate, None);
    }

    #[test]
    fn composite_integer_pk_is_not_auto_increment_without_keyword() {
        let schema = assemble(
            vec![RawTable {
                name: "pairs".into(),
                create_sql: "CREATE TABLE pairs (a INTEGER, b INTEGER, PRIMARY KEY (a, b))".into(),
            }],
            vec![
                RawColumn {
                    table: "pairs".into(),
                    name: "a".into(),
                    data_type: "INTEGER".into(),
                    not_null: true,
                    default_value: None,
                    is_primary_key: true,
                },
                RawColumn {
                    table: "pairs".into(),
                    name: "b".into(),
                    data_type: "INTEGER".into(),
                    not_null: true,
                    default_value: None,
                    is_primary_key: true,
                },
            ],
            vec![],
            vec![],
        );
        let table = &schema.tables[0];
        // First pk column keeps the legacy single-pk heuristic; the second is
        // provably composite and never auto-increments.
        assert!(!table.columns[1].is_auto_increment);
        assert_eq!(table.primary_key_columns, vec!["a", "b"]);
    }

    #[test]
    fn attaches_foreign_keys_to_their_column() {
        let schema = assemble(
            vec![
                users_table(),
                RawTable {
                    name: "posts".into(),
                    create_sql: String::new(),
                },
            ],
            vec![RawColumn {
                table: "posts".into(),
                name: "user_id".into(),
                data_type: "INTEGER".into(),
                not_null: false,
                default_value: None,
                is_primary_key: false,
            }],
            vec![RawForeignKey {
                table: "posts".into(),
                from_column: "user_id".into(),
                referenced_table: "users".into(),
                referenced_column: "id".into(),
            }],
            vec![],
        );
        let posts = schema.tables.iter().find(|t| t.name == "posts").unwrap();
        let fk = posts.columns[0].foreign_key.as_ref().unwrap();
        assert_eq!(fk.referenced_table, "users");
        assert_eq!(fk.referenced_column, "id");
    }

    #[test]
    fn groups_index_columns_in_order_and_skips_expression_members() {
        let schema = assemble(
            vec![users_table()],
            vec![],
            vec![],
            vec![
                RawIndexColumn {
                    table: "users".into(),
                    index: "users_email_name".into(),
                    is_unique: true,
                    column: Some("email".into()),
                },
                RawIndexColumn {
                    table: "users".into(),
                    index: "users_email_name".into(),
                    is_unique: true,
                    column: Some("name".into()),
                },
                RawIndexColumn {
                    table: "users".into(),
                    index: "users_expr".into(),
                    is_unique: false,
                    column: None,
                },
            ],
        );
        let indexes = &schema.tables[0].indexes;
        assert_eq!(indexes.len(), 2);
        assert_eq!(indexes[0].column_names, vec!["email", "name"]);
        assert!(indexes[0].is_unique);
        assert!(indexes[1].column_names.is_empty());
    }

    #[test]
    fn unique_columns_collects_every_column_name() {
        let schema = assemble(
            vec![users_table()],
            vec![
                RawColumn {
                    table: "users".into(),
                    name: "id".into(),
                    data_type: "INTEGER".into(),
                    not_null: true,
                    default_value: None,
                    is_primary_key: true,
                },
                RawColumn {
                    table: "users".into(),
                    name: "email".into(),
                    data_type: "TEXT".into(),
                    not_null: false,
                    default_value: None,
                    is_primary_key: false,
                },
            ],
            vec![],
            vec![],
        );
        let mut unique: Vec<_> = schema.unique_columns.clone();
        unique.sort();
        assert_eq!(unique, vec!["email", "id"]);
    }
}
