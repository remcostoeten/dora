use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// PostHog Cloud has no wire-protocol endpoint; the only door is HogQL over
// HTTPS (personal API key + project id). We store the whole credential set as a
// single encrypted JSON blob so a connection needs just one secret on-device.
const CONFIG_SETTING_KEY: &str = "integration.posthog.config";

/// Which PostHog Cloud region the project lives in. Self-hosted instances are
/// not supported by this path (they'd need a direct ClickHouse connection).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PosthogRegion {
    Us,
    Eu,
}

impl PosthogRegion {
    fn api_base(self) -> &'static str {
        match self {
            PosthogRegion::Us => "https://us.posthog.com",
            PosthogRegion::Eu => "https://eu.posthog.com",
        }
    }
}

/// The full credential set, persisted encrypted. Only the non-secret parts are
/// ever returned to the frontend (see [`PosthogConfig`]).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredConfig {
    api_key: String,
    region: PosthogRegion,
    project_id: String,
}

/// The connection config surfaced to the UI for prefilling — deliberately
/// excludes the API key, which never leaves the device unencrypted.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PosthogConfig {
    pub region: PosthogRegion,
    pub project_id: String,
}

/// A HogQL query result, shaped for the grid: a column header list, the
/// ClickHouse type per column (best-effort), and rows of raw JSON cells.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PosthogQueryResult {
    pub columns: Vec<String>,
    pub types: Vec<Option<String>>,
    #[specta(type = Vec<Vec<serde_json::Value>>)]
    pub rows: Vec<Vec<serde_json::Value>>,
}

// The Query API response for a HogQLQuery. `results` holds the rows; `columns`
// and `types` are parallel arrays describing them. Everything except `results`
// is optional so a leaner response still decodes.
#[derive(Debug, Deserialize)]
struct HogqlResponse {
    #[serde(default)]
    results: Vec<Vec<serde_json::Value>>,
    #[serde(default)]
    columns: Vec<String>,
    #[serde(default)]
    types: Vec<serde_json::Value>,
}

fn store_config(storage: &Storage, config: &StoredConfig) -> Result<()> {
    let json = serde_json::to_string(config).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to serialize PostHog config: {error}"))
    })?;
    let encrypted = security::encrypt(&json).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to encrypt PostHog config: {error}"))
    })?;
    storage.set_setting(CONFIG_SETTING_KEY, &encrypted)
}

fn load_config(storage: &Storage) -> Result<Option<StoredConfig>> {
    let Some(encrypted) = storage.get_setting(CONFIG_SETTING_KEY)? else {
        return Ok(None);
    };
    let json = security::decrypt(&encrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decrypt PostHog config: {error}"))
    })?;
    let config = serde_json::from_str(&json).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to parse PostHog config: {error}"))
    })?;
    Ok(Some(config))
}

fn require_config(storage: &Storage) -> Result<StoredConfig> {
    load_config(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "PostHog is not connected. Add a personal API key first."
        ))
    })
}

pub fn is_connected(storage: &Storage) -> bool {
    load_config(storage).ok().flatten().is_some()
}

/// Loads the stored personal API key for use as a bearer token when connecting a
/// saved PostHog connection. The key never leaves the device unencrypted and is
/// never persisted on the connection itself (only `posthog://region/project` is).
pub fn connect_token(storage: &Storage) -> Result<String> {
    Ok(require_config(storage)?.api_key)
}

pub fn disconnect(storage: &Storage) -> Result<()> {
    storage.delete_setting(CONFIG_SETTING_KEY)
}

/// The connection config (region + project id, no secret) so the UI can show
/// which project is connected and prefill the connect form.
pub fn current_config(storage: &Storage) -> Result<Option<PosthogConfig>> {
    Ok(load_config(storage)?.map(|config| PosthogConfig {
        region: config.region,
        project_id: config.project_id,
    }))
}

