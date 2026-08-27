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

// ---------------------------------------------------------------------------
// Introspection: the collapsed/parallelized schema readers against real
// servers. These pin the connection-open overhaul: Postgres pipelined catalog
// queries + reltuples estimates, MySQL/MariaDB DATABASE()-scoped queries over
// two pooled connections, and libSQL's collapsed pragma-function queries
// against sqld (the one path that cannot be proven offline).
// ---------------------------------------------------------------------------

async fn pg_client(url: &str) -> tokio_postgres::Client {
    let (client, conn) = tokio_postgres::connect(url, tokio_postgres::NoTls)
        .await
        .expect("failed to connect to postgres");
    tokio::spawn(async move {
        let _ = conn.await;
    });
    client
}

async fn pg_introspection_roundtrip(url: &str, dialect: app_lib::database::dialect::PgDialect) {
    let client = pg_client(url).await;

    client
        .batch_execute(
            "DROP TABLE IF EXISTS live_intro_child; DROP TABLE IF EXISTS live_intro_parent;
             CREATE TABLE live_intro_parent (id SERIAL PRIMARY KEY, label TEXT NOT NULL);
             CREATE TABLE live_intro_child (
                 id SERIAL PRIMARY KEY,
                 parent_id INT REFERENCES live_intro_parent(id),
                 note TEXT
             );
             CREATE INDEX live_intro_child_note ON live_intro_child (note);
             INSERT INTO live_intro_parent (label) VALUES ('a'), ('b');",
        )
        .await
        .expect("fixture setup failed");

    let schema = app_lib::database::postgres::schema::get_database_schema(&client, dialect)
        .await
        .expect("introspection failed");

    let parent = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_parent")
        .expect("parent table introspected");
    assert_eq!(parent.primary_key_columns, vec!["id"]);
    assert!(parent
        .columns
        .iter()
        .any(|c| c.name == "label" && !c.is_nullable));

    let child = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_child")
        .expect("child table introspected");
    let parent_fk = child
        .columns
        .iter()
        .find(|c| c.name == "parent_id")
        .and_then(|c| c.foreign_key.as_ref())
        .expect("FK detected");
    assert_eq!(parent_fk.referenced_table, "live_intro_parent");
    assert!(child
        .indexes
        .iter()
        .any(|i| i.name == "live_intro_child_note"));

    client
        .batch_execute("DROP TABLE live_intro_child; DROP TABLE live_intro_parent;")
        .await
        .expect("fixture teardown failed");
}

