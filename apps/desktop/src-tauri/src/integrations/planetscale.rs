use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted PlanetScale service token, encrypted on-device. PlanetScale's
// API authenticates with a service token of the form `<token-id>:<token>`, sent
// verbatim in the `Authorization` header (NOT a Bearer token). We store the whole
// `<id>:<token>` string so it can be replayed on every request.
const TOKEN_SETTING_KEY: &str = "integration.planetscale.access_token";
const API_BASE_URL: &str = "https://api.planetscale.com/v1";
// PlanetScale paginates list endpoints with `?page=N&per_page=M` and reports the
// next page via `next_page`. Request a full page and keep going until there's no
// next page. Caps the loop so a misbehaving cursor can't spin.
const PAGE_SIZE: usize = 100;
const MAX_PAGES: usize = 1000;

// The role a minted password is granted. `admin` is the broadest — it can read
// and write schema + data, which is what a GUI needs. Other valid roles are
// `reader`, `writer`, and `readwriter`.
const PASSWORD_ROLE: &str = "admin";

/// The PlanetScale organization the stored token belongs to, shown in the UI so
/// the user can confirm which account is connected.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlanetscaleOrganization {
    pub name: String,
}

/// A selectable PlanetScale database. `default_branch` is carried so the
/// connect-flow can preselect the primary branch without re-discovering it.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlanetscaleDatabase {
    pub name: String,
    pub default_branch: String,
}

/// A branch of a PlanetScale database. `is_default` marks the database's default
/// branch (the one to preselect). This is the branch-aware hook other plans
/// (05-branch-aware-connects) build on.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlanetscaleBranch {
    pub name: String,
    pub production: bool,
    pub is_default: bool,
}

/// A freshly minted MySQL credential for a branch. PlanetScale only returns the
/// plaintext password once (at creation), so the connect-flow uses this
/// immediately to assemble a connection string — the user never copies a secret.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct PlanetscalePassword {
    pub username: String,
    pub host: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
struct OrganizationsResponse {
    data: Vec<OrganizationItem>,
    #[serde(default)]
    next_page: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct OrganizationItem {
    name: String,
}

#[derive(Debug, Deserialize)]
struct DatabasesResponse {
    data: Vec<DatabaseItem>,
    #[serde(default)]
    next_page: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct DatabaseItem {
    name: String,
    // The default branch PlanetScale created for the database (usually `main`).
    // Defaults to empty when absent so a sparse payload still decodes.
    #[serde(default)]
    default_branch: String,
}

#[derive(Debug, Deserialize)]
struct BranchesResponse {
    data: Vec<BranchItem>,
    #[serde(default)]
    next_page: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct BranchItem {
    name: String,
    #[serde(default)]
    production: bool,
    // The branch this one was forked from. The database's default branch has no
    // parent, so `parent_branch: null` is a secondary signal for "default".
    #[serde(default)]
    parent_branch: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PasswordResponse {
    username: String,
    // The hostname to connect through, e.g.
    // `aws.connect.psdb.cloud`. PlanetScale also returns regional variants we
    // don't need.
    access_host_url: String,
    // The plaintext password, present ONLY in the create-password response. A
    // later GET on the same password omits it.
    #[serde(default)]
    plain_text: String,
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to encrypt PlanetScale token: {error}"
        ))
    })?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decrypt PlanetScale token: {error}"
        ))
    })?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "PlanetScale is not connected. Add a service token first."
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

/// Whether a `next_page` field (number or string, null on the last page) marks
/// there being another page to fetch.
fn has_next_page(next_page: &Option<serde_json::Value>) -> bool {
    match next_page {
        Some(serde_json::Value::Number(_)) => true,
        Some(serde_json::Value::String(text)) => !text.is_empty(),
        _ => false,
    }
}

/// A GET against the PlanetScale API with the service token attached as a raw
/// `Authorization: <id>:<token>` header (PlanetScale does not use Bearer auth).
/// Maps 401/403 to a scope/credential-specific error and any other non-2xx to an
/// error carrying the response body.
async fn authed_get(token: &str, url: &str, query: &[(&str, &str)], what: &str) -> Result<String> {
    let response = reqwest::Client::new()
        .get(url)
        .header(reqwest::header::AUTHORIZATION, token)
        .query(query)
        .send()
        .await
        .map_err(|error| {
            Error::Any(anyhow::anyhow!("PlanetScale {what} request failed: {error}"))
        })?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale rejected this service token. Check the token id and value, then try again."
        )));
    }
    if status == reqwest::StatusCode::FORBIDDEN {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale denied this request (HTTP 403). The service token is missing a required scope (read_databases, read_branch, connect_production_branches, create_password). Grant it in the PlanetScale dashboard and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale {what} request failed with HTTP {status}: {body}"
        )));
    }
    Ok(body)
}

