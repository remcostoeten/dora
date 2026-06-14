use sqlparser::{
    ast::{ObjectName, Statement},
    dialect::SQLiteDialect,
};

use crate::database::{
    self,
    parser::{ParsedStatement, SqlDialectExt},
};

pub fn parse_statements(query: &str) -> anyhow::Result<Vec<ParsedStatement>> {
    match database::parser::parse_statements(&SQLiteDialect {}, query) {
        Ok(statements) => Ok(statements),
        // `sqlparser`'s SQLite dialect rejects several valid statements
        // (VACUUM, DETACH DATABASE, `PRAGMA x = ON`, `PRAGMA fn(identifier)`).
        // SQLite executes the raw SQL through rusqlite, so fall back to a
        // keyword-based classifier rather than failing the whole batch.
        Err(_) => Ok(fallback_parse(query)),
    }
}

/// Best-effort statement classification for SQL the AST parser cannot handle.
/// Splits on top-level semicolons (honouring quoted strings) and classifies
/// each statement by its leading keyword.
fn fallback_parse(query: &str) -> Vec<ParsedStatement> {
    split_sql_statements(query)
        .into_iter()
        .map(|statement| ParsedStatement {
            returns_values: stmt_returns_values_heuristic(&statement),
            is_read_only: stmt_is_read_only_heuristic(&statement),
            statement,
        })
        .collect()
}

fn split_sql_statements(query: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;

    for c in query.chars() {
        match c {
            '\'' if !in_double => {
                in_single = !in_single;
                current.push(c);
            }
            '"' if !in_single => {
                in_double = !in_double;
                current.push(c);
            }
            ';' if !in_single && !in_double => {
                if !current.trim().is_empty() {
                    statements.push(current.trim().to_string());
                }
                current.clear();
            }
            _ => current.push(c),
        }
    }

    if !current.trim().is_empty() {
        statements.push(current.trim().to_string());
    }

    statements
}

fn first_keyword(stmt: &str) -> String {
    stmt.split(|c: char| c.is_whitespace() || c == '(')
        .find(|s| !s.is_empty())
        .unwrap_or("")
        .to_ascii_uppercase()
}

fn stmt_returns_values_heuristic(stmt: &str) -> bool {
    match first_keyword(stmt).as_str() {
        "SELECT" | "WITH" | "VALUES" | "EXPLAIN" => true,
        "PRAGMA" => pragma_sql_returns_values(stmt),
        "INSERT" | "UPDATE" | "DELETE" => stmt.to_ascii_uppercase().contains(" RETURNING "),
        _ => false,
    }
}

fn stmt_is_read_only_heuristic(stmt: &str) -> bool {
    match first_keyword(stmt).as_str() {
        "SELECT" | "WITH" | "VALUES" | "EXPLAIN" => true,
        // Introspection PRAGMAs are read-only; assignments mutate state.
        "PRAGMA" => pragma_sql_returns_values(stmt),
        _ => false,
    }
}

/// Classifies a raw `PRAGMA …` string: assignments (`PRAGMA x = y`) never
/// return rows; otherwise it depends on whether the pragma is value-returning.
fn pragma_sql_returns_values(stmt: &str) -> bool {
    let rest = match stmt.get("PRAGMA".len()..) {
        Some(rest) => rest.trim_start(),
        None => return false,
    };
    let head: String = rest
        .chars()
        .take_while(|c| !matches!(c, '(' | '=' | ';') && !c.is_whitespace())
        .collect();
    let after = rest[head.len()..].trim_start();
    let is_assignment = after.starts_with('=');
    let name = head.rsplit('.').next().unwrap_or(&head);
    !is_assignment && pragma_name_returns_values(name)
}

