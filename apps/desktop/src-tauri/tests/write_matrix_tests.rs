//! Runs every grid write against each engine across a matrix of key types and
//! column types, and fails on any write that errors or stores a different
//! value than the one sent. SQLite runs always; the server engines need
//! `DORA_LIVE_DB_TESTS=1` and the containers from `docker-compose.databases.yml`.

use app_lib::database::adapter::{MySqlAdapter, PostgresAdapter, SqliteAdapter, WriteAdapter};
use app_lib::database::dialect::{MySqlDialect, PgDialect};
use async_trait::async_trait;
use mysql_async::prelude::Queryable;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};

#[async_trait]
trait Raw: Send + Sync {
    async fn exec(&self, sql: &str) -> Result<(), String>;
    async fn text(&self, sql: &str) -> Result<Option<String>, String>;
}

struct Key {
    ddl: &'static str,
    literal: &'static str,
    native: Value,
    has_default: bool,
}

struct Val {
    ddl: &'static str,
    literal: &'static str,
    input: Option<Value>,
    native: Option<Value>,
}

struct Spec {
    engine: &'static str,
    serial: &'static str,
    setup: &'static str,
    cast: fn(&str, &str) -> String,
    soft_type: &'static str,
    blob_type: &'static str,
    blob_literal: &'static str,
    keys: Vec<Key>,
    vals: Vec<Val>,
}

fn key(ddl: &'static str, literal: &'static str, native: Value, has_default: bool) -> Key {
    Key {
        ddl,
        literal,
        native,
        has_default,
    }
}

fn val(ddl: &'static str, literal: &'static str, input: Value, native: Option<Value>) -> Val {
    Val {
        ddl,
        literal,
        input: Some(input),
        native,
    }
}

/// A column the grid never writes as text (binary data); only the in-database
/// row copy is checked.
fn copy_only(ddl: &'static str, literal: &'static str) -> Val {
    Val {
        ddl,
        literal,
        input: None,
        native: None,
    }
}

fn live_enabled() -> bool {
    std::env::var("DORA_LIVE_DB_TESTS").ok().as_deref() == Some("1")
}

fn not_implemented<T>(result: &Result<T, app_lib::Error>) -> bool {
    matches!(result, Err(app_lib::Error::NotImplemented(_)))
}

