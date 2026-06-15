use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;
use url::Url;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted personal access token (the original "paste a token" path).
const TOKEN_SETTING_KEY: &str = "integration.supabase.access_token";
// One-click OAuth credentials: encrypted JSON of access/refresh token + expiry.
const OAUTH_SETTING_KEY: &str = "integration.supabase.oauth";
const API_BASE_URL: &str = "https://api.supabase.com/v1";

// Base URL of the hosted OAuth proxy (the marketing app's route handlers). The
// proxy holds the Supabase client secret and performs the code/refresh
// exchanges; the desktop app never sees the secret. Override at runtime with
// DORA_OAUTH_PROXY_BASE (e.g. for local dev against `bun dev`).
//
const DEFAULT_PROXY_BASE: &str = "https://doradb.app";

// How long we wait for the user to complete the browser consent flow.
const OAUTH_TIMEOUT: Duration = Duration::from_secs(300);
// Refresh the access token if it expires within this window.
const REFRESH_SKEW_SECS: i64 = 60;

fn proxy_base() -> String {
    std::env::var("DORA_OAUTH_PROXY_BASE")
        .ok()
        .map(|value| value.trim().trim_end_matches('/').to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_PROXY_BASE.to_string())
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs() as i64)
        .unwrap_or(0)
}

/// Tokens issued by the OAuth flow, stored encrypted on-device.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthTokens {
    access_token: String,
    refresh_token: String,
    /// Absolute expiry, epoch seconds.
    expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SupabaseProject {
    pub id: String,
    pub name: String,
    pub region: String,
    pub status: String,
    pub db_host: String,
    pub db_version: String,
}

#[derive(Debug, Deserialize)]
struct SupabaseProjectResponse {
    id: String,
    name: String,
    region: String,
    status: String,
    database: Option<SupabaseProjectDatabase>,
}

#[derive(Debug, Deserialize)]
struct SupabaseProjectDatabase {
    host: Option<String>,
    version: Option<String>,
}

impl From<SupabaseProjectResponse> for SupabaseProject {
    fn from(project: SupabaseProjectResponse) -> Self {
        let database = project.database;
        Self {
            id: project.id,
            name: project.name,
            region: project.region,
            status: project.status,
            db_host: database
                .as_ref()
                .and_then(|database| database.host.clone())
                .unwrap_or_default(),
            db_version: database
                .as_ref()
                .and_then(|database| database.version.clone())
                .unwrap_or_default(),
        }
    }
}

fn store_pat(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to encrypt Supabase token: {error}"))
    })?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_pat(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decrypt Supabase token: {error}"))
    })?;
    Ok(Some(decrypted))
}

fn store_oauth(storage: &Storage, tokens: &OAuthTokens) -> Result<()> {
    let json = serde_json::to_string(tokens).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to serialize Supabase tokens: {error}"))
    })?;
    let encrypted = security::encrypt(&json).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to encrypt Supabase tokens: {error}"))
    })?;
    storage.set_setting(OAUTH_SETTING_KEY, &encrypted)
}

fn load_oauth(storage: &Storage) -> Result<Option<OAuthTokens>> {
    let Some(encrypted) = storage.get_setting(OAUTH_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decrypt Supabase tokens: {error}"))
    })?;
    let tokens = serde_json::from_str(&decrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to parse Supabase tokens: {error}"))
    })?;
    Ok(Some(tokens))
}

pub fn is_connected(storage: &Storage) -> bool {
    load_oauth(storage).ok().flatten().is_some() || load_pat(storage).ok().flatten().is_some()
}

pub fn disconnect(storage: &Storage) -> Result<()> {
    // Remove both credential kinds so "Disconnect" fully signs the user out
    // regardless of how they connected.
    storage.delete_setting(OAUTH_SETTING_KEY)?;
    storage.delete_setting(TOKEN_SETTING_KEY)
}

