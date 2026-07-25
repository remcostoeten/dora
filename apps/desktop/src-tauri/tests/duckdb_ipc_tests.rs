//! End-to-end test of the out-of-process DuckDB transport: spawns the real
//! `duckdb_helper` binary and drives it through the `IpcDuckDbConn` client,
//! exercising open, a transactional batch, a raw query, and a streaming
//! `execute_query`.
//!
//! Gated on `duckdb-engine` to match the `duckdb_helper` binary's
//! `required-features`: without it the helper is never built, so the spawn
//! below would fail on a path that only exists in a stale target dir.
#![cfg(feature = "duckdb-engine")]

use app_lib::database::duckdb_ipc::client;
use app_lib::database::parser::ParsedStatement;
use app_lib::database::types::{channel, QueryExecEvent};

fn temp_db_path() -> String {
    let mut dir = std::env::temp_dir();
    dir.push(format!("dora-duckdb-ipc-{}.duckdb", std::process::id()));
    let _ = std::fs::remove_file(&dir);
    dir.to_string_lossy().into_owned()
}

#[tokio::test]
async fn helper_round_trips_batch_query_and_stream() {
    // Point the client at the freshly built helper binary.
    std::env::set_var("DORA_DUCKDB_HELPER", env!("CARGO_BIN_EXE_duckdb_helper"));

    let path = temp_db_path();
    let (conn, entries) = client::open(path.clone(), Vec::new())
        .await
        .expect("open should succeed");
    assert!(entries.is_empty(), "no file sources registered");

    let batch = conn
        .execute_batch(vec![
            "CREATE TABLE t (a INTEGER, b TEXT)".to_string(),
            "INSERT INTO t VALUES (1, 'one'), (2, 'two'), (3, 'three')".to_string(),
        ])
        .await
        .expect("batch should succeed");
    assert!(batch.success);

    let (columns, rows) = conn
        .query_raw("SELECT count(*) AS n FROM t".to_string())
        .await
        .expect("query_raw should succeed");
    assert_eq!(columns, vec!["n".to_string()]);
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0][0], serde_json::json!(3));

    // Streaming path: collect every event for an ordered SELECT.
    let (tx, mut rx) = channel();
    let stmt = ParsedStatement {
        statement: "SELECT a, b FROM t ORDER BY a".to_string(),
        returns_values: true,
        is_read_only: true,
    };
    let exec = tokio::spawn(async move { conn.execute_query(stmt, &tx).await });

    let mut saw_types = false;
    let mut saw_page = false;
    let mut finished_ok = false;
    while let Some(ev) = rx.recv().await {
        match ev {
            QueryExecEvent::TypesResolved { .. } => saw_types = true,
            QueryExecEvent::Page { .. } => saw_page = true,
            QueryExecEvent::Finished { error, .. } => {
                assert!(error.is_none(), "stream finished with error: {error:?}");
                finished_ok = true;
            }
        }
    }
    exec.await.unwrap().expect("execute_query should succeed");

    assert!(saw_types, "expected a TypesResolved event");
    assert!(saw_page, "expected at least one Page event");
    assert!(finished_ok, "expected a Finished event");

    let _ = std::fs::remove_file(&path);
}
