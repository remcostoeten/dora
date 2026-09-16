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