async fn run(spec: Spec, adapter: &dyn WriteAdapter, raw: &dyn Raw) -> Vec<String> {
    let mut report: Vec<String> = Vec::new();
    let e = spec.engine;
    if !spec.setup.is_empty() {
        for stmt in spec.setup.split(';').filter(|s| !s.trim().is_empty()) {
            let _ = raw.exec(stmt).await;
        }
    }

    for k in &spec.keys {
        let mut forms = vec![("native", k.native.clone())];
        if !k.native.is_string() {
            forms.push(("string", json!(k.native.to_string())));
        }
        for (form, declared) in forms {
            let tag = format!("[{e}] key {} ({form})", k.ddl);
            let _ = raw.exec("DROP TABLE IF EXISTS probe_k").await;
            let create = format!(
                "CREATE TABLE probe_k (id {} PRIMARY KEY, v TEXT, deleted_at {}, b {})",
                k.ddl, spec.soft_type, spec.blob_type
            );
            if let Err(err) = raw.exec(&create).await {
                report.push(format!("{tag}: SETUP create: {err}"));
                continue;
            }
            let insert = format!(
                "INSERT INTO probe_k (id, v, b) VALUES ({}, 'a', {})",
                k.literal, spec.blob_literal
            );
            if let Err(err) = raw.exec(&insert).await {
                report.push(format!("{tag}: SETUP insert: {err}"));
                continue;
            }
            // A generated key is whatever the server picked, read back the way the grid sees it.
            let pk = if k.literal == "DEFAULT" {
                let id = raw
                    .text(&format!("SELECT {} FROM probe_k", (spec.cast)("id", "int")))
                    .await
                    .unwrap_or(None)
                    .unwrap_or_default();
                json!(id)
            } else {
                declared
            };

            match adapter
                .update_cell(
                    "probe_k".into(),
                    None,
                    "id".into(),
                    pk.clone(),
                    "v".into(),
                    json!("b"),
                )
                .await
            {
                Ok(r) if r.affected_rows == 1 => {}
                Ok(r) => report.push(format!("{tag}: update_cell affected {}", r.affected_rows)),
                Err(err) => report.push(format!("{tag}: update_cell: {err}")),
            }

            match adapter
                .get_blob_bytes("probe_k".into(), None, "id".into(), pk.clone(), "b".into())
                .await
            {
                not_wired if not_implemented(&not_wired) => {}
                Ok(bytes) if bytes == vec![1u8, 2u8] => {}
                Ok(bytes) => report.push(format!("{tag}: get_blob_bytes wrong bytes {bytes:?}")),
                Err(err) => report.push(format!("{tag}: get_blob_bytes: {err}")),
            }

            match adapter
                .soft_delete_rows(
                    "probe_k".into(),
                    None,
                    "id".into(),
                    vec![pk.clone()],
                    Some("deleted_at".into()),
                )
                .await
            {
                Ok(r) if r.affected_rows == 1 => {}
                Ok(r) => report.push(format!("{tag}: soft_delete affected {}", r.affected_rows)),
                Err(err) => report.push(format!("{tag}: soft_delete: {err}")),
            }

            match adapter
                .undo_soft_delete(
                    "probe_k".into(),
                    None,
                    "id".into(),
                    vec![pk.clone()],
                    "deleted_at".into(),
                )
                .await
            {
                not_wired if not_implemented(&not_wired) => {}
                Ok(r) if r.affected_rows == 1 => {}
                Ok(r) => report.push(format!(
                    "{tag}: undo_soft_delete affected {}",
                    r.affected_rows
                )),
                Err(err) => report.push(format!("{tag}: undo_soft_delete: {err}")),
            }

            if k.has_default {
                match adapter
                    .duplicate_row("probe_k".into(), None, "id".into(), pk.clone())
                    .await
                {
                    Ok(_) => {
                        let count = raw
                            .text(&format!(
                                "SELECT {} FROM probe_k",
                                (spec.cast)("COUNT(*)", "int")
                            ))
                            .await;
                        if count != Ok(Some("2".into())) {
                            report.push(format!("{tag}: duplicate_row count {count:?}"));
                        }
                        let blobs = raw
                            .text(&format!(
                                "SELECT {} FROM probe_k",
                                (spec.cast)("COUNT(DISTINCT b)", "int")
                            ))
                            .await;
                        if blobs != Ok(Some("1".into())) {
                            report.push(format!(
                                "{tag}: duplicate_row changed the blob, distinct {blobs:?}"
                            ));
                        }
                    }
                    Err(err) => report.push(format!("{tag}: duplicate_row: {err}")),
                }
            }

            match adapter
                .delete_rows("probe_k".into(), None, "id".into(), vec![pk.clone()])
                .await
            {
                Ok(r) if r.affected_rows == 1 => {}
                Ok(r) => report.push(format!("{tag}: delete_rows affected {}", r.affected_rows)),
                Err(err) => report.push(format!("{tag}: delete_rows: {err}")),
            }
        }
    }

    for v in &spec.vals {
        let tag = format!("[{e}] value {}", v.ddl);
        let _ = raw.exec("DROP TABLE IF EXISTS probe_v").await;
        let create = format!("CREATE TABLE probe_v (id {}, c {})", spec.serial, v.ddl);
        if let Err(err) = raw.exec(&create).await {
            report.push(format!("{tag}: SETUP create: {err}"));
            continue;
        }
        if let Err(err) = raw
            .exec(&format!("INSERT INTO probe_v (c) VALUES ({})", v.literal))
            .await
        {
            report.push(format!("{tag}: SETUP insert: {err}"));
            continue;
        }
        let cell = (spec.cast)("c", v.ddl);
        let expected = raw
            .text(&format!("SELECT {cell} FROM probe_v ORDER BY id LIMIT 1"))
            .await
            .unwrap_or(None);
        let id_text = raw
            .text(&format!(
                "SELECT {} FROM probe_v ORDER BY id LIMIT 1",
                (spec.cast)("id", "int")
            ))
            .await
            .unwrap_or(None)
            .unwrap_or_default();
        let id: Value = json!(id_text.parse::<i64>().unwrap_or(1));
        let newest = format!("SELECT {cell} FROM probe_v ORDER BY id DESC LIMIT 1");
        let first = format!("SELECT {cell} FROM probe_v ORDER BY id LIMIT 1");

        match adapter
            .duplicate_row("probe_v".into(), None, "id".into(), id.clone())
            .await
        {
            Ok(_) => {
                let got = raw.text(&newest).await.unwrap_or(None);
                if got != expected {
                    report.push(format!(
                        "{tag}: duplicate_row stored {got:?}, expected {expected:?}"
                    ));
                }
            }
            Err(err) => report.push(format!("{tag}: duplicate_row: {err}")),
        }

        let mut inputs: Vec<(&str, Value)> = Vec::new();
        if let Some(input) = &v.input {
            inputs.push(("string", input.clone()));
        }
        if let Some(native) = &v.native {
            inputs.push(("native", native.clone()));
        }
        for (form, input) in inputs {
            let _ = adapter
                .update_cell(
                    "probe_v".into(),
                    None,
                    "id".into(),
                    id.clone(),
                    "c".into(),
                    Value::Null,
                )
                .await
                .map_err(|err| report.push(format!("{tag}: update_cell NULL: {err}")));
            match adapter
                .update_cell(
                    "probe_v".into(),
                    None,
                    "id".into(),
                    id.clone(),
                    "c".into(),
                    input.clone(),
                )
                .await
            {
                Ok(_) => {
                    let got = raw.text(&first).await.unwrap_or(None);
                    if got != expected {
                        report.push(format!(
                            "{tag}: update_cell ({form}) stored {got:?}, expected {expected:?}"
                        ));
                    }
                }
                Err(err) => report.push(format!("{tag}: update_cell ({form}): {err}")),
            }

            let mut row = serde_json::Map::new();
            row.insert("c".into(), input.clone());
            match adapter.insert_row("probe_v".into(), None, row).await {
                Ok(_) => {
                    let got = raw.text(&newest).await.unwrap_or(None);
                    if got != expected {
                        report.push(format!(
                            "{tag}: insert_row ({form}) stored {got:?}, expected {expected:?}"
                        ));
                    }
                }
                Err(err) => report.push(format!("{tag}: insert_row ({form}): {err}")),
            }
        }
    }

    let _ = raw.exec("DROP TABLE IF EXISTS probe_k").await;
    let _ = raw.exec("DROP TABLE IF EXISTS probe_v").await;
    report
}