/// GETs `/projects` with a bearer token, returning the raw response without
/// mapping any status. Callers decide how to treat 401 (e.g. refresh + retry).
async fn get_projects_raw(token: &str) -> Result<reqwest::Response> {
    reqwest::Client::new()
        .get(format!("{API_BASE_URL}/projects"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Supabase request failed: {error}")))
}

fn decode_projects_response(status: reqwest::StatusCode, body: &str) -> Result<Vec<SupabaseProject>> {
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase rejected this access token. Reconnect your Supabase account and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase projects request failed with HTTP {status}: {body}"
        )));
    }
    let projects: Vec<SupabaseProjectResponse> = serde_json::from_str(body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Supabase project response: {error}"
        ))
    })?;
    Ok(projects.into_iter().map(Into::into).collect())
}

/// Validates a pasted personal access token by listing projects, then persists it
/// encrypted. Validating up front means a bad paste fails immediately rather than
/// on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase access token is empty"
        )));
    }
    let response = get_projects_raw(&token).await?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    decode_projects_response(status, &body)?;
    store_pat(storage, &token)
}

/// Returns a usable bearer token, transparently refreshing an expired OAuth
/// access token. Falls back to a stored personal access token.
async fn current_access_token(storage: &Storage) -> Result<String> {
    if let Some(tokens) = load_oauth(storage)? {
        if tokens.expires_at - now_secs() <= REFRESH_SKEW_SECS && !tokens.refresh_token.is_empty() {
            let refreshed = refresh_oauth(&tokens.refresh_token).await?;
            store_oauth(storage, &refreshed)?;
            return Ok(refreshed.access_token);
        }
        return Ok(tokens.access_token);
    }

    load_pat(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Supabase is not connected. Connect your Supabase account first."
        ))
    })
}

pub async fn list_projects(storage: &Storage) -> Result<Vec<SupabaseProject>> {
    let token = current_access_token(storage).await?;

    let response = get_projects_raw(&token).await?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    // A 401 on an OAuth connection can mean the access token died early; try one
    // refresh-and-retry before surfacing the error to the user.
    if status == reqwest::StatusCode::UNAUTHORIZED {
        if let Some(tokens) = load_oauth(storage)? {
            if !tokens.refresh_token.is_empty() {
                let refreshed = refresh_oauth(&tokens.refresh_token).await?;
                store_oauth(storage, &refreshed)?;
                let retry = get_projects_raw(&refreshed.access_token).await?;
                let retry_status = retry.status();
                let retry_body = retry.text().await.unwrap_or_default();
                return decode_projects_response(retry_status, &retry_body);
            }
        }
    }

    decode_projects_response(status, &body)
}

/// Returns the project's Supavisor pooler hostname (e.g.
/// `aws-0-eu-west-1.pooler.supabase.com`). The cluster index can't be derived
/// from the region — it must come from the Management API — so we fetch the
/// pooler config and pull the host out of whatever field carries it. Requires
/// the OAuth app's Database:Read scope.
pub async fn pooler_host(storage: &Storage, project_ref: &str) -> Result<String> {
    let token = current_access_token(storage).await?;
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/projects/{project_ref}/config/database/pooler"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Supabase pooler request failed: {error}")))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Couldn't load Supabase pooler details (HTTP {status}). The project may be paused, or the connection lacks the Database scope."
        )));
    }

    let value: serde_json::Value = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to parse Supabase pooler response: {error}"))
    })?;

    find_pooler_host(&value).ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Supabase pooler response did not include a pooler host."
        ))
    })
}

/// Recursively scans a JSON value for the first string that references the
/// Supavisor pooler, tolerating either a bare host or a full connection string.
/// This keeps us resilient to the exact response shape of the pooler endpoint.
fn find_pooler_host(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) if text.contains("pooler.supabase.com") => {
            Some(host_from_fragment(text))
        }
        serde_json::Value::Array(items) => items.iter().find_map(find_pooler_host),
        serde_json::Value::Object(map) => map.values().find_map(find_pooler_host),
        _ => None,
    }
}

/// Extracts the bare host from either a connection string
/// (`postgres://user:pw@HOST:port/db`) or an already-bare `HOST[:port]`.
fn host_from_fragment(fragment: &str) -> String {
    let after_at = fragment.rsplit('@').next().unwrap_or(fragment);
    after_at
        .split(['/', '?', ':'])
        .next()
        .unwrap_or(after_at)
        .to_string()
}

// ---------------------------------------------------------------------------
// One-click OAuth (loopback) flow
// ---------------------------------------------------------------------------

