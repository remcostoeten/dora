//! Generated-SQL builders for the SQLite-family write adapters (SQLite,
//! libSQL, Cloudflare D1). All three speak the same dialect: ANSI-quoted
//! identifiers and `?` placeholders. Keeping the statement text in pure
//! functions makes the generated SQL assertable without a live database.

use crate::database::ident::quote_ansi;

pub fn update_cell_sql(table: &str, column: &str, pk_column: &str) -> String {
    format!(
        "UPDATE {} SET {} = ? WHERE {} = ?",
        quote_ansi(table),
        quote_ansi(column),
        quote_ansi(pk_column)
    )
}

pub fn delete_rows_sql(table: &str, pk_column: &str, pk_count: usize) -> String {
    let placeholders: Vec<&str> = (0..pk_count).map(|_| "?").collect();
    format!(
        "DELETE FROM {} WHERE {} IN ({})",
        quote_ansi(table),
        quote_ansi(pk_column),
        placeholders.join(", ")
    )
}

pub fn insert_row_sql<'a, I: ExactSizeIterator<Item = &'a str>>(table: &str, columns: I) -> String {
    let count = columns.len();
    let col_names: Vec<String> = columns.map(quote_ansi).collect();
    let placeholders: Vec<&str> = (0..count).map(|_| "?").collect();
    format!(
        "INSERT INTO {} ({}) VALUES ({})",
        quote_ansi(table),
        col_names.join(", "),
        placeholders.join(", ")
    )
}

pub fn select_row_sql(table: &str, pk_column: &str) -> String {
    format!(
        "SELECT * FROM {} WHERE {} = ? LIMIT 1",
        quote_ansi(table),
        quote_ansi(pk_column)
    )
}

pub fn select_blob_sql(table: &str, column: &str, pk_column: &str) -> String {
    format!(
        "SELECT {} FROM {} WHERE {} = ? LIMIT 1",
        quote_ansi(column),
        quote_ansi(table),
        quote_ansi(pk_column)
    )
}

/// SQLite has no `TRUNCATE`; an unfiltered `DELETE` is the equivalent.
pub fn delete_all_sql(table: &str) -> String {
    format!("DELETE FROM {}", quote_ansi(table))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_cell_quotes_all_identifiers() {
        assert_eq!(
            update_cell_sql("users", "name", "id"),
            "UPDATE \"users\" SET \"name\" = ? WHERE \"id\" = ?"
        );
        assert_eq!(
            update_cell_sql("we\"ird", "na\"me", "i\"d"),
            "UPDATE \"we\"\"ird\" SET \"na\"\"me\" = ? WHERE \"i\"\"d\" = ?"
        );
    }

    #[test]
    fn delete_rows_builds_one_placeholder_per_pk() {
        assert_eq!(
            delete_rows_sql("users", "id", 3),
            "DELETE FROM \"users\" WHERE \"id\" IN (?, ?, ?)"
        );
        assert_eq!(
            delete_rows_sql("we\"ird", "id", 1),
            "DELETE FROM \"we\"\"ird\" WHERE \"id\" IN (?)"
        );
    }

    #[test]
    fn insert_row_quotes_table_and_columns() {
        assert_eq!(
            insert_row_sql("users", ["a", "b\"b"].into_iter()),
            "INSERT INTO \"users\" (\"a\", \"b\"\"b\") VALUES (?, ?)"
        );
    }

    #[test]
    fn select_builders_quote_identifiers() {
        assert_eq!(
            select_row_sql("t\"1", "id"),
            "SELECT * FROM \"t\"\"1\" WHERE \"id\" = ? LIMIT 1"
        );
        assert_eq!(
            select_blob_sql("t", "da\"ta", "id"),
            "SELECT \"da\"\"ta\" FROM \"t\" WHERE \"id\" = ? LIMIT 1"
        );
    }

    #[test]
    fn delete_all_neutralizes_injection_shaped_table_name() {
        assert_eq!(
            delete_all_sql("x\";DROP TABLE users;--"),
            "DELETE FROM \"x\"\";DROP TABLE users;--\""
        );
    }
}
