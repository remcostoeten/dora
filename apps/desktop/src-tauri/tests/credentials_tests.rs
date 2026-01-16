//! Integration tests for the credentials module.
//!
//! This module tests the credential extraction functionality provided by
//! [`app_lib::credentials`]. These tests verify proper handling of database
//! connection strings, password extraction, and URL sanitization.
//!
//! # Source Module
//! - [`app_lib::credentials`](../src/credentials.rs)

use app_lib::database::types::DatabaseInfo;
use app_lib::credentials::extract_sensitive_data;

#[test]
fn postgres_with_password() {
    let original = "postgres://Dora:s3cr3t@localhost:5432/mydb";
    let dbi = DatabaseInfo::Postgres {
        connection_string: original.to_string(),
        ssh_config: None,
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");
    assert_eq!(pw.as_deref(), Some("s3cr3t"));

    match sanitized {
        DatabaseInfo::Postgres { connection_string, .. } => {
            assert_eq!(connection_string, "postgres://Dora@localhost:5432/mydb");
        }
        _ => unreachable!(),
    }
}

#[test]
fn postgres_with_percent_encoded_password() {
    let original = "postgres://bob:p%404ss@db.example.com/app";
    let dbi = DatabaseInfo::Postgres {
        connection_string: original.to_string(),
        ssh_config: None,
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");

    assert_eq!(pw.as_deref(), Some("p%404ss"));

    match sanitized {
        DatabaseInfo::Postgres { connection_string, .. } => {
            assert_eq!(connection_string, "postgres://bob@db.example.com/app");
        }
        _ => panic!("expected Postgres variant"),
    }
}

#[test]
fn postgres_with_empty_password() {
    let original = "postgres://john:@localhost/db";
    let dbi = DatabaseInfo::Postgres {
        connection_string: original.to_string(),
        ssh_config: None,
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");

    assert_eq!(pw.as_deref(), None);

    match sanitized {
        DatabaseInfo::Postgres { connection_string, .. } => {
            assert_eq!(connection_string, "postgres://john@localhost/db");
        }
        _ => unreachable!(),
    }
}

#[test]
fn postgres_without_password() {
    let original = "postgres://dave@localhost/mydb";
    let dbi = DatabaseInfo::Postgres {
        connection_string: original.to_string(),
        ssh_config: None,
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");

    assert!(pw.is_none());
    match sanitized {
        DatabaseInfo::Postgres { connection_string, .. } => {
            assert_eq!(connection_string, original);
        }
        _ => unreachable!(),
    }
}

#[test]
fn postgresql_scheme() {
    let original = "postgresql://erin:pw@localhost:5432/dbname?sslmode=prefer";
    let dbi = DatabaseInfo::Postgres {
        connection_string: original.to_string(),
        ssh_config: None,
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");

    assert_eq!(pw.as_deref(), Some("pw"));
    match sanitized {
        DatabaseInfo::Postgres { connection_string, .. } => {
            assert_eq!(
                connection_string,
                "postgresql://erin@localhost:5432/dbname?sslmode=prefer"
            );
        }
        _ => panic!("expected Postgres variant"),
    }
}

#[test]
fn sqlite_is_passthrough() {
    let path = "/tmp/test.sqlite3".to_string();
    let dbi = DatabaseInfo::SQLite {
        db_path: path.clone(),
    };

    let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");

    assert!(pw.is_none());
    match sanitized {
        DatabaseInfo::SQLite { db_path } => assert_eq!(db_path, path),
        _ => panic!("expected SQLite variant"),
    }
}

#[test]
fn invalid_url_yields_error() {
    let dbi = DatabaseInfo::Postgres {
        connection_string: "not a url".to_string(),
        ssh_config: None,
    };
    let res = extract_sensitive_data(dbi);
    assert!(res.is_err(), "expected parse error for invalid URL");
}