/// The organizations the stored token can access, so the UI can show which
/// account is currently connected. Paginates defensively.
pub async fn current_account(storage: &Storage) -> Result<Vec<PlanetscaleOrganization>> {
    let token = require_token(storage)?;
    let per_page = PAGE_SIZE.to_string();
    let mut organizations = Vec::new();
    let mut page = 1usize;

    for _ in 0..MAX_PAGES {
        let page_str = page.to_string();
        let body = authed_get(
            &token,
            &format!("{API_BASE_URL}/organizations"),
            &[("page", page_str.as_str()), ("per_page", per_page.as_str())],
            "organizations",
        )
        .await?;

        let parsed: OrganizationsResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode PlanetScale organizations response: {error}"
            ))
        })?;

        let more = has_next_page(&parsed.next_page);
        organizations.extend(
            parsed
                .data
                .into_iter()
                .map(|item| PlanetscaleOrganization { name: item.name }),
        );
        if !more {
            break;
        }
        page += 1;
    }

    Ok(organizations)
}

/// Validates a pasted service token by listing organizations, then persists it
/// encrypted. Validating up front means a bad paste fails immediately rather
/// than on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale service token is empty"
        )));
    }
    // A PlanetScale service token is `<token-id>:<token>`. Catch an obviously
    // malformed paste before hitting the API so the error is actionable.
    if !token.contains(':') {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale service tokens look like `<token-id>:<token>`. Paste the id and value joined by a colon."
        )));
    }
    // Authenticated probe — fails fast on a bad/under-scoped token.
    let _ = authed_get(
        &token,
        &format!("{API_BASE_URL}/organizations"),
        &[("per_page", "1")],
        "organizations",
    )
    .await?;
    store_token(storage, &token)
}

/// Lists the databases in an organization. Paginates defensively.
pub async fn list_databases(
    storage: &Storage,
    organization: &str,
) -> Result<Vec<PlanetscaleDatabase>> {
    let token = require_token(storage)?;
    let per_page = PAGE_SIZE.to_string();
    let mut databases = Vec::new();
    let mut page = 1usize;

    for _ in 0..MAX_PAGES {
        let page_str = page.to_string();
        let body = authed_get(
            &token,
            &format!("{API_BASE_URL}/organizations/{organization}/databases"),
            &[("page", page_str.as_str()), ("per_page", per_page.as_str())],
            "databases",
        )
        .await?;

        let parsed: DatabasesResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode PlanetScale databases response: {error}"
            ))
        })?;

        let more = has_next_page(&parsed.next_page);
        databases.extend(parsed.data.into_iter().map(|item| PlanetscaleDatabase {
            name: item.name,
            default_branch: item.default_branch,
        }));
        if !more {
            break;
        }
        page += 1;
    }

    Ok(databases)
}

/// Lists the branches of a database, flagging the default branch so the
/// connect-flow can preselect it. The default is the branch whose name matches
/// the database's `default_branch`; a branch with no parent is a fallback signal.
pub async fn list_branches(
    storage: &Storage,
    organization: &str,
    database: &str,
    default_branch: &str,
) -> Result<Vec<PlanetscaleBranch>> {
    let token = require_token(storage)?;
    let per_page = PAGE_SIZE.to_string();
    let mut branches = Vec::new();
    let mut page = 1usize;

    for _ in 0..MAX_PAGES {
        let page_str = page.to_string();
        let body = authed_get(
            &token,
            &format!("{API_BASE_URL}/organizations/{organization}/databases/{database}/branches"),
            &[("page", page_str.as_str()), ("per_page", per_page.as_str())],
            "branches",
        )
        .await?;

        let parsed: BranchesResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode PlanetScale branches response: {error}"
            ))
        })?;

        let more = has_next_page(&parsed.next_page);
        branches.extend(parsed.data.into_iter().map(|item| {
            let is_default = (!default_branch.is_empty() && item.name == default_branch)
                || item.parent_branch.is_none();
            PlanetscaleBranch {
                name: item.name,
                production: item.production,
                is_default,
            }
        }));
        if !more {
            break;
        }
        page += 1;
    }

    Ok(branches)
}

