//! PostHog HogQL query adapter.
//!
//! PostHog Cloud has **no SQL wire protocol**: queries run over the HogQL Query
//! API (`POST /api/projects/{project_id}/query/`) with a personal API key as a
//! bearer token. The dialect is HogQL (ClickHouse-flavoured) and the data source
//! is **read-only** — the studio browses events/persons/sessions/groups but can
//! never mutate them (see the read-only `WriteAdapter` impl in
//! `adapter/write_posthog.rs`).
//!
//! ## Result shaping
//!
//! Unlike D1 (which returns row *objects*), the HogQL Query API already returns
//! rows as column-ordered arrays plus parallel `columns`/`types` lists, so the
//! grid's `Vec<Vec<Json>>` page shape is a near-direct passthrough — only the
//! SQL-`NULL` cell convention is applied.

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

/// Holds the coordinates and credential needed to talk to one PostHog project
/// over the HogQL Query API. Cheap to clone (`reqwest::Client` is an `Arc`
/// internally), so it lives behind an `Arc` on the `DatabaseClient::Posthog`
/// variant.
#[derive(Clone, Debug)]
pub struct PosthogHttp {
    client: reqwest::Client,
    api_base: String,
    project_id: String,
    api_key: String,
}

impl PosthogHttp {
    pub fn new(region: &str, project_id: String, api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_base: region_api_base(region).to_string(),
            project_id,
            api_key,
        }
    }

    /// Parses a `posthog://{region}/{project_id}` URL (the shape the connect-flow
    /// stores in `Connection.url`) plus the personal API key into a `PosthogHttp`.
    pub fn from_url(url: &str, api_key: &str) -> Result<Self, Error> {
        let (region, project_id) = parse_posthog_url(url)?;
        Ok(Self::new(&region, project_id, api_key.to_string()))
    }

    fn query_endpoint(&self) -> String {
        format!("{}/api/projects/{}/query/", self.api_base, self.project_id)
    }

    /// Runs a single HogQL statement over the Query API and returns its result
    /// set (columns, types, rows). Errors are mapped to friendly messages for
    /// the connect-flow and SQL console.
    pub async fn query(&self, hogql: &str) -> Result<PosthogResultSet, Error> {
        let text = self
            .post_query(serde_json::json!({ "kind": "HogQLQuery", "query": hogql }))
            .await?;
        parse_result_set(&text)
    }

    /// Posts any Query API `query` node (`HogQLQuery`, `DatabaseSchemaQuery`, …)
    /// and returns the raw response body, mapping transport and auth failures to
    /// the friendly messages the connect-flow and SQL console surface.
    pub async fn post_query(&self, query: Value) -> Result<String, Error> {
        let response = self
            .client
            .post(self.query_endpoint())
            .bearer_auth(&self.api_key)
            .json(&serde_json::json!({ "query": query }))
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!("PostHog query request failed: {error}"))
            })?;

        let status = response.status();
        let text = read_body(response).await;

        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(Error::Any(anyhow::anyhow!(
                "PostHog rejected this API key. It must be a personal API key with \
                 query (read) access to this project."
            )));
        }
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(Error::Any(anyhow::anyhow!(
                "PostHog project {} was not found in this region. Check the project id \
                 and region.",
                self.project_id
            )));
        }
        if !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!(
                "PostHog query failed with HTTP {status}: {}",
                truncate(&text, 500)
            )));
        }

        Ok(text)
    }
}

fn region_api_base(region: &str) -> &'static str {
    match region.to_ascii_lowercase().as_str() {
        "eu" => "https://eu.posthog.com",
        _ => "https://us.posthog.com",
    }
}

/// Splits a `posthog://{region}/{project_id}` URL into its parts.
pub fn parse_posthog_url(url: &str) -> Result<(String, String), Error> {
    let rest = url.strip_prefix("posthog://").ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Expected a posthog:// connection URL, got: {url}"
        ))
    })?;
    let mut parts = rest.splitn(2, '/');
    let region = parts.next().unwrap_or("").trim();
    let project_id = parts.next().unwrap_or("").trim();
    if region.is_empty() || project_id.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "Malformed posthog:// URL (expected posthog://<region>/<project_id>): {url}"
        )));
    }
    Ok((region.to_string(), project_id.to_string()))
}

/// Reads a response body, preserving context when it's empty or unreadable.
async fn read_body(response: reqwest::Response) -> String {
    match response.text().await {
        Ok(text) if !text.trim().is_empty() => text,
        Ok(_) => "(empty response body)".to_string(),
        Err(error) => format!("(failed to read response body: {error})"),
    }
}

fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    format!("{}…", &text[..max])
}

/// The HogQL Query API response envelope. `results` holds the rows; `columns`
/// and `types` are parallel arrays describing them. Everything except `results`
/// is optional so a leaner response still decodes.
#[derive(Debug, Deserialize)]
struct HogqlResponse {
    #[serde(default)]
    results: Vec<Vec<Value>>,
    #[serde(default)]
    columns: Vec<String>,
    #[serde(default)]
    types: Vec<Value>,
}

/// One HogQL result set, already column-ordered.
#[derive(Debug, Clone)]
pub struct PosthogResultSet {
    pub columns: Vec<String>,
    pub types: Vec<Option<String>>,
    pub rows: Vec<Vec<Value>>,
}

fn parse_result_set(text: &str) -> Result<PosthogResultSet, Error> {
    let parsed: HogqlResponse = serde_json::from_str(text).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode PostHog query response: {error}"
        ))
    })?;

    let types = parsed.types.into_iter().map(type_label).collect::<Vec<_>>();

    // Fall back to positional column names when the API omits `columns`, so the
    // grid always has a header for every cell.
    let column_count = parsed
        .results
        .first()
        .map(|row| row.len())
        .unwrap_or(parsed.columns.len());
    let mut columns = parsed.columns;
    while columns.len() < column_count {
        columns.push(format!("column_{}", columns.len() + 1));
    }

    Ok(PosthogResultSet {
        columns,
        types,
        rows: parsed.results,
    })
}

