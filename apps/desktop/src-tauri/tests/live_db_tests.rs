//! Live-database adapter tests, gated behind `DORA_LIVE_DB_TESTS=1`.
//!
//! These run the full grid mutation sequence (insert → update → delete →
//! truncate) through the real [`app_lib::database::adapter`] write adapters
//! against actual servers, the coverage the in-memory SQLite/DuckDB unit
//! tests cannot provide for wire-protocol engines.
//!
//! Servers come from `docker-compose.databases.yml` at the repo root
//! (`docker compose -f docker-compose.databases.yml up -d --wait mysql mariadb`).
//! Note the non-default port mapping: **MySQL is on 3307**, MariaDB on 3306.
//! Override with `DORA_MYSQL_URL` / `DORA_MARIADB_URL`. Without
//! `DORA_LIVE_DB_TESTS=1` every test here is a silent pass so plain
//! `cargo test` stays fast and offline.

use app_lib::database::adapter::{MySqlAdapter, WriteAdapter};
use app_lib::database::dialect::MySqlDialect;
use mysql_async::prelude::Queryable;
use serde_json::json;
use std::sync::Arc;

fn live_enabled() -> bool {
    std::env::var("DORA_LIVE_DB_TESTS").ok().as_deref() == Some("1")
}

async fn mysql_family_lifecycle(url: &str, dialect: MySqlDialect) {
    let opts = mysql_async::Opts::from_url(url).expect("invalid database URL");
    let pool = mysql_async::Pool::new(opts);

    {
        let mut conn = pool.get_conn().await.expect("failed to connect");
        conn.query_drop("DROP TABLE IF EXISTS live_lifecycle")
            .await
            .unwrap();
        conn.query_drop(
            "CREATE TABLE live_lifecycle (id INT PRIMARY KEY, n INT, name VARCHAR(64))",
        )
        .await
        .unwrap();
    }

    let adapter = MySqlAdapter::new(Arc::new(pool.clone()), dialect);

    let mut row = serde_json::Map::new();
    row.insert("id".into(), json!(1));
    row.insert("n".into(), json!(41));
    row.insert("name".into(), json!("alpha"));
    let inserted = adapter
        .insert_row("live_lifecycle".into(), None, row)
        .await
        .unwrap();
    assert!(inserted.success);
    assert_eq!(inserted.affected_rows, 1);

    let updated = adapter
        .update_cell(
            "live_lifecycle".into(),
            None,
            "id".into(),
            json!(1),
            "name".into(),
            json!("beta"),
        )
        .await
        .unwrap();
    assert_eq!(updated.affected_rows, 1);

    {
        let mut conn = pool.get_conn().await.unwrap();
        let name: Option<String> = conn
            .query_first("SELECT name FROM live_lifecycle WHERE id = 1")
            .await
            .unwrap();
        assert_eq!(name.as_deref(), Some("beta"));
    }

    let deleted = adapter
        .delete_rows("live_lifecycle".into(), None, "id".into(), vec![json!(1)])
        .await
        .unwrap();
    assert_eq!(deleted.affected_rows, 1);

    {
        let mut conn = pool.get_conn().await.unwrap();
        conn.query_drop("INSERT INTO live_lifecycle VALUES (2, 0, 'stale')")
            .await
            .unwrap();
    }
    let truncated = adapter
        .truncate_table("live_lifecycle".into(), None, None)
        .await
        .unwrap();
    assert!(truncated.success);

    {
        let mut conn = pool.get_conn().await.unwrap();
        let count: Option<i64> = conn
            .query_first("SELECT COUNT(*) FROM live_lifecycle")
            .await
            .unwrap();
        assert_eq!(count, Some(0));
        conn.query_drop("DROP TABLE live_lifecycle").await.unwrap();
    }

    pool.disconnect().await.unwrap();
}

#[tokio::test]
async fn mysql_full_mutation_lifecycle() {
    if !live_enabled() {
        eprintln!("skipping mysql_full_mutation_lifecycle: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_MYSQL_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3307/dora".into());
    mysql_family_lifecycle(&url, MySqlDialect::MySql).await;
}

#[tokio::test]
async fn mariadb_full_mutation_lifecycle() {
    if !live_enabled() {
        eprintln!("skipping mariadb_full_mutation_lifecycle: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_MARIADB_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3306/dora".into());
    mysql_family_lifecycle(&url, MySqlDialect::MariaDb).await;
}
