//! Canonical SQL identifier quoting.
//!
//! Every place that interpolates a runtime identifier (table, schema, column)
//! into generated SQL must go through these helpers. Identifiers arrive from
//! live schema introspection and from the webview, so names containing the
//! quote character itself (legal in every supported engine) must round-trip,
//! and a malicious name must never break out of its quoted position.
//!
//! Two styles cover all supported engines:
//! - ANSI double quotes: Postgres, CockroachDB, SQLite, libSQL, D1, DuckDB.
//! - Backticks: MySQL, MariaDB.

/// Quotes an identifier with ANSI double quotes, doubling embedded quotes.
pub fn quote_ansi(identifier: &str) -> String {
    format!("\"{}\"", identifier.replace('"', "\"\""))
}

/// Quotes an identifier with MySQL backticks, doubling embedded backticks.
pub fn quote_mysql(identifier: &str) -> String {
    format!("`{}`", identifier.replace('`', "``"))
}

/// `"schema"."table"` (or just `"table"`) in ANSI style.
pub fn qualified_ansi(schema: Option<&str>, table: &str) -> String {
    match schema {
        Some(schema) if !schema.is_empty() => {
            format!("{}.{}", quote_ansi(schema), quote_ansi(table))
        }
        _ => quote_ansi(table),
    }
}

/// `` `schema`.`table` `` (or just `` `table` ``) in MySQL style.
pub fn qualified_mysql(schema: Option<&str>, table: &str) -> String {
    match schema {
        Some(schema) if !schema.is_empty() => {
            format!("{}.{}", quote_mysql(schema), quote_mysql(table))
        }
        _ => quote_mysql(table),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ansi_plain() {
        assert_eq!(quote_ansi("users"), "\"users\"");
    }

    #[test]
    fn ansi_doubles_embedded_quote() {
        assert_eq!(quote_ansi("we\"ird"), "\"we\"\"ird\"");
    }

    #[test]
    fn ansi_neutralizes_injection_shaped_name() {
        let quoted = quote_ansi("x\");DROP TABLE users;--");
        assert_eq!(quoted, "\"x\"\");DROP TABLE users;--\"");
        // The interior stays inside one quoted identifier: every interior `"`
        // is doubled, so the only unpaired quotes are the outer delimiters.
        let interior = &quoted[1..quoted.len() - 1];
        assert_eq!(interior.matches('"').count() % 2, 0);
    }

    #[test]
    fn mysql_plain() {
        assert_eq!(quote_mysql("users"), "`users`");
    }

    #[test]
    fn mysql_doubles_embedded_backtick() {
        assert_eq!(quote_mysql("we`ird"), "`we``ird`");
    }

    #[test]
    fn mysql_neutralizes_injection_shaped_name() {
        let quoted = quote_mysql("x`;DROP TABLE users;--");
        assert_eq!(quoted, "`x``;DROP TABLE users;--`");
    }

    #[test]
    fn qualified_ansi_with_and_without_schema() {
        assert_eq!(
            qualified_ansi(Some("public"), "users"),
            "\"public\".\"users\""
        );
        assert_eq!(qualified_ansi(None, "users"), "\"users\"");
        assert_eq!(qualified_ansi(Some(""), "users"), "\"users\"");
        assert_eq!(
            qualified_ansi(Some("we\"ird"), "ta\"ble"),
            "\"we\"\"ird\".\"ta\"\"ble\""
        );
    }

    #[test]
    fn qualified_mysql_with_and_without_schema() {
        assert_eq!(qualified_mysql(Some("app"), "users"), "`app`.`users`");
        assert_eq!(qualified_mysql(None, "users"), "`users`");
        assert_eq!(qualified_mysql(Some("a`pp"), "us`ers"), "`a``pp`.`us``ers`");
    }
}