/// Token shape returned by the proxy's `/refresh` endpoint (camelCase JSON).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProxyTokens {
    access_token: String,
    refresh_token: String,
    expires_at: i64,
}

impl From<ProxyTokens> for OAuthTokens {
    fn from(value: ProxyTokens) -> Self {
        Self {
            access_token: value.access_token,
            refresh_token: value.refresh_token,
            expires_at: value.expires_at,
        }
    }
}

async fn refresh_oauth(refresh_token: &str) -> Result<OAuthTokens> {
    let response = reqwest::Client::new()
        .post(format!("{}/api/oauth/supabase/refresh", proxy_base()))
        .json(&serde_json::json!({ "refreshToken": refresh_token }))
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Supabase token refresh failed: {error}")))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase token refresh failed with HTTP {status}: {body}. Reconnect your account."
        )));
    }

    let tokens: ProxyTokens = response.json().await.map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decode refreshed Supabase tokens: {error}"))
    })?;
    Ok(tokens.into())
}

/// Runs the browser OAuth flow: binds a loopback listener, opens the consent
/// URL, waits for the proxy to redirect the tokens back, then stores them.
/// `open_url` opens the given URL in the user's browser (injected so the caller
/// supplies the Tauri shell).
pub async fn oauth_connect<F>(storage: &Storage, open_url: F) -> Result<()>
where
    F: FnOnce(String) -> Result<()>,
{
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to start local OAuth listener: {error}")))?;
    let port = listener
        .local_addr()
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to read local OAuth port: {error}")))?
        .port();

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");
    let start_url = format!(
        "{}/api/oauth/supabase/start?redirect_uri={}",
        proxy_base(),
        urlencoding(&redirect_uri)
    );

    open_url(start_url)?;

    // Block on the single loopback callback off the async runtime.
    let tokens = tokio::task::spawn_blocking(move || await_callback(listener))
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("OAuth listener task failed: {error}")))??;

    // Validate the freshly issued token before persisting, mirroring save_token.
    let response = get_projects_raw(&tokens.access_token).await?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    decode_projects_response(status, &body)?;

    store_oauth(storage, &tokens)
}