fn assert_clean(report: Vec<String>) {
    assert!(
        report.is_empty(),
        "{} write(s) failed or stored a different value:\n{}",
        report.len(),
        report.join("\n")
    );
}

struct PgRaw(Arc<tokio_postgres::Client>);

#[async_trait]
impl Raw for PgRaw {
    async fn exec(&self, sql: &str) -> Result<(), String> {
        self.0
            .batch_execute(sql)
            .await
            .map_err(|e| format!("{e:?}"))
    }
    async fn text(&self, sql: &str) -> Result<Option<String>, String> {
        let row = self
            .0
            .query_opt(sql, &[])
            .await
            .map_err(|e| e.to_string())?;
        Ok(row.and_then(|r| r.get::<_, Option<String>>(0)))
    }
}

fn pg_cast(expr: &str, ddl: &str) -> String {
    if ddl == "BYTEA" {
        format!("encode({expr}, 'hex')")
    } else {
        format!("CAST({expr} AS text)")
    }
}

fn pg_spec(engine: &'static str) -> Spec {
    Spec {
        engine,
        serial: "SERIAL PRIMARY KEY",
        setup: "DROP TABLE IF EXISTS probe_k; DROP TABLE IF EXISTS probe_v; DROP TYPE IF EXISTS probe_mood; CREATE TYPE probe_mood AS ENUM ('sad', 'ok')",
        cast: pg_cast,
        soft_type: "TIMESTAMPTZ",
        blob_type: "BYTEA",
        blob_literal: "'\\x0102'::bytea",
        keys: vec![
            key("SMALLINT", "7", json!(7), false),
            key("INT", "7", json!(7), false),
            key("SERIAL", "DEFAULT", json!(1), true),
            key("BIGINT", "7", json!(7), false),
            key("BIGSERIAL", "DEFAULT", json!(1), true),
            key("NUMERIC(10,2)", "7.50", json!(7.5), false),
            key("TEXT", "'k'", json!("k"), false),
            key("VARCHAR(20)", "'k'", json!("k"), false),
            key(
                "UUID DEFAULT gen_random_uuid()",
                "'7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f'",
                json!("7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f"),
                true,
            ),
            key("DATE", "'2024-01-02'", json!("2024-01-02"), false),
            key(
                "TIMESTAMPTZ",
                "'2024-01-02 03:04:05+00'",
                json!("2024-01-02 03:04:05+00"),
                false,
            ),
        ],
        vals: vec![
            val("SMALLINT", "12", json!("12"), Some(json!(12))),
            val("INT", "12", json!("12"), Some(json!(12))),
            val("BIGINT", "9007199254740993", json!("9007199254740993"), None),
            val("NUMERIC(12,4)", "12.3400", json!("12.34"), Some(json!(12.34))),
            val("REAL", "1.5", json!("1.5"), Some(json!(1.5))),
            val("DOUBLE PRECISION", "1.5", json!("1.5"), Some(json!(1.5))),
            val("BOOLEAN", "true", json!("true"), Some(json!(true))),
            val("TEXT", "'hi'", json!("hi"), None),
            val("VARCHAR(10)", "'hi'", json!("hi"), None),
            val("CHAR(3)", "'hi'", json!("hi"), None),
            val(
                "UUID",
                "'7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f'",
                json!("7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f"),
                None,
            ),
            val("DATE", "'2024-01-02'", json!("2024-01-02"), None),
            val("TIME", "'03:04:05'", json!("03:04:05"), None),
            val("TIMESTAMP", "'2024-01-02 03:04:05'", json!("2024-01-02 03:04:05"), None),
            val(
                "TIMESTAMPTZ",
                "'2024-01-02 03:04:05+00'",
                json!("2024-01-02 03:04:05+00"),
                None,
            ),
            val("INTERVAL", "'1 day 02:00:00'", json!("1 day 02:00:00"), None),
            val("JSON", "'{\"a\":1}'", json!("{\"a\":1}"), Some(json!({"a":1}))),
            val("JSONB", "'{\"a\": [1, 2]}'", json!("{\"a\": [1, 2]}"), Some(json!({"a":[1,2]}))),
            val("BYTEA", "'\\x0102'::bytea", json!("\\x0102"), None),
            val("INT[]", "'{1,2}'", json!("{1,2}"), Some(json!([1, 2]))),
            val("TEXT[]", "'{a,b}'", json!("{a,b}"), Some(json!(["a", "b"]))),
            val("INET", "'10.0.0.1'", json!("10.0.0.1"), None),
            val("probe_mood", "'ok'", json!("ok"), None),
        ],
    }
}

