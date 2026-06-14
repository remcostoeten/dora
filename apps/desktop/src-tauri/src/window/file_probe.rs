use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseFileKind {
    Sqlite,
    Duckdb,
    Unknown,
}

/// Identify an embedded database file from its header bytes.
///
/// - SQLite / libSQL local: `SQLite format 3\0` at offset 0
/// - DuckDB: `DUCK` at offset 8 (after an 8-byte checksum)
pub fn probe_database_file_header(bytes: &[u8]) -> DatabaseFileKind {
    if bytes.len() >= 16 && bytes[..16] == *b"SQLite format 3\0" {
        return DatabaseFileKind::Sqlite;
    }
    if bytes.len() >= 12 && bytes[8..12] == *b"DUCK" {
        return DatabaseFileKind::Duckdb;
    }
    DatabaseFileKind::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_sqlite_header() {
        let mut header = *b"SQLite format 3\0";
        header[15] = 0;
        assert_eq!(
            probe_database_file_header(&header),
            DatabaseFileKind::Sqlite
        );
    }

    #[test]
    fn detects_duckdb_header() {
        let mut bytes = [0u8; 16];
        bytes[8..12].copy_from_slice(b"DUCK");
        assert_eq!(probe_database_file_header(&bytes), DatabaseFileKind::Duckdb);
    }

    #[test]
    fn unknown_for_empty_or_short() {
        assert_eq!(probe_database_file_header(&[]), DatabaseFileKind::Unknown);
        assert_eq!(
            probe_database_file_header(b"not a db"),
            DatabaseFileKind::Unknown
        );
    }
}
