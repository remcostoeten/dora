//! Cloudflare D1 HTTP query adapter.
//!
//! D1 has **no SQL wire protocol**: queries run over the Cloudflare REST API
//! (`POST /accounts/{account_id}/d1/database/{database_id}/query`) with a Bearer
//! token. The dialect is SQLite, so statement parsing and schema introspection
//! reuse the SQLite logic — but execution goes over HTTP instead of a local
//! connection. This module owns the HTTP client (`D1Http`), the response decode
//! types, and the `DatabaseAdapter` implementation (`D1Adapter`).
//!
//! ## Result shaping
//!
//! The `/query` endpoint returns each row as a JSON **object** keyed by column
//! name. The app's grid expects column-ordered `Vec<Vec<Json>>` pages plus a
//! separate ordered column-name list (see `QueryExecEvent`). Because the project
//! builds `serde_json` *without* the `preserve_order` feature, decoding a row
//! into a `serde_json::Map` would alphabetise the keys and lose column order. We
//! therefore decode each row into an order-preserving `Vec<(String, Value)>`
//! (`D1Row`) and take the column order from the first row.

pub mod schema;

use std::sync::Arc;
use std::time::Instant;

use serde::Deserialize;
use serde_json::value::RawValue;
use serde_json::Value;

use crate::database::parser::ParsedStatement;
use crate::database::types::ExecSender;
use crate::database::QueryExecEvent;
use crate::Error;

const API_BASE_URL: &str = "https://api.cloudflare.com/client/v4";

/// Holds the coordinates and credential needed to talk to one D1 database over
/// the Cloudflare REST API. Cheap to clone (`reqwest::Client` is an `Arc`
/// internally), so it lives behind an `Arc` on the `DatabaseClient::D1` variant.
#[derive(Clone, Debug)]
pub struct D1Http {
    client: reqwest::Client,
    account_id: String,
    database_id: String,
    token: String,
}

impl D1Http {
    pub fn new(account_id: String, database_id: String, token: String) -> Self {
        Self {
            client: crate::http::query_client(),
            account_id,
            database_id,
            token,
        }
    }

    /// Parses a `d1://{account_id}/{database_id}` URL (the shape the connect-flow
    /// stores in `Connection.url`) plus the API token into a `D1Http`.
    pub fn from_url(url: &str, token: &str) -> Result<Self, Error> {
        let (account_id, database_id) = parse_d1_url(url)?;
        Ok(Self::new(account_id, database_id, token.to_string()))
    }

    fn query_endpoint(&self) -> String {
        format!(
            "{API_BASE_URL}/accounts/{}/d1/database/{}/query",
            self.account_id, self.database_id
        )
    }

    /// Runs a single SQL statement (optionally with bound params) over the REST
    /// API and returns every result set the call produced. D1 can return more
    /// than one result object for a multi-statement script; the adapter only
    /// sends one statement at a time, so it uses the first.
    pub async fn query(&self, sql: &str, params: Vec<Value>) -> Result<Vec<D1ResultSet>, Error> {
        let body = serde_json::json!({ "sql": sql, "params": params });

        let response = self
            .client
            .post(self.query_endpoint())
            .bearer_auth(&self.token)
            .json(&body)
            .send()
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Cloudflare D1 request failed: {error}")))?;

        let status = response.status();
        let text = read_body(response).await;

        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(Error::Any(anyhow::anyhow!(
                "Cloudflare rejected this API token. It must have D1 read/write \
                 permission for this account."
            )));
        }

        let parsed: D1QueryResponse = serde_json::from_str(&text).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode Cloudflare D1 response (HTTP {status}): {error}"
            ))
        })?;

        // Cloudflare returns `success: false` with a populated `errors` array for
        // SQL errors even on an HTTP 200, so check both the envelope and status.
        if !parsed.success || !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!("{}", parsed.error_message())));
        }

        Ok(parsed.result)
    }
}

/// Splits a `d1://{account_id}/{database_id}` URL into its two ids.
pub fn parse_d1_url(url: &str) -> Result<(String, String), Error> {
    let rest = url.strip_prefix("d1://").ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Expected a d1:// connection URL, got: {url}"
        ))
    })?;
    let mut parts = rest.splitn(2, '/');
    let account_id = parts.next().unwrap_or("").trim();
    let database_id = parts.next().unwrap_or("").trim();
    if account_id.is_empty() || database_id.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "Malformed d1:// URL (expected d1://<account_id>/<database_id>): {url}"
        )));
    }
    Ok((account_id.to_string(), database_id.to_string()))
}

