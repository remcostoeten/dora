use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted Xata API key, encrypted on-device. Xata's control-plane API is
// token-based (Bearer), so this is the only credential we store. The same key
// doubles as the Postgres password in the connection string we assemble.
const TOKEN_SETTING_KEY: &str = "integration.xata.access_token";
// The Xata "core" control-plane API — operations not bound to a single
// workspace (the authed user, the workspace list). Versionless, but the shapes
// we decode are tolerant (extra fields ignored, optionals defaulted) so a future
// drift doesn't hard-fail. See the decode tests for the pinned payloads.
const CORE_API_BASE_URL: &str = "https://api.xata.io";
// Xata exposes a Postgres-compatible endpoint per database/branch at
// `{region}.sql.xata.sh`. The connection string is:
//   postgresql://{workspaceId}:{apiKey}@{region}.sql.xata.sh:5432/{db}:{branch}
// (the workspace id is the PG user, the API key is the PG password). Branches
// default to `main`, Xata's universal default branch.
const SQL_HOST_SUFFIX: &str = "sql.xata.sh";
const SQL_PORT: u16 = 5432;
const DEFAULT_BRANCH: &str = "main";

// The Xata account the stored key belongs to (`GET /user`), so the UI can show
// which account is connected. Both fields are optional in case the API omits one.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct XataAccount {
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub fullname: String,
}

/// A selectable Xata database, flattened across the user's workspaces. The
/// workspace id (PG user) and region (PG host) are carried so we can assemble a
/// Postgres connection string for it later without re-discovering anything. The
/// branch defaults to `main` at connect time.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct XataDatabase {
    pub workspace_id: String,
    pub workspace_name: String,
    pub database_name: String,
    pub region: String,
    /// Whether Xata reports this database as reachable over the Postgres
    /// protocol. Databases without it can't be connected as a Postgres source,
    /// so the connect-flow can flag them.
    pub postgres_enabled: bool,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    #[serde(default)]
    email: String,
    #[serde(default)]
    fullname: String,
}

#[derive(Debug, Deserialize)]
struct WorkspacesResponse {
    #[serde(default)]
    workspaces: Vec<WorkspaceResponse>,
}

#[derive(Debug, Deserialize)]
struct WorkspaceResponse {
    id: String,
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct DatabasesResponse {
    #[serde(default)]
    databases: Vec<DatabaseResponse>,
}

#[derive(Debug, Deserialize)]
struct DatabaseResponse {
    name: String,
    #[serde(default)]
    region: String,
    // Xata flags Postgres-reachable databases with `postgresEnabled`. Older
    // payloads omit it; treat a missing flag as enabled so we don't hide
    // connectable databases on an older API.
    #[serde(default = "default_true", rename = "postgresEnabled")]
    postgres_enabled: bool,
}

fn default_true() -> bool {
    true
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to encrypt Xata token: {error}")))?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to decrypt Xata token: {error}")))?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Xata is not connected. Add a Xata API key first."
        ))
    })
}

pub fn is_connected(storage: &Storage) -> bool {
    load_token(storage).ok().flatten().is_some()
}

pub fn disconnect(storage: &Storage) -> Result<()> {
    storage.delete_setting(TOKEN_SETTING_KEY)
}

/// Reads a response body, preserving context when it's empty or unreadable so a
/// failed request doesn't collapse into a bare `HTTP 502: ` with no detail.
async fn read_body(response: reqwest::Response) -> String {
    match response.text().await {
        Ok(text) if !text.trim().is_empty() => text,
        Ok(_) => "(empty response body)".to_string(),
        Err(error) => format!("(failed to read response body: {error})"),
    }
}

async fn get_workspaces(token: &str) -> Result<Vec<WorkspaceResponse>> {
    let response = reqwest::Client::new()
        .get(format!("{CORE_API_BASE_URL}/workspaces"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Xata workspaces request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Xata rejected this API key. Generate a new key and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Xata workspaces request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: WorkspacesResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Xata workspaces response: {error}"
        ))
    })?;
    Ok(parsed.workspaces)
}

