use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::{
    database::sqlite_introspection::{
        assemble, CollapsedQueries, RawColumn, RawForeignKey, RawIndexColumn, RawTable,
    },
    database::types::DatabaseSchema,
    Error,
};

/// Introspects the schema in four constant queries via the pragma table-valued
/// functions, instead of a 5-queries-per-table PRAGMA loop. Row counts are
/// filled in by the background row-count refresher, so a large file never
/// blocks the first paint behind full-table `COUNT(*)` scans. The whole read
/// runs in one `spawn_blocking` holding the connection mutex once.
pub async fn get_database_schema(conn: Arc<Mutex<Connection>>) -> Result<DatabaseSchema, Error> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = conn
            .lock()
            .map_err(|_| Error::Internal("SQLite connection mutex poisoned".into()))?;
        introspect(&conn)
    })
    .await?
}

fn introspect(conn: &Connection) -> Result<DatabaseSchema, Error> {
    let mut tables_stmt = conn.prepare(CollapsedQueries::TABLES)?;
    let raw_tables: Vec<RawTable> = tables_stmt
        .query_map([], |row| {
            Ok(RawTable {
                name: row.get(0)?,
                create_sql: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut columns_stmt = conn.prepare(CollapsedQueries::COLUMNS)?;
    let raw_columns: Vec<RawColumn> = columns_stmt
        .query_map([], |row| {
            Ok(RawColumn {
                table: row.get(0)?,
                name: row.get(1)?,
                data_type: row.get(2)?,
                not_null: row.get::<_, i32>(3)? != 0,
                default_value: row.get(4)?,
                is_primary_key: row.get::<_, i32>(5)? > 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut fk_stmt = conn.prepare(CollapsedQueries::FOREIGN_KEYS)?;
    let raw_foreign_keys: Vec<RawForeignKey> = fk_stmt
        .query_map([], |row| {
            Ok(RawForeignKey {
                table: row.get(0)?,
                referenced_table: row.get(1)?,
                from_column: row.get(2)?,
                referenced_column: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut index_stmt = conn.prepare(CollapsedQueries::INDEXES)?;
    let raw_index_columns: Vec<RawIndexColumn> = index_stmt
        .query_map([], |row| {
            Ok(RawIndexColumn {
                table: row.get(0)?,
                index: row.get(1)?,
                is_unique: row.get::<_, i32>(2)? != 0,
                column: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(assemble(
        raw_tables,
        raw_columns,
        raw_foreign_keys,
        raw_index_columns,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            "CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL DEFAULT 'x@y.z',
                nickname TEXT
            );
            CREATE UNIQUE INDEX users_email ON users (email);
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT
            );
            CREATE INDEX posts_user_title ON posts (user_id, title);
            INSERT INTO users (email) VALUES ('a@b.c');",
        )
        .expect("fixture schema");
        conn
    }

    #[test]
    fn introspects_fixture_in_constant_queries() {
        let conn = fixture();
        let schema = introspect(&conn).expect("introspection");

        assert_eq!(schema.tables.len(), 2);
        let users = schema.tables.iter().find(|t| t.name == "users").unwrap();
        assert_eq!(users.primary_key_columns, vec!["id"]);
        assert!(users.columns[0].is_auto_increment);
        let email = users.columns.iter().find(|c| c.name == "email").unwrap();
        assert!(!email.is_nullable);
        assert_eq!(email.default_value.as_deref(), Some("'x@y.z'"));
        let email_index = users
            .indexes
            .iter()
            .find(|i| i.name == "users_email")
            .unwrap();
        assert!(email_index.is_unique);
        assert_eq!(email_index.column_names, vec!["email"]);

        let posts = schema.tables.iter().find(|t| t.name == "posts").unwrap();
        let user_id = posts.columns.iter().find(|c| c.name == "user_id").unwrap();
        let fk = user_id.foreign_key.as_ref().expect("fk detected");
        assert_eq!(fk.referenced_table, "users");
        assert_eq!(fk.referenced_column, "id");
        let composite = posts
            .indexes
            .iter()
            .find(|i| i.name == "posts_user_title")
            .unwrap();
        assert_eq!(composite.column_names, vec!["user_id", "title"]);

        // Counts are deferred to the background refresher.
        assert!(schema.tables.iter().all(|t| t.row_count_estimate.is_none()));
    }

    #[test]
    fn empty_database_yields_empty_schema() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        let schema = introspect(&conn).expect("introspection");
        assert!(schema.tables.is_empty());
        assert!(schema.unique_columns.is_empty());
    }

    #[test]
    fn weird_table_names_survive() {
        let conn = Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch("CREATE TABLE \"we ird\" (id INTEGER PRIMARY KEY, note TEXT);")
            .expect("weird table");
        let schema = introspect(&conn).expect("introspection");
        assert_eq!(schema.tables[0].name, "we ird");
        assert_eq!(schema.tables[0].columns.len(), 2);
    }
}