/// Minimal percent-encoding for the redirect_uri query value.
fn urlencoding(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

/// Accepts connections until the proxy hits `/callback` with tokens (or an
/// error), then returns. Times out so a closed browser tab can't hang forever.
fn await_callback(listener: TcpListener) -> Result<OAuthTokens> {
    listener
        .set_nonblocking(true)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to configure OAuth listener: {error}")))?;
    let deadline = Instant::now() + OAUTH_TIMEOUT;

    loop {
        if Instant::now() > deadline {
            return Err(Error::Any(anyhow::anyhow!(
                "Timed out waiting for Supabase authorization. Please try again."
            )));
        }

        match listener.accept() {
            Ok((mut stream, _)) => {
                let target = read_request_target(&mut stream)?;
                if !target.starts_with("/callback") {
                    write_response(&mut stream, "404 Not Found", "Not found");
                    continue;
                }

                let parsed = Url::parse(&format!("http://127.0.0.1{target}")).map_err(|error| {
                    Error::Any(anyhow::anyhow!("Failed to parse OAuth callback: {error}"))
                })?;
                let params: std::collections::HashMap<_, _> =
                    parsed.query_pairs().into_owned().collect();

                if let Some(error) = params.get("error") {
                    let detail = params
                        .get("error_description")
                        .cloned()
                        .unwrap_or_else(|| error.clone());
                    write_response(&mut stream, "400 Bad Request", &SUCCESS_PAGE_FAILURE);
                    return Err(Error::Any(anyhow::anyhow!(
                        "Supabase authorization failed: {detail}"
                    )));
                }

                match (
                    params.get("access_token"),
                    params.get("refresh_token"),
                    params.get("expires_at"),
                ) {
                    (Some(access), Some(refresh), Some(expires)) => {
                        write_response(&mut stream, "200 OK", &SUCCESS_PAGE_OK);
                        return Ok(OAuthTokens {
                            access_token: access.clone(),
                            refresh_token: refresh.clone(),
                            expires_at: expires.parse().unwrap_or_else(|_| now_secs()),
                        });
                    }
                    _ => {
                        write_response(&mut stream, "400 Bad Request", &SUCCESS_PAGE_FAILURE);
                        return Err(Error::Any(anyhow::anyhow!(
                            "Supabase callback was missing tokens."
                        )));
                    }
                }
            }
            Err(ref error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(error) => {
                return Err(Error::Any(anyhow::anyhow!(
                    "OAuth listener accept failed: {error}"
                )));
            }
        }
    }
}

fn read_request_target(stream: &mut std::net::TcpStream) -> Result<String> {
    let mut buffer = [0u8; 8192];
    let read = stream
        .read(&mut buffer)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to read OAuth request: {error}")))?;
    let text = String::from_utf8_lossy(&buffer[..read]);
    let request_line = text.lines().next().unwrap_or_default();
    // "GET /callback?... HTTP/1.1"
    let target = request_line
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .to_string();
    Ok(target)
}

fn write_response(stream: &mut std::net::TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

const SUCCESS_PAGE_OK: &str = "<!doctype html><meta charset=utf-8><title>Supabase connected</title><body style=\"font-family:system-ui;max-width:32rem;margin:4rem auto;text-align:center;color:#111\"><h1 style=\"font-size:1.1rem\">Supabase connected</h1><p style=\"color:#555\">You can close this window and return to Dora.</p></body>";
const SUCCESS_PAGE_FAILURE: &str = "<!doctype html><meta charset=utf-8><title>Supabase connection failed</title><body style=\"font-family:system-ui;max-width:32rem;margin:4rem auto;text-align:center;color:#111\"><h1 style=\"font-size:1.1rem\">Connection failed</h1><p style=\"color:#555\">Something went wrong. Close this window and try again from Dora.</p></body>";

#[cfg(test)]
mod tests {
    use super::*;

    fn deserialize_project(json: &str) -> SupabaseProject {
        let response: SupabaseProjectResponse =
            serde_json::from_str(json).expect("project json should deserialize");
        response.into()
    }

    #[test]
    fn maps_database_host_and_version_from_api_response() {
        let project = deserialize_project(
            r#"{
                "id": "abcdefghijklmnopqrst",
                "name": "my-saas-app",
                "region": "eu-west-2",
                "status": "ACTIVE_HEALTHY",
                "database": { "host": "db.abcdefghijklmnopqrst.supabase.co", "version": "15.1.0.147" }
            }"#,
        );
        assert_eq!(project.id, "abcdefghijklmnopqrst");
        assert_eq!(project.db_host, "db.abcdefghijklmnopqrst.supabase.co");
        assert_eq!(project.db_version, "15.1.0.147");
    }

    #[test]
    fn extracts_pooler_host_from_connection_string() {
        let value = serde_json::json!({
            "connection_string": "postgres://postgres.abcdefghijklmnopqrst:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
            "pool_mode": "transaction"
        });
        assert_eq!(
            find_pooler_host(&value).as_deref(),
            Some("aws-1-eu-west-1.pooler.supabase.com")
        );
    }

    #[test]
    fn extracts_pooler_host_from_bare_field_or_array() {
        let object = serde_json::json!({ "db_host": "aws-0-eu-central-1.pooler.supabase.com" });
        assert_eq!(
            find_pooler_host(&object).as_deref(),
            Some("aws-0-eu-central-1.pooler.supabase.com")
        );

        let array = serde_json::json!([{ "identifier": "primary", "db_host": "aws-0-us-east-1.pooler.supabase.com:5432" }]);
        assert_eq!(
            find_pooler_host(&array).as_deref(),
            Some("aws-0-us-east-1.pooler.supabase.com")
        );
    }

    #[test]
    fn pooler_host_absent_returns_none() {
        let value = serde_json::json!({ "db_host": "db.ref.supabase.co", "version": "15" });
        assert_eq!(find_pooler_host(&value), None);
    }

    #[test]
    fn tolerates_missing_database_block() {
        // Paused/initializing projects can omit the database object entirely;
        // decoding must not fail — the frontend falls back to db.<ref>.supabase.co.
        let project = deserialize_project(
            r#"{
                "id": "pausedprojectref0001",
                "name": "paused",
                "region": "us-east-1",
                "status": "INACTIVE"
            }"#,
        );
        assert_eq!(project.db_host, "");
        assert_eq!(project.db_version, "");
        assert_eq!(project.status, "INACTIVE");
    }
}
