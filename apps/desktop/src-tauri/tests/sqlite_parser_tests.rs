//! Integration tests for the SQLite parser module.
//!
//! This module tests SQL statement parsing functionality provided by
//! [`app_lib::database::sqlite::parser`]. These tests verify proper parsing
//! of various SQL statement types.
//!
//! # Source Module
//! - [`app_lib::database::sqlite::parser`](../src/database/sqlite/parser.rs)
//! - [`app_lib::database::parser`](../src/database/parser.rs)

use app_lib::database::sqlite::parser::parse_statements;

#[test]
fn parses_select_statements() {
    let stmts = parse_statements("SELECT * FROM users").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(stmts[0].returns_values);
}

#[test]
fn parses_insert_statements() {
    let stmts = parse_statements("INSERT INTO users (name) VALUES ('test')").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(!stmts[0].returns_values);
}

#[test]
fn parses_insert_returning() {
    let stmts = parse_statements("INSERT INTO users (name) VALUES ('test') RETURNING id").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(stmts[0].returns_values);
}

#[test]
fn parses_update_statements() {
    let stmts = parse_statements("UPDATE users SET name = 'test' WHERE id = 1").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(!stmts[0].returns_values);
}

#[test]
fn parses_delete_statements() {
    let stmts = parse_statements("DELETE FROM users WHERE id = 1").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(!stmts[0].returns_values);
}

#[test]
fn parses_multiple_statements() {
    let stmts = parse_statements("SELECT * FROM users; SELECT * FROM orders").unwrap();
    assert_eq!(stmts.len(), 2);
}

#[test]
fn handles_whitespace() {
    let stmts = parse_statements("   SELECT * FROM users   ").unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(stmts[0].returns_values);
}