async fn get_workspace_databases(token: &str, workspace_id: &str) -> Result<Vec<DatabaseResponse>> {
    let response = reqwest::Client::new()
        .get(format!("{CORE_API_BASE_URL}/workspaces/{workspace_id}/dbs"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Xata databases request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Xata databases request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: DatabasesResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Xata databases response: {error}"
        ))
    })?;
    Ok(parsed.databases)
}

/// The Xata account the stored key belongs to (`GET /user`), so the UI can show
/// which account is connected.
pub async fn current_account(storage: &Storage) -> Result<XataAccount> {
    let token = require_token(storage)?;
    let response = reqwest::Client::new()
        .get(format!("{CORE_API_BASE_URL}/user"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Xata account request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Xata rejected this API key. Generate a new key and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Xata account request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: UserResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Xata account response: {error}"
        ))
    })?;
    Ok(XataAccount {
        email: parsed.email,
        fullname: parsed.fullname,
    })
}

/// Validates a pasted API key by listing workspaces, then persists it encrypted.
/// Validating up front means a bad paste fails immediately rather than on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("Xata API key is empty")));
    }
    get_workspaces(&token).await?;
    store_token(storage, &token)
}

/// Lists every database the key can see, flattened across all the user's
/// workspaces. The workspace id + region travel with each entry so the
/// connect-flow can mint a Postgres connection string without re-discovery.
pub async fn list_databases(storage: &Storage) -> Result<Vec<XataDatabase>> {
    let token = require_token(storage)?;
    let mut databases = Vec::new();

    for workspace in get_workspaces(&token).await? {
        for db in get_workspace_databases(&token, &workspace.id).await? {
            databases.push(XataDatabase {
                workspace_id: workspace.id.clone(),
                workspace_name: workspace.name.clone(),
                database_name: db.name,
                region: db.region,
                postgres_enabled: db.postgres_enabled,
            });
        }
    }

    Ok(databases)
}

/// Assembles the Postgres connection string for a Xata database/branch, embedding
/// the stored API key as the password. Built on-device so the API key never
/// crosses to the frontend — the connection Dora stores carries no hand-copied
/// secret, mirroring how Neon mints a connection URI server-side.
///
/// Shape: `postgresql://{workspaceId}:{apiKey}@{region}.sql.xata.sh:5432/{db}:{branch}?sslmode=require`
pub async fn build_connection_string(
    storage: &Storage,
    workspace_id: &str,
    region: &str,
    database_name: &str,
    branch: Option<&str>,
) -> Result<String> {
    let token = require_token(storage)?;

    let workspace_id = workspace_id.trim();
    let region = region.trim();
    let database_name = database_name.trim();
    if workspace_id.is_empty() || region.is_empty() || database_name.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "Can't build a Xata connection string: missing workspace, region, or database."
        )));
    }
    let branch = branch
        .map(str::trim)
        .filter(|branch| !branch.is_empty())
        .unwrap_or(DEFAULT_BRANCH);

    // Percent-encode the credentials and the `db:branch` path: the API key and
    // branch separator (`:`) carry characters that aren't URL-safe in the
    // userinfo/path of a connection URI.
    let user = encode_userinfo(workspace_id);
    let password = encode_userinfo(&token);
    let db_and_branch = format!(
        "{}:{}",
        encode_path_segment(database_name),
        encode_path_segment(branch)
    );

    Ok(format!(
        "postgresql://{user}:{password}@{region}.{SQL_HOST_SUFFIX}:{SQL_PORT}/{db_and_branch}?sslmode=require"
    ))
}