async fn pg_run(engine: &'static str, url: &str, dialect: PgDialect) {
    let (client, conn) = tokio_postgres::connect(url, tokio_postgres::NoTls)
        .await
        .expect("connect");
    tokio::spawn(async move {
        let _ = conn.await;
    });
    let client = Arc::new(client);
    let adapter = PostgresAdapter::new(client.clone(), false, dialect);
    assert_clean(run(pg_spec(engine), &adapter, &PgRaw(client)).await);
}

#[tokio::test]
async fn postgres_writes_round_trip_every_key_and_column_type() {
    if !live_enabled() {
        return;
    }
    let url = std::env::var("DORA_POSTGRES_URL")
        .unwrap_or_else(|_| "postgres://postgres:rootpass@127.0.0.1:5432/dora".into());
    pg_run("postgres", &url, PgDialect::Postgres).await;
}

#[tokio::test]
async fn cockroach_writes_round_trip_every_key_and_column_type() {
    if !live_enabled() {
        return;
    }
    let url = std::env::var("DORA_COCKROACH_URL")
        .unwrap_or_else(|_| "postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable".into());
    pg_run("cockroach", &url, PgDialect::CockroachDb).await;
}

struct MyRaw(mysql_async::Pool);

#[async_trait]
impl Raw for MyRaw {
    async fn exec(&self, sql: &str) -> Result<(), String> {
        let mut conn = self.0.get_conn().await.map_err(|e| e.to_string())?;
        conn.query_drop(sql).await.map_err(|e| e.to_string())
    }
    async fn text(&self, sql: &str) -> Result<Option<String>, String> {
        let mut conn = self.0.get_conn().await.map_err(|e| e.to_string())?;
        let value: Option<Option<String>> =
            conn.query_first(sql).await.map_err(|e| e.to_string())?;
        Ok(value.flatten())
    }
}

