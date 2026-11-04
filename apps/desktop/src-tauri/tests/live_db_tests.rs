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
//!
//! The `*_kv_*` tests drive the Redis/Valkey key-value service the way the
//! Tauri `kv_*` commands do. Redis is on 6379 and Valkey on 6380 (override with
//! `DORA_REDIS_URL` / `DORA_VALKEY_URL`); each test works under its own key
//! prefix and removes it afterwards with SCAN, never KEYS.

use app_lib::database::adapter::{MySqlAdapter, WriteAdapter};
use app_lib::database::dialect::MySqlDialect;
use app_lib::kv::{
    classify_raw_command, KvBytes, KvConnection, KvConnectionConfig, KvDataType, KvKeySummary,
    KvReadRequest, KvReadResult, KvScanRequest, KvValue, RawCommandResult, RawCommandSafety,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use mysql_async::prelude::Queryable;
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::future::Future;
use std::sync::Arc;
use std::time::Duration;

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

/// The dump's contract: what it writes back into an empty database must be the
/// database it read. Fixture types are the ones a naive value formatter loses —
/// timestamps, uuid, jsonb, arrays, bytea, numeric — plus text carrying the
/// quote and backslash characters that break naive escaping.
#[tokio::test]
async fn postgres_dump_restores_into_an_empty_database() {
    if !live_enabled() {
        eprintln!(
            "skipping postgres_dump_restores_into_an_empty_database: DORA_LIVE_DB_TESTS != 1"
        );
        return;
    }
    let url = std::env::var("DORA_POSTGRES_URL")
        .unwrap_or_else(|_| "postgres://postgres:rootpass@127.0.0.1:5432/dora".into());
    let client = pg_client(&url).await;

    client
        .batch_execute(
            "DROP TABLE IF EXISTS live_dump_child; DROP TABLE IF EXISTS live_dump_parent;
             DROP TYPE IF EXISTS live_dump_mood;
             CREATE TYPE live_dump_mood AS ENUM ('calm', 'loud');
             CREATE TABLE live_dump_parent (
                 id BIGSERIAL PRIMARY KEY,
                 label TEXT NOT NULL,
                 amount NUMERIC(12, 4),
                 active BOOLEAN NOT NULL,
                 tags INT[],
                 payload JSONB,
                 external_id UUID,
                 blob BYTEA,
                 seen_at TIMESTAMPTZ,
                 mood live_dump_mood,
                 title VARCHAR(64)
             );
             CREATE TABLE live_dump_child (
                 id SERIAL PRIMARY KEY,
                 parent_id INT REFERENCES live_dump_parent(id),
                 note TEXT
             );
             INSERT INTO live_dump_parent
                 (label, amount, active, tags, payload, external_id, blob, seen_at, mood, title)
             VALUES
                 ('o''reilly\\path', 1234.5678, true, '{1,2,3}', '{\"k\": [1, \"v\"]}',
                  '11111111-2222-3333-4444-555555555555', '\\x00ff10',
                  '2026-09-16 10:11:12+00', 'loud', 'a title'),
                 ('plain', NULL, false, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
             INSERT INTO live_dump_child (parent_id, note) VALUES (1, 'first'), (2, NULL);",
        )
        .await
        .expect("fixture setup failed");

    let mut schema = app_lib::database::postgres::schema::get_database_schema(
        &client,
        app_lib::database::dialect::PgDialect::Postgres,
    )
    .await
    .expect("introspection failed");
    // The dump covers the whole database, so narrow it to this test's fixtures:
    // sibling tests create and drop their own tables in the same schema.
    schema
        .tables
        .retain(|table| table.name.starts_with("live_dump_"));
    assert_eq!(schema.tables.len(), 2, "fixture tables not introspected");

    let dump_path = std::env::temp_dir().join("dora-live-dump.sql");
    let dump_path = dump_path.to_str().expect("temp path is utf-8");
    app_lib::database::maintenance::dump_database_postgres(&client, &schema, dump_path)
        .await
        .expect("dump failed");
    let dump = std::fs::read_to_string(dump_path).expect("dump file readable");

    let before = client
        .query(
            "SELECT label, amount::text, active, tags, payload, external_id, blob, seen_at,
                    mood::text, title
             FROM live_dump_parent ORDER BY id",
            &[],
        )
        .await
        .expect("read fixture rows");

    client
        .batch_execute(
            "DROP TABLE live_dump_child; DROP TABLE live_dump_parent; DROP TYPE live_dump_mood;",
        )
        .await
        .expect("fixture drop failed");

    client
        .batch_execute(&dump)
        .await
        .expect("dump did not restore");

    let after = client
        .query(
            "SELECT label, amount::text, active, tags, payload, external_id, blob, seen_at,
                    mood::text, title
             FROM live_dump_parent ORDER BY id",
            &[],
        )
        .await
        .expect("read restored rows");

    assert_eq!(before.len(), after.len());
    for (before_row, after_row) in before.iter().zip(after.iter()) {
        assert_eq!(
            before_row.get::<_, String>(0),
            after_row.get::<_, String>(0)
        );
        assert_eq!(
            before_row.get::<_, Option<String>>(1),
            after_row.get::<_, Option<String>>(1)
        );
        assert_eq!(before_row.get::<_, bool>(2), after_row.get::<_, bool>(2));
        assert_eq!(
            before_row.get::<_, Option<Vec<i32>>>(3),
            after_row.get::<_, Option<Vec<i32>>>(3)
        );
        assert_eq!(
            before_row.get::<_, Option<serde_json::Value>>(4),
            after_row.get::<_, Option<serde_json::Value>>(4)
        );
        assert_eq!(
            before_row.get::<_, Option<uuid::Uuid>>(5),
            after_row.get::<_, Option<uuid::Uuid>>(5)
        );
        assert_eq!(
            before_row.get::<_, Option<Vec<u8>>>(6),
            after_row.get::<_, Option<Vec<u8>>>(6)
        );
        assert_eq!(
            before_row.get::<_, Option<chrono::DateTime<chrono::Utc>>>(7),
            after_row.get::<_, Option<chrono::DateTime<chrono::Utc>>>(7)
        );
        assert_eq!(
            before_row.get::<_, Option<String>>(8),
            after_row.get::<_, Option<String>>(8)
        );
        assert_eq!(
            before_row.get::<_, Option<String>>(9),
            after_row.get::<_, Option<String>>(9)
        );
    }

    // The restored foreign key and sequence must work, not just exist.
    client
        .execute(
            "INSERT INTO live_dump_child (parent_id, note) VALUES (1, 'after restore')",
            &[],
        )
        .await
        .expect("restored foreign key rejected a valid row");
    let next_parent: i64 = client
        .query_one(
            "INSERT INTO live_dump_parent (label, active) VALUES ('next', true) RETURNING id",
            &[],
        )
        .await
        .expect("restored sequence rejected an insert")
        .get(0);
    assert!(
        next_parent > 2,
        "sequence was not moved past the dumped rows: got {next_parent}"
    );

    client
        .batch_execute(
            "DROP TABLE live_dump_child; DROP TABLE live_dump_parent; DROP TYPE live_dump_mood;",
        )
        .await
        .expect("fixture teardown failed");
    let _ = std::fs::remove_file(dump_path);
    assert!(dump.contains("CREATE TABLE"), "dump carried no DDL");
}

/// Same contract for MySQL: dump, drop, restore, compare. The DDL here comes
/// from `SHOW CREATE TABLE`, so the test is mostly about the data — binary
/// columns, quotes and backslashes, dates — and about the statements around it
/// letting a table load before the table it references exists.
#[tokio::test]
async fn mysql_dump_restores_into_an_empty_database() {
    if !live_enabled() {
        eprintln!("skipping mysql_dump_restores_into_an_empty_database: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var("DORA_MYSQL_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3307/dora".into());
    let pool = mysql_async::Pool::new(url.as_str());
    let mut conn = pool.get_conn().await.expect("mysql connect failed");

    for statement in [
        "DROP TABLE IF EXISTS live_dump_my_child",
        "DROP TABLE IF EXISTS live_dump_my_parent",
        "CREATE TABLE live_dump_my_parent (
             id INT AUTO_INCREMENT PRIMARY KEY,
             label VARCHAR(64) NOT NULL,
             amount DECIMAL(12, 4),
             active TINYINT(1) NOT NULL,
             payload JSON,
             blob_col VARBINARY(16),
             seen_at DATETIME
         )",
        "CREATE TABLE live_dump_my_child (
             id INT AUTO_INCREMENT PRIMARY KEY,
             parent_id INT,
             note TEXT,
             CONSTRAINT live_dump_my_fk FOREIGN KEY (parent_id)
                 REFERENCES live_dump_my_parent (id)
         )",
        "INSERT INTO live_dump_my_parent (label, amount, active, payload, blob_col, seen_at)
         VALUES ('o\\'reilly\\\\path', 1234.5678, 1, '{\"k\": 1}', UNHEX('00FF10'),
                 '2026-09-16 10:11:12'),
                ('plain', NULL, 0, NULL, NULL, NULL)",
        "INSERT INTO live_dump_my_child (parent_id, note) VALUES (1, 'first'), (2, NULL)",
    ] {
        conn.query_drop(statement)
            .await
            .expect("fixture setup failed");
    }

    let mut schema = app_lib::database::mysql::schema::get_database_schema(
        Arc::new(pool.clone()),
        MySqlDialect::MySql,
    )
    .await
    .expect("introspection failed");
    schema
        .tables
        .retain(|table| table.name.starts_with("live_dump_my_"));
    assert_eq!(schema.tables.len(), 2, "fixture tables not introspected");

    let dump_path = std::env::temp_dir().join("dora-live-dump-mysql.sql");
    let dump_path = dump_path.to_str().expect("temp path is utf-8");
    app_lib::database::maintenance::dump_database_mysql(&pool, &schema, dump_path)
        .await
        .expect("dump failed");
    let dump = std::fs::read_to_string(dump_path).expect("dump file readable");

    let before: Vec<mysql_async::Row> = conn
        .query(
            "SELECT label, amount, active, payload, HEX(blob_col), seen_at
             FROM live_dump_my_parent ORDER BY id",
        )
        .await
        .expect("read fixture rows");

    conn.query_drop("DROP TABLE live_dump_my_child")
        .await
        .expect("fixture drop failed");
    conn.query_drop("DROP TABLE live_dump_my_parent")
        .await
        .expect("fixture drop failed");

    for parsed in app_lib::database::mysql::parser::parse_statements(&dump)
        .expect("dump did not parse as MySQL")
    {
        conn.query_drop(&parsed.statement)
            .await
            .unwrap_or_else(|e| panic!("restore failed on `{}`: {e}", parsed.statement));
    }

    let after: Vec<mysql_async::Row> = conn
        .query(
            "SELECT label, amount, active, payload, HEX(blob_col), seen_at
             FROM live_dump_my_parent ORDER BY id",
        )
        .await
        .expect("read restored rows");

    assert_eq!(before.len(), after.len());
    for (before_row, after_row) in before.iter().zip(after.iter()) {
        assert_eq!(
            format!("{:?}", before_row.as_ref(0)),
            format!("{:?}", after_row.as_ref(0))
        );
        for index in 1..6 {
            assert_eq!(
                format!("{:?}", before_row.as_ref(index)),
                format!("{:?}", after_row.as_ref(index)),
                "column {index} differs after restore"
            );
        }
    }

    conn.query_drop("INSERT INTO live_dump_my_child (parent_id, note) VALUES (1, 'after restore')")
        .await
        .expect("restored foreign key rejected a valid row");

    conn.query_drop("DROP TABLE live_dump_my_child")
        .await
        .expect("fixture teardown failed");
    conn.query_drop("DROP TABLE live_dump_my_parent")
        .await
        .expect("fixture teardown failed");
    drop(conn);
    pool.disconnect().await.ok();
    let _ = std::fs::remove_file(dump_path);
    assert!(dump.contains("CREATE TABLE"), "dump carried no DDL");
}

struct KvTarget {
    url_env: &'static str,
    default_url: &'static str,
    version_marker: &'static str,
}

const REDIS_TARGET: KvTarget = KvTarget {
    url_env: "DORA_REDIS_URL",
    default_url: "redis://127.0.0.1:6379",
    version_marker: "redis_version:",
};

const VALKEY_TARGET: KvTarget = KvTarget {
    url_env: "DORA_VALKEY_URL",
    default_url: "redis://127.0.0.1:6380",
    version_marker: "valkey_version:",
};

#[derive(Clone)]
struct KvContext {
    prefix: String,
    version_marker: &'static str,
}

impl KvContext {
    fn name(&self, suffix: &str) -> String {
        format!("{}{suffix}", self.prefix)
    }

    fn key(&self, suffix: &str) -> KvBytes {
        kv_text(&self.name(suffix))
    }
}

fn kv_text(value: &str) -> KvBytes {
    KvBytes::Utf8(value.to_string())
}

fn kv_utf8(value: &KvBytes) -> String {
    match value {
        KvBytes::Utf8(text) => text.clone(),
        KvBytes::Base64(_) => panic!("expected utf8 bytes, got {value:?}"),
    }
}

fn kv_utf8_all(values: &[KvBytes]) -> Vec<String> {
    values.iter().map(kv_utf8).collect()
}

fn raw_text(result: RawCommandResult) -> String {
    match result {
        RawCommandResult::Text(text) => text,
        RawCommandResult::Bytes(bytes) => kv_utf8(&bytes),
        other => panic!("expected a text reply, got {other:?}"),
    }
}

fn raw_integer(result: RawCommandResult) -> i64 {
    match result {
        RawCommandResult::Integer(value) => value,
        other => panic!("expected an integer reply, got {other:?}"),
    }
}

fn expect_string(result: KvReadResult) -> (KvBytes, u64, bool) {
    match result.value {
        KvValue::String {
            value,
            total_bytes,
            truncated,
        } => (value, total_bytes, truncated),
        other => panic!("expected a string value, got {other:?}"),
    }
}

fn expect_hash(result: KvReadResult) -> (BTreeMap<String, String>, u64) {
    match result.value {
        KvValue::Hash { entries, cursor } => (
            entries
                .iter()
                .map(|entry| (kv_utf8(&entry.field), kv_utf8(&entry.value)))
                .collect(),
            cursor,
        ),
        other => panic!("expected a hash value, got {other:?}"),
    }
}

fn expect_list(result: KvReadResult) -> (Vec<String>, u64, u64, bool) {
    match result.value {
        KvValue::List {
            items,
            offset,
            total_items,
            has_more,
        } => (kv_utf8_all(&items), offset, total_items, has_more),
        other => panic!("expected a list value, got {other:?}"),
    }
}

fn expect_set(result: KvReadResult) -> (BTreeSet<String>, u64) {
    match result.value {
        KvValue::Set { members, cursor } => (kv_utf8_all(&members).into_iter().collect(), cursor),
        other => panic!("expected a set value, got {other:?}"),
    }
}

fn expect_sorted_set(result: KvReadResult) -> (BTreeMap<String, f64>, u64) {
    match result.value {
        KvValue::SortedSet { members, cursor } => (
            members
                .iter()
                .map(|entry| (kv_utf8(&entry.member), entry.score))
                .collect(),
            cursor,
        ),
        other => panic!("expected a sorted set value, got {other:?}"),
    }
}

async fn kv_read_page(
    service: &mut KvConnection,
    key: &KvBytes,
    cursor: Option<u64>,
    offset: Option<u64>,
    limit: Option<u32>,
) -> KvReadResult {
    service
        .read(KvReadRequest {
            key: key.clone(),
            cursor,
            offset,
            limit,
        })
        .await
        .expect("read failed")
}

async fn kv_read(service: &mut KvConnection, key: &KvBytes) -> KvReadResult {
    kv_read_page(service, key, None, None, None).await
}

async fn kv_scan_all(
    service: &mut KvConnection,
    pattern: &str,
    limit: u32,
) -> (Vec<KvKeySummary>, usize) {
    let mut cursor = None;
    let mut summaries = Vec::new();
    let mut pages = 0;
    for _ in 0..100_000 {
        let page = service
            .scan(KvScanRequest {
                cursor,
                pattern: Some(pattern.to_string()),
                limit: Some(limit),
            })
            .await
            .expect("scan failed");
        pages += 1;
        summaries.extend(page.keys);
        if page.cursor == 0 {
            return (summaries, pages);
        }
        cursor = Some(page.cursor);
    }
    panic!("SCAN for {pattern} never returned cursor 0");
}

async fn kv_cleanup(service: &mut KvConnection, prefix: &str) {
    let (summaries, _) = kv_scan_all(service, &format!("{prefix}*"), 500).await;
    for summary in summaries {
        service
            .delete_key(summary.key)
            .await
            .expect("cleanup delete failed");
    }
}

async fn kv_collect_pages(
    service: &mut KvConnection,
    key: &KvBytes,
    limit: u32,
    extract: impl Fn(KvReadResult) -> (Vec<String>, u64),
) -> (BTreeSet<String>, usize) {
    let mut cursor = None;
    let mut collected = BTreeSet::new();
    let mut pages = 0;
    for _ in 0..10_000 {
        let (page, next) = extract(kv_read_page(service, key, cursor, None, Some(limit)).await);
        pages += 1;
        collected.extend(page);
        if next == 0 {
            return (collected, pages);
        }
        cursor = Some(next);
    }
    panic!("cursor paging never finished");
}

async fn run_kv_scenario<Scenario, Outcome>(test: &str, target: &KvTarget, scenario: Scenario)
where
    Scenario: FnOnce(KvConnection, KvContext) -> Outcome,
    Outcome: Future<Output = ()> + Send + 'static,
{
    if !live_enabled() {
        eprintln!("skipping {test}: DORA_LIVE_DB_TESTS != 1");
        return;
    }
    let url = std::env::var(target.url_env).unwrap_or_else(|_| target.default_url.into());
    let mut service = KvConnection::connect(&KvConnectionConfig { url: url.clone() })
        .await
        .unwrap_or_else(|error| panic!("failed to connect to {url}: {error}"));
    let context = KvContext {
        prefix: format!("dora-live:{test}:{}:", uuid::Uuid::new_v4().simple()),
        version_marker: target.version_marker,
    };
    kv_cleanup(&mut service, &context.prefix).await;
    let outcome = tokio::spawn(scenario(service.clone(), context.clone())).await;
    kv_cleanup(&mut service, &context.prefix).await;
    if let Err(error) = outcome {
        std::panic::resume_unwind(error.into_panic());
    }
}

async fn kv_connect_and_ping(mut service: KvConnection, context: KvContext) {
    service.probe().await.expect("PING probe failed");

    let pong = service
        .execute_raw("PING", None)
        .await
        .expect("raw PING failed");
    assert_eq!(raw_text(pong), "PONG");

    let info = service
        .execute_raw("INFO server", None)
        .await
        .expect("raw INFO failed");
    assert!(
        raw_text(info).contains(context.version_marker),
        "server did not identify itself with {}",
        context.version_marker
    );

    let wrong_scheme = KvConnection::connect(&KvConnectionConfig {
        url: "postgres://127.0.0.1:5432".into(),
    })
    .await;
    assert!(wrong_scheme.is_err(), "non-redis scheme was accepted");

    let refused = KvConnection::connect(&KvConnectionConfig {
        url: "redis://127.0.0.1:1".into(),
    })
    .await;
    assert!(refused.is_err(), "closed port was reported as connected");
}

async fn kv_string_set_get_and_ttl(mut service: KvConnection, context: KvContext) {
    let key = context.key("greeting");

    let created = service
        .set_string(key.clone(), kv_text("hello"), false)
        .await
        .unwrap();
    assert_eq!(created.changed, 1);

    let read = kv_read(&mut service, &key).await;
    assert_eq!(read.key, key);
    assert_eq!(read.ttl_ms, None);
    let (value, total_bytes, truncated) = expect_string(read);
    assert_eq!(value, kv_text("hello"));
    assert_eq!(total_bytes, 5);
    assert!(!truncated);

    let ttl_set = service.set_ttl_ms(key.clone(), 60_000).await.unwrap();
    assert_eq!(ttl_set.changed, 1);
    let ttl = kv_read(&mut service, &key)
        .await
        .ttl_ms
        .expect("TTL missing after PEXPIRE");
    assert!(ttl > 0 && ttl <= 60_000, "unexpected TTL {ttl}");

    service
        .set_string(key.clone(), kv_text("world"), true)
        .await
        .unwrap();
    let kept = kv_read(&mut service, &key).await;
    assert!(kept.ttl_ms.is_some(), "KEEPTTL dropped the TTL");
    assert_eq!(expect_string(kept).0, kv_text("world"));

    service
        .set_string(key.clone(), kv_text("again"), false)
        .await
        .unwrap();
    assert_eq!(
        kv_read(&mut service, &key).await.ttl_ms,
        None,
        "plain SET should drop the TTL"
    );

    service.set_ttl_ms(key.clone(), 60_000).await.unwrap();
    let cleared = service.clear_ttl(key.clone()).await.unwrap();
    assert_eq!(cleared.changed, 1);
    assert_eq!(kv_read(&mut service, &key).await.ttl_ms, None);
    let cleared_again = service.clear_ttl(key.clone()).await.unwrap();
    assert_eq!(cleared_again.changed, 0);

    assert!(service.set_ttl_ms(key.clone(), 0).await.is_err());
    let missing = service
        .set_ttl_ms(context.key("missing"), 1_000)
        .await
        .unwrap();
    assert_eq!(missing.changed, 0);

    service.set_ttl_ms(key.clone(), 150).await.unwrap();
    tokio::time::sleep(Duration::from_millis(400)).await;
    let expired = service
        .read(KvReadRequest {
            key: key.clone(),
            cursor: None,
            offset: None,
            limit: None,
        })
        .await
        .unwrap_err();
    assert!(
        expired.to_string().contains("does not exist"),
        "unexpected error for an expired key: {expired}"
    );
}

async fn kv_string_binary_and_paging(mut service: KvConnection, context: KvContext) {
    let mut key_bytes = context.name("binary-key-").into_bytes();
    key_bytes.extend([0xff, 0x00, 0x01]);
    let binary_key = KvBytes::Base64(STANDARD.encode(&key_bytes));
    let binary_value = KvBytes::Base64(STANDARD.encode([0x00, 0xff, 0xfe, b'z']));

    service
        .set_string(binary_key.clone(), binary_value.clone(), false)
        .await
        .unwrap();
    let read = kv_read(&mut service, &binary_key).await;
    assert_eq!(read.key, binary_key);
    assert_eq!(expect_string(read).0, binary_value);

    let (found, _) = kv_scan_all(&mut service, &context.name("binary-key-*"), 100).await;
    assert!(
        found.iter().any(|summary| summary.key == binary_key),
        "scan lost the non-utf8 key"
    );

    let long_key = context.key("long");
    let long_value = "abcdefghij".repeat(250);
    service
        .set_string(long_key.clone(), kv_text(&long_value), false)
        .await
        .unwrap();

    let first = kv_read_page(&mut service, &long_key, None, None, Some(1_000)).await;
    let (head, total_bytes, truncated) = expect_string(first);
    assert_eq!(kv_utf8(&head), long_value[..1_000]);
    assert_eq!(total_bytes, 2_500);
    assert!(truncated);

    let middle = kv_read_page(&mut service, &long_key, None, Some(1_000), Some(1_000)).await;
    let (middle_value, _, middle_truncated) = expect_string(middle);
    assert_eq!(kv_utf8(&middle_value), long_value[1_000..2_000]);
    assert!(middle_truncated);

    let last = kv_read_page(&mut service, &long_key, None, Some(2_000), Some(1_000)).await;
    let (tail, _, tail_truncated) = expect_string(last);
    assert_eq!(kv_utf8(&tail), long_value[2_000..]);
    assert!(!tail_truncated);

    let missing = service
        .read(KvReadRequest {
            key: context.key("never-written"),
            cursor: None,
            offset: None,
            limit: None,
        })
        .await
        .unwrap_err();
    assert!(missing.to_string().contains("does not exist"));
}

async fn kv_hash_read_and_write(mut service: KvConnection, context: KvContext) {
    let key = context.key("profile");

    let added = service
        .hash_set(key.clone(), kv_text("name"), kv_text("Ada"))
        .await
        .unwrap();
    assert_eq!(added.changed, 1);
    let updated = service
        .hash_set(key.clone(), kv_text("name"), kv_text("Lovelace"))
        .await
        .unwrap();
    assert_eq!(updated.changed, 0);
    service
        .hash_set(key.clone(), kv_text("role"), kv_text("analyst"))
        .await
        .unwrap();

    let read = kv_read(&mut service, &key).await;
    assert_eq!(read.ttl_ms, None);
    let (entries, cursor) = expect_hash(read);
    assert_eq!(cursor, 0);
    assert_eq!(
        entries,
        BTreeMap::from([
            ("name".to_string(), "Lovelace".to_string()),
            ("role".to_string(), "analyst".to_string()),
        ])
    );

    let removed = service
        .hash_delete(key.clone(), kv_text("name"))
        .await
        .unwrap();
    assert_eq!(removed.changed, 1);
    let removed_again = service
        .hash_delete(key.clone(), kv_text("name"))
        .await
        .unwrap();
    assert_eq!(removed_again.changed, 0);
    let (remaining, _) = expect_hash(kv_read(&mut service, &key).await);
    assert_eq!(
        remaining,
        BTreeMap::from([("role".to_string(), "analyst".to_string())])
    );

    service
        .hash_delete(key.clone(), kv_text("role"))
        .await
        .unwrap();
    let gone = service
        .read(KvReadRequest {
            key,
            cursor: None,
            offset: None,
            limit: None,
        })
        .await;
    assert!(gone.is_err(), "empty hash should vanish");
}

async fn kv_list_read_and_write(mut service: KvConnection, context: KvContext) {
    let key = context.key("queue");

    assert!(
        service
            .list_push(key.clone(), kv_text("a"), false)
            .await
            .unwrap()
            .changed
            > 0
    );
    service
        .list_push(key.clone(), kv_text("b"), false)
        .await
        .unwrap();
    service
        .list_push(key.clone(), kv_text("z"), true)
        .await
        .unwrap();

    let (items, offset, total, has_more) = expect_list(kv_read(&mut service, &key).await);
    assert_eq!(items, ["z", "a", "b"]);
    assert_eq!((offset, total, has_more), (0, 3, false));

    let first = kv_read_page(&mut service, &key, None, Some(0), Some(2)).await;
    let (items, offset, total, has_more) = expect_list(first);
    assert_eq!(items, ["z", "a"]);
    assert_eq!((offset, total, has_more), (0, 3, true));

    let second = kv_read_page(&mut service, &key, None, Some(2), Some(2)).await;
    let (items, offset, total, has_more) = expect_list(second);
    assert_eq!(items, ["b"]);
    assert_eq!((offset, total, has_more), (2, 3, false));

    let replaced = service
        .list_set(key.clone(), 1, kv_text("A"))
        .await
        .unwrap();
    assert_eq!(replaced.changed, 1);
    assert_eq!(
        expect_list(kv_read(&mut service, &key).await).0,
        ["z", "A", "b"]
    );

    let removed = service.list_remove_at(key.clone(), 1).await.unwrap();
    assert_eq!(removed.changed, 1);
    let (items, _, total, _) = expect_list(kv_read(&mut service, &key).await);
    assert_eq!(items, ["z", "b"]);
    assert_eq!(total, 2);

    assert!(service.list_remove_at(key.clone(), 9).await.is_err());
    assert!(service
        .list_set(key.clone(), 9, kv_text("nope"))
        .await
        .is_err());
    assert_eq!(
        expect_list(kv_read(&mut service, &key).await).0,
        ["z", "b"],
        "failed edits must not change the list"
    );

    service.list_remove_at(key.clone(), -1).await.unwrap();
    assert_eq!(expect_list(kv_read(&mut service, &key).await).0, ["z"]);
}

async fn kv_set_read_and_write(mut service: KvConnection, context: KvContext) {
    let key = context.key("tags");

    assert_eq!(
        service
            .set_add(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        1
    );
    assert_eq!(
        service
            .set_add(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        0
    );
    service.set_add(key.clone(), kv_text("b")).await.unwrap();

    let (members, cursor) = expect_set(kv_read(&mut service, &key).await);
    assert_eq!(cursor, 0);
    assert_eq!(members, BTreeSet::from(["a".to_string(), "b".to_string()]));

    assert_eq!(
        service
            .set_remove(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        1
    );
    assert_eq!(
        service
            .set_remove(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        0
    );
    let (members, _) = expect_set(kv_read(&mut service, &key).await);
    assert_eq!(members, BTreeSet::from(["b".to_string()]));
}

async fn kv_sorted_set_read_and_write(mut service: KvConnection, context: KvContext) {
    let key = context.key("leaders");

    assert_eq!(
        service
            .sorted_set_add(key.clone(), kv_text("a"), 1.5)
            .await
            .unwrap()
            .changed,
        1
    );
    service
        .sorted_set_add(key.clone(), kv_text("b"), 2.0)
        .await
        .unwrap();
    let rescored = service
        .sorted_set_add(key.clone(), kv_text("a"), 3.0)
        .await
        .unwrap();
    assert_eq!(rescored.changed, 0);

    let (members, cursor) = expect_sorted_set(kv_read(&mut service, &key).await);
    assert_eq!(cursor, 0);
    assert_eq!(
        members,
        BTreeMap::from([("a".to_string(), 3.0), ("b".to_string(), 2.0)])
    );

    for score in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let rejected = service
            .sorted_set_add(key.clone(), kv_text("bad"), score)
            .await
            .unwrap_err();
        assert!(
            rejected.to_string().contains("finite"),
            "unexpected error for score {score}: {rejected}"
        );
    }

    assert_eq!(
        service
            .sorted_set_remove(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        1
    );
    assert_eq!(
        service
            .sorted_set_remove(key.clone(), kv_text("a"))
            .await
            .unwrap()
            .changed,
        0
    );
    let (members, _) = expect_sorted_set(kv_read(&mut service, &key).await);
    assert_eq!(members, BTreeMap::from([("b".to_string(), 2.0)]));
}

async fn kv_large_collection_cursors(mut service: KvConnection, context: KvContext) {
    let count = 1_000;
    let hash_key = context.key("big-hash");
    let set_key = context.key("big-set");
    let zset_key = context.key("big-zset");

    let hash_args = (0..count)
        .map(|index| format!("field{index:03} value{index:03}"))
        .collect::<Vec<_>>()
        .join(" ");
    let set_args = (0..count)
        .map(|index| format!("member{index:03}"))
        .collect::<Vec<_>>()
        .join(" ");
    let zset_args = (0..count)
        .map(|index| format!("{index} member{index:03}"))
        .collect::<Vec<_>>()
        .join(" ");
    for command in [
        format!("HSET {} {hash_args}", context.name("big-hash")),
        format!("SADD {} {set_args}", context.name("big-set")),
        format!("ZADD {} {zset_args}", context.name("big-zset")),
    ] {
        let reply = service.execute_raw(&command, None).await.unwrap();
        assert_eq!(raw_integer(reply), count);
    }

    let (fields, hash_pages) = kv_collect_pages(&mut service, &hash_key, 40, |result| {
        let (entries, cursor) = expect_hash(result);
        (entries.into_keys().collect(), cursor)
    })
    .await;
    assert_eq!(fields.len(), count as usize);
    assert!(hash_pages > 1, "hash was not paged by cursor");

    let (members, set_pages) = kv_collect_pages(&mut service, &set_key, 40, |result| {
        let (members, cursor) = expect_set(result);
        (members.into_iter().collect(), cursor)
    })
    .await;
    assert_eq!(members.len(), count as usize);
    assert!(set_pages > 1, "set was not paged by cursor");

    let (ranked, zset_pages) = kv_collect_pages(&mut service, &zset_key, 40, |result| {
        let (members, cursor) = expect_sorted_set(result);
        (members.into_keys().collect(), cursor)
    })
    .await;
    assert_eq!(ranked.len(), count as usize);
    assert!(zset_pages > 1, "sorted set was not paged by cursor");
}

async fn kv_scan_pagination(mut service: KvConnection, context: KvContext) {
    let mut expected = BTreeSet::new();
    for index in 0..25 {
        let name = context.name(&format!("item:{index:02}"));
        service
            .set_string(kv_text(&name), kv_text("x"), false)
            .await
            .unwrap();
        expected.insert(name);
    }

    let (summaries, pages) = kv_scan_all(&mut service, &context.name("item:*"), 5).await;
    let found: BTreeSet<String> = summaries.iter().map(|s| kv_utf8(&s.key)).collect();
    assert_eq!(found, expected);
    assert!(pages > 1, "SCAN COUNT 5 returned everything in one page");
    assert!(summaries
        .iter()
        .all(|summary| summary.data_type == KvDataType::String && summary.ttl_ms.is_none()));

    service
        .set_string(context.key("kind:ttl"), kv_text("x"), false)
        .await
        .unwrap();
    service
        .set_ttl_ms(context.key("kind:ttl"), 60_000)
        .await
        .unwrap();
    service
        .hash_set(context.key("kind:hash"), kv_text("f"), kv_text("v"))
        .await
        .unwrap();
    service
        .list_push(context.key("kind:list"), kv_text("v"), false)
        .await
        .unwrap();
    service
        .set_add(context.key("kind:set"), kv_text("v"))
        .await
        .unwrap();
    service
        .sorted_set_add(context.key("kind:zset"), kv_text("v"), 1.0)
        .await
        .unwrap();

    let (kinds, _) = kv_scan_all(&mut service, &context.name("kind:*"), 100).await;
    let by_name: BTreeMap<String, (KvDataType, Option<i64>)> = kinds
        .iter()
        .map(|s| (kv_utf8(&s.key), (s.data_type.clone(), s.ttl_ms)))
        .collect();
    assert_eq!(by_name.len(), 5);
    assert_eq!(
        by_name[&context.name("kind:hash")],
        (KvDataType::Hash, None)
    );
    assert_eq!(
        by_name[&context.name("kind:list")],
        (KvDataType::List, None)
    );
    assert_eq!(by_name[&context.name("kind:set")], (KvDataType::Set, None));
    assert_eq!(
        by_name[&context.name("kind:zset")],
        (KvDataType::SortedSet, None)
    );
    let (ttl_type, ttl) = by_name[&context.name("kind:ttl")].clone();
    assert_eq!(ttl_type, KvDataType::String);
    assert!(ttl.is_some_and(|ms| ms > 0 && ms <= 60_000));

    let (nothing, _) = kv_scan_all(&mut service, &context.name("no-such-prefix:*"), 100).await;
    assert!(nothing.is_empty());

    let clamped = service
        .scan(KvScanRequest {
            cursor: None,
            pattern: Some(context.name("*")),
            limit: Some(0),
        })
        .await;
    assert!(clamped.is_ok(), "a zero page size should be clamped");
}

async fn kv_delete_keys(mut service: KvConnection, context: KvContext) {
    let string_key = context.key("string");
    let hash_key = context.key("hash");
    let list_key = context.key("list");
    let set_key = context.key("set");
    let zset_key = context.key("zset");

    service
        .set_string(string_key.clone(), kv_text("v"), false)
        .await
        .unwrap();
    service
        .hash_set(hash_key.clone(), kv_text("f"), kv_text("v"))
        .await
        .unwrap();
    service
        .list_push(list_key.clone(), kv_text("v"), false)
        .await
        .unwrap();
    service
        .set_add(set_key.clone(), kv_text("v"))
        .await
        .unwrap();
    service
        .sorted_set_add(zset_key.clone(), kv_text("v"), 1.0)
        .await
        .unwrap();

    for key in [string_key, hash_key, list_key, set_key, zset_key] {
        let deleted = service.delete_key(key.clone()).await.unwrap();
        assert_eq!(deleted.changed, 1, "first delete of {key:?}");
        let gone = service
            .read(KvReadRequest {
                key: key.clone(),
                cursor: None,
                offset: None,
                limit: None,
            })
            .await;
        assert!(gone.is_err(), "{key:?} survived DEL");
        let again = service.delete_key(key.clone()).await.unwrap();
        assert_eq!(again.changed, 0, "second delete of {key:?}");
    }
}

async fn kv_raw_commands(mut service: KvConnection, context: KvContext) {
    let name = context.name("raw");

    let set = service
        .execute_raw(&format!("SET {name} \"hello world\""), None)
        .await
        .unwrap();
    assert_eq!(raw_text(set), "OK");
    let get = service
        .execute_raw(&format!("get {name}"), None)
        .await
        .unwrap();
    assert_eq!(raw_text(get), "hello world");

    let missing = service
        .execute_raw(&format!("GET {name}-missing"), None)
        .await
        .unwrap();
    assert!(matches!(missing, RawCommandResult::Null));

    let escaped = service
        .execute_raw(&format!(r#"SET {name} 'a b\nc'"#), None)
        .await
        .unwrap();
    assert_eq!(raw_text(escaped), "OK");
    let escaped_back = service
        .execute_raw(&format!("GET {name}"), None)
        .await
        .unwrap();
    assert_eq!(raw_text(escaped_back), "a b\nc");

    let kind = service
        .execute_raw(&format!("TYPE {name}"), None)
        .await
        .unwrap();
    assert_eq!(raw_text(kind), "string");
    let ttl = service
        .execute_raw(&format!("TTL {name}"), None)
        .await
        .unwrap();
    assert_eq!(raw_integer(ttl), -1);
    let incremented = service
        .execute_raw(&format!("INCR {name}-counter"), None)
        .await
        .unwrap();
    assert_eq!(raw_integer(incremented), 1);

    let pushed = service
        .execute_raw(&format!("RPUSH {name}-list a b c"), None)
        .await
        .unwrap();
    assert_eq!(raw_integer(pushed), 3);
    let range = service
        .execute_raw(&format!("LRANGE {name}-list 0 -1"), None)
        .await
        .unwrap();
    match range {
        RawCommandResult::Array(items) => {
            let texts: Vec<String> = items.into_iter().map(raw_text).collect();
            assert_eq!(texts, ["a", "b", "c"]);
        }
        other => panic!("expected an array reply, got {other:?}"),
    }

    service
        .execute_raw(&format!("HSET {name}-hash f v"), None)
        .await
        .unwrap();
    let field = service
        .execute_raw(&format!("HGET {name}-hash f"), None)
        .await
        .unwrap();
    assert_eq!(raw_text(field), "v");

    let wrong_type = service.execute_raw(&format!("LPUSH {name} x"), None).await;
    assert!(wrong_type.is_err(), "WRONGTYPE should surface as an error");
    assert!(service
        .execute_raw("DORA_NOT_A_COMMAND x", None)
        .await
        .is_err());
    assert!(service.execute_raw("   ", None).await.is_err());
    assert!(service
        .execute_raw(&format!("SET {name} 'unterminated"), None)
        .await
        .is_err());

    let deleted = service
        .execute_raw(
            &format!("DEL {name} {name}-counter {name}-list {name}-hash"),
            None,
        )
        .await
        .unwrap();
    assert_eq!(raw_integer(deleted), 4);
}

async fn kv_dangerous_command_guard(mut service: KvConnection, context: KvContext) {
    assert_eq!(
        classify_raw_command("FLUSHALL").unwrap(),
        RawCommandSafety::Destructive {
            confirmation: "FLUSHALL".to_string()
        }
    );
    assert_eq!(
        classify_raw_command("  flushdb async").unwrap(),
        RawCommandSafety::Destructive {
            confirmation: "FLUSHDB".to_string()
        }
    );
    assert_eq!(
        classify_raw_command(&format!("DEL {}", context.name("x"))).unwrap(),
        RawCommandSafety::Safe
    );
    assert_eq!(
        classify_raw_command("ECHO FLUSHALL").unwrap(),
        RawCommandSafety::Safe
    );

    let sentinel = context.key("sentinel");
    service
        .set_string(sentinel.clone(), kv_text("still here"), false)
        .await
        .unwrap();

    let refused = service.execute_raw("FLUSHALL", None).await.unwrap_err();
    assert!(
        refused.to_string().contains("FLUSHALL"),
        "guard should name the expected confirmation: {refused}"
    );
    assert!(service.execute_raw("flushdb", None).await.is_err());
    assert!(service
        .execute_raw("FLUSHDB", Some("FLUSHALL"))
        .await
        .is_err());
    assert!(service
        .execute_raw("FLUSHDB ASYNC", Some("flushdb"))
        .await
        .is_err());
    assert!(service.execute_raw("FLUSHALL", Some("")).await.is_err());

    let survivor = kv_read(&mut service, &sentinel).await;
    assert_eq!(expect_string(survivor).0, kv_text("still here"));

    let echoed = service
        .execute_raw("ECHO FLUSHALL", None)
        .await
        .expect("a safe command that mentions FLUSHALL needs no confirmation");
    assert_eq!(raw_text(echoed), "FLUSHALL");
}

macro_rules! kv_live_tests {
    ($target:expr, { $($name:ident => $scenario:ident),+ $(,)? }) => {
        $(
            #[tokio::test]
            async fn $name() {
                run_kv_scenario(stringify!($name), &$target, $scenario).await;
            }
        )+
    };
}

kv_live_tests!(REDIS_TARGET, {
    redis_kv_connect_and_ping => kv_connect_and_ping,
    redis_kv_string_set_get_and_ttl => kv_string_set_get_and_ttl,
    redis_kv_string_binary_and_paging => kv_string_binary_and_paging,
    redis_kv_hash_read_and_write => kv_hash_read_and_write,
    redis_kv_list_read_and_write => kv_list_read_and_write,
    redis_kv_set_read_and_write => kv_set_read_and_write,
    redis_kv_sorted_set_read_and_write => kv_sorted_set_read_and_write,
    redis_kv_large_collection_cursors => kv_large_collection_cursors,
    redis_kv_scan_pagination => kv_scan_pagination,
    redis_kv_delete_keys => kv_delete_keys,
    redis_kv_raw_commands => kv_raw_commands,
    redis_kv_dangerous_command_guard => kv_dangerous_command_guard,
});

kv_live_tests!(VALKEY_TARGET, {
    valkey_kv_connect_and_ping => kv_connect_and_ping,
    valkey_kv_string_set_get_and_ttl => kv_string_set_get_and_ttl,
    valkey_kv_string_binary_and_paging => kv_string_binary_and_paging,
    valkey_kv_hash_read_and_write => kv_hash_read_and_write,
    valkey_kv_list_read_and_write => kv_list_read_and_write,
    valkey_kv_set_read_and_write => kv_set_read_and_write,
    valkey_kv_sorted_set_read_and_write => kv_sorted_set_read_and_write,
    valkey_kv_large_collection_cursors => kv_large_collection_cursors,
    valkey_kv_scan_pagination => kv_scan_pagination,
    valkey_kv_delete_keys => kv_delete_keys,
    valkey_kv_raw_commands => kv_raw_commands,
    valkey_kv_dangerous_command_guard => kv_dangerous_command_guard,
});