/// Reads a response body, preserving context when it's empty or unreadable.
async fn read_body(response: reqwest::Response) -> String {
    match response.text().await {
        Ok(text) if !text.trim().is_empty() => text,
        Ok(_) => "(empty response body)".to_string(),
        Err(error) => format!("(failed to read response body: {error})"),
    }
}

/// The top-level Cloudflare API envelope for a D1 `/query` call.
#[derive(Debug, Deserialize)]
pub struct D1QueryResponse {
    #[serde(default)]
    pub success: bool,
    #[serde(default)]
    pub errors: Vec<D1ApiError>,
    #[serde(default)]
    pub result: Vec<D1ResultSet>,
}

impl D1QueryResponse {
    /// A readable, joined error message (never raw JSON) for the connect-flow and
    /// SQL console.
    pub fn error_message(&self) -> String {
        if self.errors.is_empty() {
            return "Cloudflare D1 query failed (no error detail returned).".to_string();
        }
        self.errors
            .iter()
            .map(|error| match error.code {
                Some(code) => format!("{} (code {code})", error.message),
                None => error.message.clone(),
            })
            .collect::<Vec<_>>()
            .join("; ")
    }
}

#[derive(Debug, Deserialize)]
pub struct D1ApiError {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default)]
    pub message: String,
}

/// One result set from a D1 query (D1 wraps each statement's result this way).
#[derive(Debug, Deserialize)]
pub struct D1ResultSet {
    #[serde(default)]
    pub results: Vec<D1Row>,
    #[serde(default)]
    pub meta: D1Meta,
}

impl D1ResultSet {
    /// Column names in first-row order. D1 omits the column list when there are
    /// no rows, so an empty result yields no columns (the adapter then reports a
    /// zero-row, zero-column result, matching SQLite's empty-`SELECT` behaviour
    /// where the column header still comes from the prepared statement — here we
    /// have no statement metadata, so an empty set has no header).
    pub fn columns(&self) -> Vec<String> {
        self.results
            .first()
            .map(|row| row.column_names())
            .unwrap_or_default()
    }
}

/// Write-side counters D1 returns in `meta`. Only `changes` is surfaced as
/// "rows affected"; the rest are decoded so the struct tolerates the full
/// payload and could expose them later.
#[derive(Debug, Default, Deserialize)]
pub struct D1Meta {
    #[serde(default)]
    pub changes: u64,
    #[serde(default)]
    pub last_row_id: i64,
    #[serde(default)]
    pub rows_read: u64,
    #[serde(default)]
    pub rows_written: u64,
    #[serde(default)]
    pub duration: f64,
}

/// An order-preserving row: a list of `(column, value)` pairs in the order D1
/// returned them. This sidesteps `serde_json::Map`'s key reordering (the project
/// builds `serde_json` without `preserve_order`).
#[derive(Debug, Clone)]
pub struct D1Row(pub Vec<(String, Value)>);

impl D1Row {
    pub fn column_names(&self) -> Vec<String> {
        self.0.iter().map(|(name, _)| name.clone()).collect()
    }

    pub fn get(&self, column: &str) -> Option<&Value> {
        self.0
            .iter()
            .find(|(name, _)| name == column)
            .map(|(_, value)| value)
    }
}

impl<'de> Deserialize<'de> for D1Row {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct RowVisitor;

        impl<'de> serde::de::Visitor<'de> for RowVisitor {
            type Value = D1Row;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("a D1 row object")
            }

            fn visit_map<M>(self, mut map: M) -> Result<D1Row, M::Error>
            where
                M: serde::de::MapAccess<'de>,
            {
                let mut pairs = Vec::new();
                while let Some((key, value)) = map.next_entry::<String, Value>()? {
                    pairs.push((key, value));
                }
                Ok(D1Row(pairs))
            }
        }

        deserializer.deserialize_map(RowVisitor)
    }
}

/// Serializes one D1 JSON value into the grid's cell convention, matching the
/// SQLite `RowWriter`: SQL `NULL` renders as the literal string `"NULL"`, and a
/// JSON object/array value passes through unchanged (so the front-end
/// `JsonInspector` picks it up). Scalars serialize as-is.
fn cell_to_json(value: &Value) -> Value {
    match value {
        Value::Null => Value::String("NULL".to_string()),
        // Objects/arrays and scalars pass straight through. D1 already returns
        // native JSON types (numbers, bools, strings), so no string-to-JSON
        // sniffing is needed — unlike SQLite, which stores JSON as TEXT.
        other => other.clone(),
    }
}