fn my_cast(expr: &str, ddl: &str) -> String {
    if ddl.contains("BLOB") || ddl.contains("BINARY") || ddl.starts_with("BIT") {
        format!("HEX({expr})")
    } else {
        format!("CAST({expr} AS CHAR)")
    }
}

fn my_spec(engine: &'static str) -> Spec {
    Spec {
        engine,
        serial: "INT AUTO_INCREMENT PRIMARY KEY",
        setup: "",
        cast: my_cast,
        soft_type: "DATETIME NULL",
        blob_type: "BLOB",
        blob_literal: "x'0102'",
        keys: vec![
            key("INT", "7", json!(7), false),
            key("INT AUTO_INCREMENT", "1", json!(1), true),
            key(
                "BIGINT UNSIGNED",
                "18446744073709551615",
                json!(18446744073709551615u64),
                false,
            ),
            key("DECIMAL(10,2)", "7.50", json!(7.5), false),
            key("VARCHAR(36)", "'k'", json!("k"), false),
            key(
                "CHAR(36)",
                "'7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f'",
                json!("7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f"),
                false,
            ),
            key("DATE", "'2024-01-02'", json!("2024-01-02"), false),
            key(
                "DATETIME",
                "'2024-01-02 03:04:05'",
                json!("2024-01-02 03:04:05"),
                false,
            ),
        ],
        vals: vec![
            val("INT", "12", json!("12"), Some(json!(12))),
            val(
                "BIGINT UNSIGNED",
                "18446744073709551615",
                json!("18446744073709551615"),
                None,
            ),
            val(
                "DECIMAL(12,4)",
                "12.3400",
                json!("12.34"),
                Some(json!(12.34)),
            ),
            val("DOUBLE", "1.5", json!("1.5"), Some(json!(1.5))),
            val("TINYINT(1)", "1", json!("1"), Some(json!(true))),
            val("VARCHAR(10)", "'hi'", json!("hi"), None),
            val("TEXT", "'hi'", json!("hi"), None),
            val("DATE", "'2024-01-02'", json!("2024-01-02"), None),
            val("TIME", "'03:04:05'", json!("03:04:05"), None),
            val("TIME", "'-26:04:05'", json!("-26:04:05"), None),
            val(
                "DATETIME",
                "'2024-01-02 03:04:05'",
                json!("2024-01-02 03:04:05"),
                None,
            ),
            val(
                "DATETIME(6)",
                "'2024-01-02 03:04:05.123456'",
                json!("2024-01-02 03:04:05.123456"),
                None,
            ),
            val(
                "TIMESTAMP",
                "'2024-01-02 03:04:05'",
                json!("2024-01-02 03:04:05"),
                None,
            ),
            val("YEAR", "2024", json!("2024"), Some(json!(2024))),
            val("JSON", "'{\"a\": [1, 2]}'", json!("{\"a\": [1, 2]}"), None),
            copy_only("BLOB", "x'ff00fe'"),
            copy_only("BINARY(4)", "x'ff00fe01'"),
            copy_only("BIT(8)", "b'10100101'"),
            val("ENUM('sad','ok')", "'ok'", json!("ok"), None),
            val("SET('a','b')", "'a,b'", json!("a,b"), None),
        ],
    }
}