/// Mints a fresh MySQL password on a branch and returns the credential needed to
/// build a connection string. PlanetScale returns the plaintext password only
/// here — so the connect-flow assembles the connection immediately. Passwords are
/// named `dora-<unix-ts>` so the user can recognise and prune them in the
/// PlanetScale dashboard.
pub async fn create_password(
    storage: &Storage,
    organization: &str,
    database: &str,
    branch: &str,
) -> Result<PlanetscalePassword> {
    let token = require_token(storage)?;
    let name = format!(
        "dora-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs())
            .unwrap_or(0)
    );

    let response = reqwest::Client::new()
        .post(format!(
            "{API_BASE_URL}/organizations/{organization}/databases/{database}/branches/{branch}/passwords"
        ))
        .header(reqwest::header::AUTHORIZATION, &token)
        .json(&serde_json::json!({ "name": name, "role": PASSWORD_ROLE }))
        .send()
        .await
        .map_err(|error| {
            Error::Any(anyhow::anyhow!("PlanetScale password request failed: {error}"))
        })?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale rejected this service token. Check the token id and value, then try again."
        )));
    }
    if status == reqwest::StatusCode::FORBIDDEN {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale denied minting a password (HTTP 403). The service token needs the `create_password` (and `connect_production_branches` for production branches) scope. Grant it in the PlanetScale dashboard and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Couldn't mint a PlanetScale password (HTTP {status}): {body}"
        )));
    }

    let parsed: PasswordResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode PlanetScale password response: {error}"
        ))
    })?;

    if parsed.plain_text.trim().is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "PlanetScale returned a password without a plaintext value — it can't be used to connect."
        )));
    }

    Ok(PlanetscalePassword {
        username: parsed.username,
        host: parsed.access_host_url,
        password: parsed.plain_text,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_organizations() {
        let parsed: OrganizationsResponse = serde_json::from_str(
            r#"{ "type": "list", "data": [ { "id": "org1", "name": "acme" } ], "next_page": null }"#,
        )
        .expect("organizations json should deserialize");
        assert_eq!(parsed.data.len(), 1);
        assert_eq!(parsed.data[0].name, "acme");
        assert!(!has_next_page(&parsed.next_page));
    }

    #[test]
    fn detects_next_page_number() {
        let parsed: OrganizationsResponse = serde_json::from_str(
            r#"{ "data": [ { "name": "acme" } ], "next_page": 2 }"#,
        )
        .expect("organizations json should deserialize");
        assert!(has_next_page(&parsed.next_page));
    }

    #[test]
    fn decodes_databases_with_default_branch() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "data": [ { "id": "db1", "name": "shop", "default_branch": "main", "kind": "mysql" } ] }"#,
        )
        .expect("databases json should deserialize");
        assert_eq!(parsed.data[0].name, "shop");
        assert_eq!(parsed.data[0].default_branch, "main");
    }

    #[test]
    fn tolerates_database_missing_default_branch() {
        let parsed: DatabasesResponse =
            serde_json::from_str(r#"{ "data": [ { "name": "shop" } ] }"#)
                .expect("databases json should deserialize without default_branch");
        assert_eq!(parsed.data[0].default_branch, "");
    }

    #[test]
    fn marks_default_branch_by_name() {
        let parsed: BranchesResponse = serde_json::from_str(
            r#"{ "data": [
                { "name": "main", "production": true, "parent_branch": null },
                { "name": "dev", "production": false, "parent_branch": "main" }
            ] }"#,
        )
        .expect("branches json should deserialize");
        let default_branch = "main";
        let resolved: Vec<(String, bool)> = parsed
            .data
            .into_iter()
            .map(|item| {
                let is_default = (!default_branch.is_empty() && item.name == default_branch)
                    || item.parent_branch.is_none();
                (item.name, is_default)
            })
            .collect();
        assert_eq!(resolved[0], ("main".to_string(), true));
        assert_eq!(resolved[1], ("dev".to_string(), false));
    }

    #[test]
    fn falls_back_to_parentless_branch_as_default() {
        // When we don't know the database's default branch name, a branch with a
        // null parent is treated as the default.
        let parsed: BranchesResponse = serde_json::from_str(
            r#"{ "data": [ { "name": "trunk", "production": true, "parent_branch": null } ] }"#,
        )
        .expect("branches json should deserialize");
        let default_branch = "";
        let item = &parsed.data[0];
        let is_default = (!default_branch.is_empty() && item.name == default_branch)
            || item.parent_branch.is_none();
        assert!(is_default);
    }

    #[test]
    fn decodes_password_with_plaintext() {
        let parsed: PasswordResponse = serde_json::from_str(
            r#"{
                "id": "pw1",
                "name": "dora-123",
                "role": "admin",
                "username": "abc123",
                "access_host_url": "aws.connect.psdb.cloud",
                "plain_text": "pscale_pw_secret",
                "region": { "slug": "us-east" }
            }"#,
        )
        .expect("password json should deserialize and ignore extra fields");
        assert_eq!(parsed.username, "abc123");
        assert_eq!(parsed.access_host_url, "aws.connect.psdb.cloud");
        assert_eq!(parsed.plain_text, "pscale_pw_secret");
    }

    #[test]
    fn password_without_plaintext_decodes_empty() {
        // A GET on an existing password omits `plain_text`; decoding must still
        // succeed (the create path separately rejects an empty value).
        let parsed: PasswordResponse = serde_json::from_str(
            r#"{ "username": "abc123", "access_host_url": "aws.connect.psdb.cloud" }"#,
        )
        .expect("password json should deserialize without plain_text");
        assert_eq!(parsed.plain_text, "");
    }
}