async fn execute(config: &StoredConfig, hogql: &str) -> Result<PosthogQueryResult> {
    let url = format!(
        "{}/api/projects/{}/query/",
        config.region.api_base(),
        config.project_id
    );
    let body = serde_json::json!({
        "query": { "kind": "HogQLQuery", "query": hogql }
    });

    let response = reqwest::Client::new()
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("PostHog query request failed: {error}")))?;

    let status = response.status();
    let text = response.text().await.unwrap_or_default();

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(Error::Any(anyhow::anyhow!(
            "PostHog rejected this API key. Generate a new personal API key with query access and try again."
        )));
    }
    if status == reqwest::StatusCode::NOT_FOUND {
        return Err(Error::Any(anyhow::anyhow!(
            "PostHog project {} was not found in this region. Check the project id and region.",
            config.project_id
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "PostHog query failed with HTTP {status}: {}",
            truncate(&text, 500)
        )));
    }

    parse_response(&text)
}

fn parse_response(text: &str) -> Result<PosthogQueryResult> {
    let parsed: HogqlResponse = serde_json::from_str(text).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode PostHog query response: {error}"
        ))
    })?;

    let types = parsed
        .types
        .into_iter()
        .map(type_label)
        .collect::<Vec<_>>();

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

    Ok(PosthogQueryResult {
        columns,
        types,
        rows: parsed.results,
    })
}

// HogQL `types` entries are usually `["column", "ClickHouseType"]` pairs but can
// also be a bare string; pull out the type label either way.
fn type_label(value: serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(label) => Some(label),
        serde_json::Value::Array(parts) => parts
            .into_iter()
            .filter_map(|part| part.as_str().map(str::to_string))
            .last(),
        _ => None,
    }
}

fn truncate(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    format!("{}…", &text[..max])
}

/// Validates a pasted API key by running a trivial query against the project,
/// then persists the whole config encrypted. Validating up front means a bad
/// key or wrong region/project fails immediately rather than on first use.
pub async fn save_credentials(
    storage: &Storage,
    api_key: String,
    region: PosthogRegion,
    project_id: String,
) -> Result<()> {
    let api_key = api_key.trim().to_string();
    let project_id = project_id.trim().to_string();
    if api_key.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("PostHog API key is empty")));
    }
    if project_id.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("PostHog project id is empty")));
    }

    let config = StoredConfig {
        api_key,
        region,
        project_id,
    };
    execute(&config, "SELECT 1").await?;
    store_config(storage, &config)
}

/// Runs an arbitrary HogQL query against the connected project.
pub async fn run_query(storage: &Storage, hogql: &str) -> Result<PosthogQueryResult> {
    let config = require_config(storage)?;
    execute(&config, hogql).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_maps_to_cloud_host() {
        assert_eq!(PosthogRegion::Us.api_base(), "https://us.posthog.com");
        assert_eq!(PosthogRegion::Eu.api_base(), "https://eu.posthog.com");
    }

    #[test]
    fn parses_full_hogql_response() {
        let body = r#"{
            "results": [["$pageview", 42], ["$autocapture", 7]],
            "columns": ["event", "count"],
            "types": [["event", "String"], ["count", "UInt64"]]
        }"#;
        let result = parse_response(body).expect("should decode");
        assert_eq!(result.columns, vec!["event", "count"]);
        assert_eq!(result.types, vec![Some("String".into()), Some("UInt64".into())]);
        assert_eq!(result.rows.len(), 2);
        assert_eq!(result.rows[0][0], serde_json::json!("$pageview"));
        assert_eq!(result.rows[0][1], serde_json::json!(42));
    }

    #[test]
    fn synthesizes_headers_when_columns_missing() {
        let body = r#"{ "results": [[1, 2, 3]] }"#;
        let result = parse_response(body).expect("should decode without columns");
        assert_eq!(result.columns, vec!["column_1", "column_2", "column_3"]);
    }

    #[test]
    fn tolerates_empty_result_set() {
        let body = r#"{ "results": [], "columns": ["event"], "types": [["event", "String"]] }"#;
        let result = parse_response(body).expect("should decode empty results");
        assert!(result.rows.is_empty());
        assert_eq!(result.columns, vec!["event"]);
    }

    #[test]
    fn type_label_handles_bare_string_and_pair() {
        assert_eq!(type_label(serde_json::json!("UInt64")), Some("UInt64".into()));
        assert_eq!(
            type_label(serde_json::json!(["count", "UInt64"])),
            Some("UInt64".into())
        );
        assert_eq!(type_label(serde_json::json!(null)), None);
    }
}