// HogQL `types` entries are usually `["column", "ClickHouseType"]` pairs but can
// also be a bare string; pull out the type label either way.
fn type_label(value: Value) -> Option<String> {
    match value {
        Value::String(label) => Some(label),
        Value::Array(parts) => parts
            .into_iter()
            .filter_map(|part| part.as_str().map(str::to_string))
            .last(),
        _ => None,
    }
}

/// Serializes one HogQL JSON value into the grid's cell convention, matching the
/// SQLite/D1 writers: SQL `NULL` renders as the literal string `"NULL"`; objects,
/// arrays, and scalars pass through unchanged so the front-end `JsonInspector`
/// picks nested values up.
fn cell_to_json(value: &Value) -> Value {
    match value {
        Value::Null => Value::String("NULL".to_string()),
        other => other.clone(),
    }
}

/// Builds a single page of rows (`Vec<Vec<Json>>`) applying the cell convention.
fn rows_to_page(rows: &[Vec<Value>]) -> Box<RawValue> {
    let page: Vec<Vec<Value>> = rows
        .iter()
        .map(|row| row.iter().map(cell_to_json).collect())
        .collect();
    let json = serde_json::to_string(&page).expect("page values serialize");
    RawValue::from_string(json).expect("hand-built JSON is valid")
}

/// The PostHog HogQL query adapter. Holds an `Arc<PosthogHttp>` and implements
/// the shared `DatabaseAdapter` trait by translating query execution into HogQL
/// Query API calls.
pub struct PosthogAdapter {
    http: Arc<PosthogHttp>,
}

impl PosthogAdapter {
    pub fn new(http: Arc<PosthogHttp>) -> Self {
        Self { http }
    }

    /// The underlying HTTP handle, used by the schema reader.
    pub fn http(&self) -> &PosthogHttp {
        &self.http
    }

    /// Runs one statement and streams its result to the sender, mirroring the
    /// event sequence other adapters emit: `TypesResolved` → `Page`(s) →
    /// `Finished`. PostHog is read-only, so every statement is a read that
    /// streams rows; there are no affected-row writes.
    pub async fn run_statement(
        &self,
        stmt: ParsedStatement,
        sender: &ExecSender,
    ) -> Result<(), Error> {
        let started_at = Instant::now();

        match self.http.query(&stmt.statement).await {
            Ok(set) => {
                if stmt.returns_values {
                    let columns_json = serde_json::to_string(&set.columns)
                        .map(|json| RawValue::from_string(json).expect("columns JSON is valid"))
                        .map_err(|error| {
                            Error::Any(anyhow::anyhow!(
                                "Failed to serialize PostHog columns: {error}"
                            ))
                        })?;
                    sender.send(QueryExecEvent::TypesResolved {
                        columns: columns_json,
                    })?;

                    if !set.rows.is_empty() {
                        let page = rows_to_page(&set.rows);
                        sender.send(QueryExecEvent::Page {
                            page_amount: set.rows.len(),
                            page,
                        })?;
                    }
                }

                sender.send(QueryExecEvent::Finished {
                    elapsed_ms: started_at.elapsed().as_millis() as u64,
                    affected_rows: 0,
                    error: None,
                })?;
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

    #[test]
    fn region_maps_to_cloud_host() {
        assert_eq!(region_api_base("us"), "https://us.posthog.com");
        assert_eq!(region_api_base("eu"), "https://eu.posthog.com");
        assert_eq!(region_api_base("EU"), "https://eu.posthog.com");
        assert_eq!(region_api_base("unknown"), "https://us.posthog.com");
    }

    #[test]
    fn parses_valid_posthog_url() {
        let (region, project) = parse_posthog_url("posthog://us/497538").expect("valid url");
        assert_eq!(region, "us");
        assert_eq!(project, "497538");
    }

    #[test]
    fn rejects_non_posthog_url() {
        assert!(parse_posthog_url("d1://x/y").is_err());
        assert!(parse_posthog_url("posthog://only-region").is_err());
        assert!(parse_posthog_url("posthog:///missing-region").is_err());
    }

    #[test]
    fn parses_full_hogql_response() {
        let body = r#"{
            "results": [["$pageview", 42], ["$autocapture", 7]],
            "columns": ["event", "count"],
            "types": [["event", "String"], ["count", "UInt64"]]
        }"#;
        let set = parse_result_set(body).expect("should decode");
        assert_eq!(set.columns, vec!["event", "count"]);
        assert_eq!(set.types, vec![Some("String".into()), Some("UInt64".into())]);
        assert_eq!(set.rows.len(), 2);
        assert_eq!(set.rows[0][0], Value::from("$pageview"));
    }

    #[test]
    fn synthesizes_headers_when_columns_missing() {
        let body = r#"{ "results": [[1, 2, 3]] }"#;
        let set = parse_result_set(body).expect("should decode without columns");
        assert_eq!(set.columns, vec!["column_1", "column_2", "column_3"]);
    }

    #[test]
    fn null_cells_render_as_null_literal() {
        let rows = vec![vec![Value::from(1), Value::Null]];
        let page = rows_to_page(&rows);
        assert_eq!(page.get(), r#"[[1,"NULL"]]"#);
    }

    #[test]
    fn nested_json_cells_pass_through() {
        let rows = vec![vec![serde_json::json!({ "a": [1, 2] })]];
        let page = rows_to_page(&rows);
        assert_eq!(page.get(), r#"[[{"a":[1,2]}]]"#);
    }
}