impl SqlDialectExt for SQLiteDialect {
    fn returns_values(stmt: &Statement) -> bool {
        match stmt {
            Statement::Query(_) => true,
            Statement::Insert(insert) if insert.returning.is_some() => true,
            Statement::Update { returning, .. } if returning.is_some() => true,
            Statement::Delete(delete) if delete.returning.is_some() => true,
            Statement::CreateView { .. } => true,
            Statement::Explain { .. } => true,
            Statement::Execute { .. } => true,
            Statement::Pragma { name, value, .. } => {
                let is_assignment = value.is_some();
                !is_assignment && pragma_returns_values(name)
            }
            _ => false,
        }
    }
}

fn pragma_returns_values(name: &ObjectName) -> bool {
    let Some(ident) = name.0.first() else {
        return false;
    };

    pragma_name_returns_values(&ident.value)
}

fn pragma_name_returns_values(name: &str) -> bool {
    const VALUE_RETURNING_PRAGMAS: &[&str] = &[
        "table_info",
        "index_info",
        "foreign_key_list",
        "database_list",
        "compile_options",
        "integrity_check",
        "schema_version",
        "user_version",
        "freelist_count",
        "page_count",
        "page_size",
        "cache_size",
        "temp_store",
    ];

    VALUE_RETURNING_PRAGMAS
        .iter()
        .any(|&pragma| name.eq_ignore_ascii_case(pragma))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_statements() {
        let results = parse_statements("SELECT * FROM users").unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].returns_values);
        assert_eq!(results[0].statement.trim(), "SELECT * FROM users");

        let multi_query = r#"
            CREATE TABLE test_users (id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO test_users (name) VALUES ('Alice') RETURNING id;
            UPDATE test_users SET name = 'Bob' WHERE id = 1;
            SELECT * FROM test_users;
            DROP TABLE test_users;
        "#;

        let results = parse_statements(multi_query).unwrap();

        assert_eq!(results.len(), 5);

        assert!(
            !results[0].returns_values,
            "CREATE TABLE should not return values"
        );
        assert!(results[0].statement.contains("CREATE TABLE"));

        assert!(
            results[1].returns_values,
            "INSERT with RETURNING should return values"
        );
        assert!(results[1].statement.contains("INSERT"));
        assert!(results[1].statement.contains("RETURNING"));

        assert!(
            !results[2].returns_values,
            "UPDATE without RETURNING should not return values"
        );
        assert!(results[2].statement.contains("UPDATE"));
        assert!(!results[2].statement.contains("RETURNING"));

        assert!(results[3].returns_values, "SELECT should return values");
        assert!(results[3].statement.contains("SELECT"));

        assert!(
            !results[4].returns_values,
            "DROP TABLE should not return values"
        );
        assert!(results[4].statement.contains("DROP TABLE"));
    }

    #[test]
    fn test_explain_statements() {
        let explain_query = r#"
            EXPLAIN SELECT * FROM users;
            EXPLAIN QUERY PLAN SELECT * FROM users WHERE id = 1;
        "#;

        let results = parse_statements(explain_query).unwrap();
        assert_eq!(results.len(), 2);
        for result in &results {
            assert!(result.returns_values, "EXPLAIN statements return values");
            assert!(result.statement.contains("EXPLAIN"));
        }
    }

    #[test]
    fn test_pragma_statements() {
        let pragma_query = r#"
            PRAGMA database_list;
            PRAGMA compile_options;
            PRAGMA integrity_check;
            PRAGMA cache_size = 2000;
        "#;

        let results = parse_statements(pragma_query).unwrap();
        assert_eq!(results.len(), 4);

        assert!(
            results[0].returns_values,
            "PRAGMA database_list returns values"
        );
        assert!(
            results[1].returns_values,
            "PRAGMA compile_options returns values"
        );
        assert!(
            results[2].returns_values,
            "PRAGMA integrity_check returns values"
        );
        assert!(
            !results[3].returns_values,
            "PRAGMA cache_size = value doesn't return values"
        );
    }

    #[test]
    fn test_crud_with_returning() {
        let mixed_crud = r#"
            INSERT INTO products (name, price) VALUES ('Widget', 19.99);
            INSERT INTO products (name, price) VALUES ('Gadget', 29.99) RETURNING id, name;
            UPDATE products SET price = 24.99 WHERE name = 'Widget';
            UPDATE products SET price = 34.99 WHERE name = 'Gadget' RETURNING *;
            DELETE FROM products WHERE price < 25;
            DELETE FROM products WHERE price > 30 RETURNING id;
        "#;

        let results = parse_statements(mixed_crud).unwrap();
        assert_eq!(results.len(), 6);
        assert!(
            !results[0].returns_values,
            "INSERT without RETURNING should not return values"
        );
        assert!(
            results[1].returns_values,
            "INSERT with RETURNING should return values"
        );
        assert!(
            !results[2].returns_values,
            "UPDATE without RETURNING should not return values"
        );
        assert!(
            results[3].returns_values,
            "UPDATE with RETURNING should return values"
        );
        assert!(
            !results[4].returns_values,
            "DELETE without RETURNING should not return values"
        );
        assert!(
            results[5].returns_values,
            "DELETE with RETURNING should return values"
        );
    }

    #[test]
    fn test_ddl_and_transactions() {
        let ddl_transaction_query = r#"
            BEGIN TRANSACTION;
            CREATE INDEX idx_users_email ON users (email);
            ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
            COMMIT;
            CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1;
        "#;

        let results = parse_statements(ddl_transaction_query).unwrap();
        assert_eq!(results.len(), 5);
        assert!(
            !results[0].returns_values,
            "BEGIN TRANSACTION should not return values"
        );
        assert!(
            !results[1].returns_values,
            "CREATE INDEX should not return values"
        );
        assert!(
            !results[2].returns_values,
            "ALTER TABLE should not return values"
        );
        assert!(
            !results[3].returns_values,
            "COMMIT should not return values"
        );
        assert!(
            results[4].returns_values,
            "CREATE VIEW should return values"
        );
    }

    #[test]
    fn test_complex_queries() {
        let complex_select = r#"
            SELECT u.name, COUNT(o.id) as order_count 
            FROM users u 
            LEFT JOIN orders o ON u.id = o.user_id 
            GROUP BY u.id, u.name 
            HAVING COUNT(o.id) > 5;
            
            WITH recent_orders AS (
                SELECT * FROM orders WHERE created_at > datetime('now', '-30 days')
            )
            SELECT u.name, ro.total 
            FROM users u 
            JOIN recent_orders ro ON u.id = ro.user_id;
        "#;

        let results = parse_statements(complex_select).unwrap();
        assert_eq!(results.len(), 2);

        for result in &results {
            assert!(result.returns_values);
            assert!(result.statement.contains("SELECT"));
        }
    }

    #[test]
    fn test_sqlite_specific_features() {
        let sqlite_features = r#"
            CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB);
            INSERT OR REPLACE INTO test (data) VALUES (x'48656c6c6f');
            INSERT OR IGNORE INTO test (data) VALUES (x'576f726c64');
            SELECT last_insert_rowid();
            SELECT changes();
        "#;

        let results = parse_statements(sqlite_features).unwrap();
        assert_eq!(results.len(), 5);

        assert!(
            !results[0].returns_values,
            "CREATE TABLE IF NOT EXISTS should not return values"
        );
        assert!(
            !results[1].returns_values,
            "INSERT OR REPLACE should not return values"
        );
        assert!(
            !results[2].returns_values,
            "INSERT OR IGNORE should not return values"
        );
        assert!(
            results[3].returns_values,
            "SELECT last_insert_rowid() should return values"
        );
        assert!(
            results[4].returns_values,
            "SELECT changes() should return values"
        );
    }

    #[test]
    fn test_whitespace_handling() {
        let with_whitespace = r#"
            
            SELECT 1;
            
            
            INSERT INTO test VALUES (1);
            
        "#;

        let results = parse_statements(with_whitespace).unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].returns_values, "SELECT should return values");
        assert!(
            !results[1].returns_values,
            "INSERT without RETURNING should not return values"
        );
    }

    #[test]
    fn test_more_pragma_cases() {
        let more_pragmas = r#"
            PRAGMA schema_version;
            PRAGMA user_version;
            PRAGMA freelist_count;
            PRAGMA page_count;
            PRAGMA page_size;
            PRAGMA temp_store;
            PRAGMA unknown_pragma;
        "#;

        let results = parse_statements(more_pragmas).unwrap();
        assert_eq!(results.len(), 7);

        for result in results.iter().take(6) {
            assert!(
                result.returns_values,
                "Known value-returning PRAGMA should return values"
            );
        }

        assert!(
            !results[6].returns_values,
            "Unknown PRAGMA should not return values"
        );
    }

    #[test]
    fn test_pragma_with_arguments() {
        // Value-returning PRAGMAs called with arguments still return rows.
        let results = parse_statements(
            "PRAGMA table_info('users'); PRAGMA foreign_key_list(orders); PRAGMA index_info(idx_a);",
        )
        .unwrap();
        assert_eq!(results.len(), 3);
        for result in &results {
            assert!(
                result.returns_values,
                "value-returning PRAGMA with an argument should return rows: {}",
                result.statement
            );
            assert!(
                result.is_read_only,
                "introspection PRAGMA should be read-only: {}",
                result.statement
            );
        }
    }

    #[test]
    fn test_pragma_assignment_does_not_return_values() {
        let results =
            parse_statements("PRAGMA foreign_keys = ON; PRAGMA cache_size = 4000;").unwrap();
        assert_eq!(results.len(), 2);
        for result in &results {
            assert!(
                !result.returns_values,
                "PRAGMA assignment should not return rows: {}",
                result.statement
            );
        }
    }

    #[test]
    fn test_attach_and_detach_database() {
        let results = parse_statements(
            "ATTACH DATABASE 'aux.db' AS aux; DETACH DATABASE aux;",
        )
        .unwrap();
        assert_eq!(results.len(), 2);

        // ATTACH/DETACH produce no result set and mutate connection state, so
        // they must route through the write path (not read-only).
        assert!(
            !results[0].returns_values,
            "ATTACH DATABASE should not return values"
        );
        assert!(
            !results[0].is_read_only,
            "ATTACH DATABASE mutates connection state — not read-only"
        );
        assert!(
            !results[1].returns_values,
            "DETACH DATABASE should not return values"
        );
        assert!(
            !results[1].is_read_only,
            "DETACH DATABASE mutates connection state — not read-only"
        );
    }

    #[test]
    fn test_vacuum() {
        let results = parse_statements("VACUUM;").unwrap();
        assert_eq!(results.len(), 1);
        assert!(!results[0].returns_values, "VACUUM should not return values");
        assert!(
            !results[0].is_read_only,
            "VACUUM rewrites the database file — not read-only"
        );
    }

    #[test]
    fn test_vacuum_into() {
        // `VACUUM INTO 'file'` writes a fresh copy of the database to disk and
        // produces no result set, so it routes through the write path.
        let results = parse_statements("VACUUM INTO 'backup.db';").unwrap();
        assert_eq!(results.len(), 1);
        assert!(
            !results[0].returns_values,
            "VACUUM INTO should not return values"
        );
        assert!(
            !results[0].is_read_only,
            "VACUUM INTO writes a database copy — not read-only"
        );
    }

    #[test]
    fn test_pragma_assignment_with_keyword_value() {
        // `PRAGMA journal_mode = WAL` is an assignment. SQLite echoes the new
        // mode back, but the classifier treats every assignment as a write that
        // yields no result set (matching `PRAGMA x = ON` handling).
        let results = parse_statements("PRAGMA journal_mode = WAL;").unwrap();
        assert_eq!(results.len(), 1);
        assert!(
            !results[0].returns_values,
            "PRAGMA assignment should not return values"
        );
        assert!(
            !results[0].is_read_only,
            "PRAGMA journal_mode assignment mutates state — not read-only"
        );
    }
}