async fn my_run(engine: &'static str, url: &str, dialect: MySqlDialect) {
    let pool = mysql_async::Pool::new(mysql_async::Opts::from_url(url).expect("url"));
    let adapter = MySqlAdapter::new(Arc::new(pool.clone()), dialect);
    assert_clean(run(my_spec(engine), &adapter, &MyRaw(pool.clone())).await);
    pool.disconnect().await.unwrap();
}

#[tokio::test]
async fn mysql_writes_round_trip_every_key_and_column_type() {
    if !live_enabled() {
        return;
    }
    let url = std::env::var("DORA_MYSQL_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3307/dora".into());
    my_run("mysql", &url, MySqlDialect::MySql).await;
}

#[tokio::test]
async fn mariadb_writes_round_trip_every_key_and_column_type() {
    if !live_enabled() {
        return;
    }
    let url = std::env::var("DORA_MARIADB_URL")
        .unwrap_or_else(|_| "mysql://root:rootpass@127.0.0.1:3306/dora".into());
    my_run("mariadb", &url, MySqlDialect::MariaDb).await;
}

struct LiteRaw(Arc<Mutex<rusqlite::Connection>>);

#[async_trait]
impl Raw for LiteRaw {
    async fn exec(&self, sql: &str) -> Result<(), String> {
        self.0
            .lock()
            .unwrap()
            .execute_batch(sql)
            .map_err(|e| e.to_string())
    }
    async fn text(&self, sql: &str) -> Result<Option<String>, String> {
        self.0
            .lock()
            .unwrap()
            .query_row(sql, [], |r| r.get::<_, Option<String>>(0))
            .map_err(|e| e.to_string())
    }
}

fn lite_cast(expr: &str, ddl: &str) -> String {
    match ddl {
        "BLOB" => format!("hex({expr})"),
        "int" => format!("CAST({expr} AS TEXT)"),
        _ => format!("CAST({expr} AS TEXT) || ':' || typeof({expr})"),
    }
}

#[tokio::test]
async fn sqlite_writes_round_trip_every_key_and_column_type() {
    let conn = Arc::new(Mutex::new(rusqlite::Connection::open_in_memory().unwrap()));
    let adapter = SqliteAdapter::new(conn.clone());
    let spec = Spec {
        engine: "sqlite",
        serial: "INTEGER PRIMARY KEY",
        setup: "",
        cast: lite_cast,
        soft_type: "INTEGER",
        blob_type: "BLOB",
        blob_literal: "x'0102'",
        keys: vec![
            key("INTEGER", "7", json!(7), true),
            key("TEXT", "'k'", json!("k"), false),
            key("TEXT", "'7'", json!("7"), false),
            key("REAL", "7.5", json!(7.5), false),
        ],
        vals: vec![
            val("INTEGER", "12", json!("12"), Some(json!(12))),
            val("REAL", "1.5", json!("1.5"), Some(json!(1.5))),
            val("NUMERIC", "12.34", json!("12.34"), Some(json!(12.34))),
            val("TEXT", "'hi'", json!("hi"), None),
            val("TEXT", "'12'", json!("12"), None),
            val("BOOLEAN", "1", json!("1"), Some(json!(true))),
            copy_only("BLOB", "x'ff00fe'"),
            val(
                "DATETIME",
                "'2024-01-02 03:04:05'",
                json!("2024-01-02 03:04:05"),
                None,
            ),
        ],
    };
    assert_clean(run(spec, &adapter, &LiteRaw(conn)).await);
}

#[cfg(feature = "duckdb-engine")]
mod duck {
    use super::*;
    use app_lib::database::adapter::DuckDbAdapter;

    struct DuckRaw(Arc<Mutex<duckdb::Connection>>);

    #[async_trait]
    impl Raw for DuckRaw {
        async fn exec(&self, sql: &str) -> Result<(), String> {
            self.0
                .lock()
                .unwrap()
                .execute_batch(sql)
                .map_err(|e| e.to_string())
        }
        async fn text(&self, sql: &str) -> Result<Option<String>, String> {
            self.0
                .lock()
                .unwrap()
                .query_row(sql, [], |r| r.get::<_, Option<String>>(0))
                .map_err(|e| e.to_string())
        }
    }