/// Percent-encodes a connection-URI userinfo component (user or password),
/// escaping the sub-delimiters and reserved characters that would otherwise be
/// misparsed (`:` `@` `/` `?` `#` etc.). Unreserved chars pass through.
fn encode_userinfo(value: &str) -> String {
    encode_with(value, |byte| {
        matches!(byte, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~')
    })
}

/// Percent-encodes a single path segment. Same unreserved set as userinfo — the
/// `:` joining `db` and `branch` is added by the caller, unescaped, on purpose.
fn encode_path_segment(value: &str) -> String {
    encode_userinfo(value)
}

fn encode_with(value: &str, is_unreserved: impl Fn(u8) -> bool) -> String {
    let mut out = String::with_capacity(value.len());
    for &byte in value.as_bytes() {
        if is_unreserved(byte) {
            out.push(byte as char);
        } else {
            out.push('%');
            out.push_str(&format!("{byte:02X}"));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_user_fields() {
        let parsed: UserResponse = serde_json::from_str(
            r#"{ "id": "usr-1", "email": "dev@example.com", "fullname": "Dev Eloper", "image": "x" }"#,
        )
        .expect("user json should deserialize and ignore extra fields");
        assert_eq!(parsed.email, "dev@example.com");
        assert_eq!(parsed.fullname, "Dev Eloper");
    }

    #[test]
    fn tolerates_user_missing_fullname() {
        let parsed: UserResponse = serde_json::from_str(r#"{ "email": "dev@example.com" }"#)
            .expect("user json should deserialize with only email");
        assert_eq!(parsed.email, "dev@example.com");
        assert_eq!(parsed.fullname, "");
    }

    #[test]
    fn decodes_workspaces() {
        let parsed: WorkspacesResponse = serde_json::from_str(
            r#"{ "workspaces": [
                { "id": "ws-abc123", "unique_id": "myws-abc123", "name": "My Workspace", "slug": "my-workspace", "role": "owner", "plan": "free" }
            ] }"#,
        )
        .expect("workspaces json should deserialize");
        assert_eq!(parsed.workspaces.len(), 1);
        assert_eq!(parsed.workspaces[0].id, "ws-abc123");
        assert_eq!(parsed.workspaces[0].name, "My Workspace");
    }

    #[test]
    fn decodes_databases_with_region() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [
                { "name": "Games", "region": "us-east-1", "createdAt": "2024-01-01T00:00:00Z", "postgresEnabled": true }
            ] }"#,
        )
        .expect("databases json should deserialize");
        assert_eq!(parsed.databases.len(), 1);
        assert_eq!(parsed.databases[0].name, "Games");
        assert_eq!(parsed.databases[0].region, "us-east-1");
        assert!(parsed.databases[0].postgres_enabled);
    }

    #[test]
    fn treats_missing_postgres_enabled_as_enabled() {
        // Older payloads omit `postgresEnabled`; a missing flag must default to
        // true so connectable databases aren't hidden.
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [ { "name": "Games", "region": "eu-west-1", "createdAt": "2024-01-01T00:00:00Z" } ] }"#,
        )
        .expect("databases json should deserialize without postgresEnabled");
        assert!(parsed.databases[0].postgres_enabled);
    }

    #[test]
    fn decodes_postgres_disabled_database() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [ { "name": "Legacy", "region": "us-east-1", "createdAt": "2024-01-01T00:00:00Z", "postgresEnabled": false } ] }"#,
        )
        .expect("databases json should deserialize");
        assert!(!parsed.databases[0].postgres_enabled);
    }

    #[test]
    fn encodes_api_key_password_safely() {
        // A Xata API key (`xau_...`) is alphanumeric+`_`; assert the safe set
        // passes through and a reserved char (`:`/`@`) would be escaped.
        assert_eq!(encode_userinfo("xau_apikey123456"), "xau_apikey123456");
        assert_eq!(encode_userinfo("a:b@c/d"), "a%3Ab%40c%2Fd");
    }

    #[test]
    fn builds_canonical_connection_string() {
        // Mirror the documented Xata shape:
        //   postgresql://{workspaceId}:{apiKey}@{region}.sql.xata.sh:5432/{db}:{branch}
        let user = encode_userinfo("ws1234");
        let password = encode_userinfo("xau_apikey123456");
        let db_and_branch = format!(
            "{}:{}",
            encode_path_segment("Games"),
            encode_path_segment(DEFAULT_BRANCH)
        );
        let url = format!(
            "postgresql://{user}:{password}@{}.{SQL_HOST_SUFFIX}:{SQL_PORT}/{db_and_branch}?sslmode=require",
            "us-east-1"
        );
        assert_eq!(
            url,
            "postgresql://ws1234:xau_apikey123456@us-east-1.sql.xata.sh:5432/Games:main?sslmode=require"
        );
    }
}