#[tokio::test]
async fn postgres_introspection_roundtrip() {
    if !live_enabled() {
        eprintln!("skipping postgres_introspection_roundtrip: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_POSTGRES_URL")
        .unwrap_or_else(|_| "postgres://postgres:rootpass@127.0.0.1:5432/dora".into());
    pg_introspection_roundtrip(&url, app_lib::database::dialect::PgDialect::Postgres).await;
}

#[tokio::test]
async fn postgres_reltuples_estimates_after_analyze() {
    if !live_enabled() {
        eprintln!("skipping postgres_reltuples_estimates_after_analyze: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_POSTGRES_URL")
        .unwrap_or_else(|_| "postgres://postgres:rootpass@127.0.0.1:5432/dora".into());
    let client = pg_client(&url).await;

    client
        .batch_execute(
            "DROP TABLE IF EXISTS live_estimates;
             CREATE TABLE live_estimates (id INT PRIMARY KEY);
             INSERT INTO live_estimates SELECT generate_series(1, 500);
             ANALYZE live_estimates;",
        )
        .await
        .expect("fixture setup failed");

    let schema = app_lib::database::postgres::schema::get_database_schema(
        &client,
        app_lib::database::dialect::PgDialect::Postgres,
    )
    .await
    .expect("introspection failed");

    let table = schema
        .tables
        .iter()
        .find(|t| t.name == "live_estimates")
        .expect("table introspected");
    // reltuples comes from the catalog, so a just-ANALYZEd table reports its
    // real cardinality without any COUNT(*) on the introspection path.
    assert_eq!(table.row_count_estimate, Some(500));

    client
        .batch_execute("DROP TABLE live_estimates;")
        .await
        .expect("fixture teardown failed");
}

#[tokio::test]
async fn cockroach_introspection_roundtrip() {
    if !live_enabled() {
        eprintln!("skipping cockroach_introspection_roundtrip: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_COCKROACH_URL")
        .unwrap_or_else(|_| "postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable".into());
    pg_introspection_roundtrip(&url, app_lib::database::dialect::PgDialect::CockroachDb).await;
}

async fn mysql_introspection_roundtrip(url: &str, dialect: MySqlDialect) {
    let opts = mysql_async::Opts::from_url(url).expect("invalid database URL");
    let pool = mysql_async::Pool::new(opts);

    {
        let mut conn = pool.get_conn().await.expect("failed to connect");
        conn.query_drop("DROP TABLE IF EXISTS live_intro_child")
            .await
            .unwrap();
        conn.query_drop("DROP TABLE IF EXISTS live_intro_parent")
            .await
            .unwrap();
        conn.query_drop(
            "CREATE TABLE live_intro_parent (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(32) NOT NULL)",
        )
        .await
        .unwrap();
        conn.query_drop(
            "CREATE TABLE live_intro_child (
                 id INT AUTO_INCREMENT PRIMARY KEY,
                 parent_id INT,
                 note VARCHAR(64),
                 INDEX live_intro_child_note (note),
                 FOREIGN KEY (parent_id) REFERENCES live_intro_parent(id)
             )",
        )
        .await
        .unwrap();
    }

    let schema =
        app_lib::database::mysql::schema::get_database_schema(Arc::new(pool.clone()), dialect)
            .await
            .expect("introspection failed");

    let parent = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_parent")
        .expect("parent table introspected");
    assert_eq!(parent.primary_key_columns, vec!["id"]);
    assert!(parent
        .columns
        .iter()
        .any(|c| c.name == "id" && c.is_auto_increment));

    let child = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_child")
        .expect("child table introspected");
    let parent_fk = child
        .columns
        .iter()
        .find(|c| c.name == "parent_id")
        .and_then(|c| c.foreign_key.as_ref())
        .expect("FK detected");
    assert_eq!(parent_fk.referenced_table, "live_intro_parent");
    assert!(child
        .indexes
        .iter()
        .any(|i| i.name == "live_intro_child_note"));

    {
        let mut conn = pool.get_conn().await.unwrap();
        conn.query_drop("DROP TABLE live_intro_child")
            .await
            .unwrap();
        conn.query_drop("DROP TABLE live_intro_parent")
            .await
            .unwrap();
    }
    pool.disconnect().await.unwrap();
}

#[tokio::test]
async fn mysql_introspection_roundtrip_live() {
    if !live_enabled() {
        eprintln!("skipping mysql_introspection_roundtrip_live: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_MYSQL_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3307/dora".into());
    mysql_introspection_roundtrip(&url, MySqlDialect::MySql).await;
}

#[tokio::test]
async fn mariadb_introspection_roundtrip_live() {
    if !live_enabled() {
        eprintln!("skipping mariadb_introspection_roundtrip_live: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_MARIADB_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3306/dora".into());
    mysql_introspection_roundtrip(&url, MySqlDialect::MariaDb).await;
}

/// The decisive sqld test: the collapsed pragma-function introspection must be
/// accepted by a real sqld server, not just by local SQLite. Calls the
/// collapsed path directly so a sqld parser rejection fails the test instead
/// of silently taking the per-table fallback.
#[tokio::test]
async fn libsql_collapsed_introspection_against_sqld() {
    if !live_enabled() {
        eprintln!("skipping libsql_collapsed_introspection_against_sqld: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_LIBSQL_URL").unwrap_or_else(|_| "http://127.0.0.1:8081".into());

    let db = libsql::Builder::new_remote(url, String::new())
        .build()
        .await
        .expect("failed to build sqld client");
    let conn = db.connect().expect("failed to connect to sqld");

    conn.execute("DROP TABLE IF EXISTS live_intro_child", ())
        .await
        .unwrap();
    conn.execute("DROP TABLE IF EXISTS live_intro_parent", ())
        .await
        .unwrap();
    conn.execute(
        "CREATE TABLE live_intro_parent (id INTEGER PRIMARY KEY, label TEXT NOT NULL)",
        (),
    )
    .await
    .unwrap();
    conn.execute(
        "CREATE TABLE live_intro_child (
             id INTEGER PRIMARY KEY,
             parent_id INTEGER REFERENCES live_intro_parent(id),
             note TEXT
         )",
        (),
    )
    .await
    .unwrap();
    conn.execute(
        "CREATE INDEX live_intro_child_note ON live_intro_child (note)",
        (),
    )
    .await
    .unwrap();

    let schema = app_lib::database::libsql::schema::collapsed_introspect(&conn)
        .await
        .expect("sqld rejected the collapsed pragma-function introspection");

    let parent = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_parent")
        .expect("parent table introspected");
    assert_eq!(parent.primary_key_columns, vec!["id"]);

    let child = schema
        .tables
        .iter()
        .find(|t| t.name == "live_intro_child")
        .expect("child table introspected");
    let parent_fk = child
        .columns
        .iter()
        .find(|c| c.name == "parent_id")
        .and_then(|c| c.foreign_key.as_ref())
        .expect("FK detected");
    assert_eq!(parent_fk.referenced_table, "live_intro_parent");
    assert!(child
        .indexes
        .iter()
        .any(|i| i.name == "live_intro_child_note"));
    // Counts are deferred to the background refresher on every engine.
    assert!(schema.tables.iter().all(|t| t.row_count_estimate.is_none()));

    conn.execute("DROP TABLE live_intro_child", ())
        .await
        .unwrap();
    conn.execute("DROP TABLE live_intro_parent", ())
        .await
        .unwrap();
}