    fn duck_cast(expr: &str, ddl: &str) -> String {
        if ddl == "BLOB" {
            format!("hex({expr})")
        } else {
            format!("CAST({expr} AS VARCHAR)")
        }
    }

    #[tokio::test]
    async fn duckdb_writes_round_trip_every_key_and_column_type() {
        let conn = Arc::new(Mutex::new(duckdb::Connection::open_in_memory().unwrap()));
        let adapter = DuckDbAdapter::new(conn.clone());
        let spec = Spec {
            engine: "duckdb",
            serial: "INTEGER PRIMARY KEY DEFAULT nextval('probe_seq')",
            setup: "CREATE SEQUENCE probe_seq",
            cast: duck_cast,
            soft_type: "TIMESTAMP",
            blob_type: "BLOB",
            blob_literal: "'\\x01\\x02'::BLOB",
            keys: vec![
                key("INTEGER", "7", json!(7), false),
                key("BIGINT", "7", json!(7), false),
                key("HUGEINT", "7", json!(7), false),
                key("DECIMAL(10,2)", "7.50", json!(7.5), false),
                key("VARCHAR", "'k'", json!("k"), false),
                key(
                    "UUID DEFAULT uuid()",
                    "'7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f'",
                    json!("7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f"),
                    true,
                ),
                key("DATE", "'2024-01-02'", json!("2024-01-02"), false),
                key(
                    "TIMESTAMP",
                    "'2024-01-02 03:04:05'",
                    json!("2024-01-02 03:04:05"),
                    false,
                ),
            ],
            vals: vec![
                val("INTEGER", "12", json!("12"), Some(json!(12))),
                val(
                    "BIGINT",
                    "9007199254740993",
                    json!("9007199254740993"),
                    None,
                ),
                val(
                    "HUGEINT",
                    "170141183460469231731687303715884105727",
                    json!("170141183460469231731687303715884105727"),
                    None,
                ),
                val(
                    "DECIMAL(12,4)",
                    "12.3400",
                    json!("12.34"),
                    Some(json!(12.34)),
                ),
                val("DOUBLE", "1.5", json!("1.5"), Some(json!(1.5))),
                val("BOOLEAN", "true", json!("true"), Some(json!(true))),
                val("VARCHAR", "'hi'", json!("hi"), None),
                val(
                    "UUID",
                    "'7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f'",
                    json!("7b6f0f4e-1d2c-4c4e-9a3b-0a1b2c3d4e5f"),
                    None,
                ),
                val("DATE", "'2024-01-02'", json!("2024-01-02"), None),
                val("TIME", "'03:04:05'", json!("03:04:05"), None),
                val(
                    "TIMESTAMP",
                    "'2024-01-02 03:04:05'",
                    json!("2024-01-02 03:04:05"),
                    None,
                ),
                val(
                    "TIMESTAMPTZ",
                    "'2024-01-02 03:04:05+00'",
                    json!("2024-01-02 03:04:05+00"),
                    None,
                ),
                val(
                    "INTERVAL",
                    "'1 day 02:00:00'",
                    json!("1 day 02:00:00"),
                    None,
                ),
                val(
                    "JSON",
                    "'{\"a\":[1,2]}'",
                    json!("{\"a\":[1,2]}"),
                    Some(json!({"a":[1,2]})),
                ),
                val(
                    "BLOB",
                    "'\\xFF\\x00\\xFE'::BLOB",
                    json!("\\xFF\\x00\\xFE"),
                    None,
                ),
                val("INTEGER[]", "[1, 2]", json!("[1, 2]"), Some(json!([1, 2]))),
                val(
                    "STRUCT(a INTEGER, b VARCHAR)",
                    "{'a': 1, 'b': 'x'}",
                    json!("{'a': 1, 'b': 'x'}"),
                    Some(json!({"a":1,"b":"x"})),
                ),
                val("ENUM('sad','ok')", "'ok'", json!("ok"), None),
            ],
        };
        assert_clean(run(spec, &adapter, &DuckRaw(conn)).await);
    }
}
