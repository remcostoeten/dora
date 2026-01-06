//! SQL parser for libSQL
//!
//! LibSQL is SQLite-compatible, so we reuse the SQLite parser implementation.

use crate::{database::parser::ParsedStatement, Error};

/// Parse SQL statements using SQLite dialect (libSQL is SQLite-compatible)
pub fn parse_statements(query: &str) -> Result<Vec<ParsedStatement>, Error> {
    // LibSQL uses SQLite dialect
    Ok(crate::database::sqlite::parser::parse_statements(query)?)
}
