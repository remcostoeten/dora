//! Integration tests for the MySQL metadata helpers.
//!
//! These tests cover the parsing and fallback behavior used by the metadata
//! service when MySQL statistics are not yet available or cannot be queried.

use app_lib::database::metadata::{build_mysql_metadata_fallback, parse_mysql_connection_target};

#[test]
fn parses_mysql_url_connection_target() {
    let target = parse_mysql_connection_target("mysql://user:pass@example.com:3307/mydb");

    assert_eq!(target.host, "example.com");
    assert_eq!(target.port, 3307);
    assert_eq!(target.database_name.as_deref(), Some("mydb"));
}

#[test]
fn parses_mysql_key_value_connection_target() {
    let target = parse_mysql_connection_target("host=db.internal port=3310 database=inventory");

    assert_eq!(target.host, "db.internal");
    assert_eq!(target.port, 3310);
    assert_eq!(target.database_name.as_deref(), Some("inventory"));
}

#[test]
fn fallback_metadata_uses_parsed_target_and_zeroes() {
    let metadata = build_mysql_metadata_fallback("mysql://root:pw@localhost:3306/app_db");

    assert_eq!(metadata.host, "localhost");
    assert_eq!(metadata.database_name.as_deref(), Some("app_db"));
    assert_eq!(metadata.size_bytes, 0);
    assert_eq!(metadata.table_count, 0);
    assert_eq!(metadata.row_count_total, 0);
    assert!(metadata.created_at.is_none());
    assert!(metadata.last_updated.is_none());
}