/// Builds a single page of rows (`Vec<Vec<Json>>`) for the given column order,
/// applying the cell convention. Columns absent from a row decode as `NULL`.
fn rows_to_page(rows: &[D1Row], columns: &[String]) -> Box<RawValue> {
    let page: Vec<Vec<Value>> = rows
        .iter()
        .map(|row| {
            columns
                .iter()
                .map(|column| match row.get(column) {
                    Some(value) => cell_to_json(value),
                    None => Value::String("NULL".to_string()),
                })
                .collect()
        })
        .collect();
    let json = serde_json::to_string(&page).expect("page values serialize");
    RawValue::from_string(json).expect("hand-built JSON is valid")
}

/// The Cloudflare D1 query adapter. Holds an `Arc<D1Http>` and implements the
/// shared `DatabaseAdapter` trait by translating SQL execution into REST calls.
pub struct D1Adapter {
    http: Arc<D1Http>,
}

impl D1Adapter {
    pub fn new(http: Arc<D1Http>) -> Self {
        Self { http }
    }

    /// The underlying HTTP handle, used by the schema reader and write adapter.
    pub fn http(&self) -> &D1Http {
        &self.http
    }

    /// Runs one statement and streams its result to the sender, mirroring the
    /// event sequence other adapters emit: `TypesResolved` → `Page`(s) →
    /// `Finished`. Read statements stream rows; writes report `meta.changes` as
    /// affected rows. D1 has no interactive transactions — every `/query` call
    /// autocommits — so multi-row mutations are sent statement-by-statement and
    /// each commits independently.
    pub async fn run_statement(
        &self,
        stmt: ParsedStatement,
        sender: &ExecSender,
    ) -> Result<(), Error> {
        let started_at = Instant::now();

        match self.http.query(&stmt.statement, Vec::new()).await {
            Ok(result_sets) => {
                let Some(set) = result_sets.into_iter().next() else {
                    // No result object at all — treat as a zero-row write.
                    sender.send(QueryExecEvent::Finished {
                        elapsed_ms: started_at.elapsed().as_millis() as u64,
                        affected_rows: 0,
                        error: None,
                    })?;
                    return Ok(());
                };

                if stmt.returns_values {
                    let columns = set.columns();
                    let columns_json = serde_json::to_string(&columns)
                        .map(|json| RawValue::from_string(json).expect("columns JSON is valid"))
                        .map_err(|error| {
                            Error::Any(anyhow::anyhow!("Failed to serialize D1 columns: {error}"))
                        })?;
                    sender.send(QueryExecEvent::TypesResolved {
                        columns: columns_json,
                    })?;

                    if !set.results.is_empty() {
                        let page = rows_to_page(&set.results, &columns);
                        sender.send(QueryExecEvent::Page {
                            page_amount: set.results.len(),
                            page,
                        })?;
                    }

                    sender.send(QueryExecEvent::Finished {
                        elapsed_ms: started_at.elapsed().as_millis() as u64,
                        affected_rows: 0,
                        error: None,
                    })?;
                } else {
                    sender.send(QueryExecEvent::Finished {
                        elapsed_ms: started_at.elapsed().as_millis() as u64,
                        affected_rows: set.meta.changes as usize,
                        error: None,
                    })?;
                }
                Ok(())
            }
            Err(error) => {
                let message = error.to_string();
                sender.send(QueryExecEvent::Finished {
                    elapsed_ms: started_at.elapsed().as_millis() as u64,
                    affected_rows: 0,
                    error: Some(message.clone()),
                })?;
                Err(error)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decode(json: &str) -> D1QueryResponse {
        serde_json::from_str(json).expect("d1 response should deserialize")
    }

    #[test]
    fn decodes_select_result_with_ordered_columns() {
        // The two rows arrive as objects; the decoder must keep column order
        // (id, name, active) rather than alphabetising it.
        let parsed = decode(
            r#"{
                "success": true,
                "errors": [],
                "result": [
                    {
                        "success": true,
                        "results": [
                            { "id": 1, "name": "Alice", "active": true },
                            { "id": 2, "name": "Bob", "active": false }
                        ],
                        "meta": { "changes": 0, "rows_read": 2, "duration": 0.4 }
                    }
                ]
            }"#,
        );
        assert!(parsed.success);
        let set = &parsed.result[0];
        assert_eq!(set.columns(), vec!["id", "name", "active"]);
        assert_eq!(set.results.len(), 2);
        assert_eq!(set.results[0].get("name"), Some(&Value::from("Alice")));
    }

    #[test]
    fn maps_rows_to_ordered_page_with_null_convention() {
        let parsed = decode(
            r#"{
                "success": true,
                "result": [
                    {
                        "results": [
                            { "id": 1, "name": "Alice", "note": null },
                            { "id": 2, "name": null, "note": "hi" }
                        ],
                        "meta": {}
                    }
                ]
            }"#,
        );
        let set = &parsed.result[0];
        let columns = set.columns();
        assert_eq!(columns, vec!["id", "name", "note"]);
        let page = rows_to_page(&set.results, &columns);
        // NULL renders as the literal string "NULL", matching the SQLite writer.
        assert_eq!(
            page.get(),
            r#"[[1,"Alice","NULL"],[2,"NULL","hi"]]"#
        );
    }

    #[test]
    fn passes_through_nested_json_values() {
        // D1 returns native JSON; an object/array cell must pass through so the
        // front-end JsonInspector renders it.
        let parsed = decode(
            r#"{
                "success": true,
                "result": [
                    {
                        "results": [ { "id": 1, "payload": { "a": [1, 2] } } ],
                        "meta": {}
                    }
                ]
            }"#,
        );
        let set = &parsed.result[0];
        let columns = set.columns();
        let page = rows_to_page(&set.results, &columns);
        assert_eq!(page.get(), r#"[[1,{"a":[1,2]}]]"#);
    }

    #[test]
    fn decodes_write_meta_changes() {
        let parsed = decode(
            r#"{
                "success": true,
                "result": [
                    { "results": [], "meta": { "changes": 3, "last_row_id": 42, "rows_written": 3 } }
                ]
            }"#,
        );
        let set = &parsed.result[0];
        assert_eq!(set.meta.changes, 3);
        assert_eq!(set.meta.last_row_id, 42);
        // An empty result set yields no columns.
        assert!(set.columns().is_empty());
    }

    #[test]
    fn surfaces_sql_error_as_readable_message() {
        // Cloudflare returns success:false with errors[] even on HTTP 200.
        let parsed = decode(
            r#"{
                "success": false,
                "errors": [ { "code": 7500, "message": "no such table: nope" } ],
                "result": []
            }"#,
        );
        assert!(!parsed.success);
        let message = parsed.error_message();
        assert!(message.contains("no such table: nope"));
        assert!(message.contains("7500"));
    }

    #[test]
    fn error_message_handles_empty_errors() {
        let parsed = decode(r#"{ "success": false, "errors": [], "result": [] }"#);
        assert!(parsed.error_message().contains("no error detail"));
    }

    #[test]
    fn parses_valid_d1_url() {
        let (account, db) = parse_d1_url("d1://acc-123/db-abc").expect("valid d1 url");
        assert_eq!(account, "acc-123");
        assert_eq!(db, "db-abc");
    }

    #[test]
    fn rejects_non_d1_url() {
        assert!(parse_d1_url("postgres://x/y").is_err());
        assert!(parse_d1_url("d1://only-account").is_err());
        assert!(parse_d1_url("d1:///missing-account").is_err());
    }

    #[test]
    fn tolerates_unknown_meta_and_extra_fields() {
        // The real payload carries many more meta keys (served_by_colo, timings,
        // size_after, …); decoding must ignore them.
        let parsed = decode(
            r#"{
                "success": true,
                "messages": [],
                "result": [
                    {
                        "success": true,
                        "results": [ { "x": 1 } ],
                        "meta": {
                            "changed_db": true, "changes": 0, "duration": 0.2,
                            "last_row_id": 0, "rows_read": 1, "rows_written": 0,
                            "served_by_primary": true, "served_by_region": "EEUR",
                            "served_by_colo": "LHR", "size_after": 12288,
                            "timings": { "sql_duration_ms": 0.2 }
                        }
                    }
                ]
            }"#,
        );
        assert!(parsed.success);
        assert_eq!(parsed.result[0].columns(), vec!["x"]);
    }
}
