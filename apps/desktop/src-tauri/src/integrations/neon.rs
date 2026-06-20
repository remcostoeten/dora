use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted Neon API key, encrypted on-device. Neon's API is token-based
// (Bearer), so this is the only credential we store.
const TOKEN_SETTING_KEY: &str = "integration.neon.access_token";
const API_BASE_URL: &str = "https://console.neon.tech/api/v2";
// Neon cursor-paginates `/projects`; request a full page and keep going until a
// short page comes back. Caps the loop so a misbehaving cursor can't spin.
const PROJECTS_PAGE_LIMIT: usize = 100;
const MAX_PROJECT_PAGES: usize = 1000;

// The Neon account the stored key belongs to (`/users/me`), so the UI can show
// which account is connected. Both fields are optional in case the API omits one.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NeonAccount {
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub name: String,
}

/// A selectable Neon database, flattened across projects and their default
/// branch. The ids/names are carried so we can mint a pooled connection URI for
/// it later without re-discovering anything.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NeonDatabase {
    pub project_id: String,
    pub project_name: String,
    pub branch_id: String,
    pub database_name: String,
    pub role_name: String,
}

/// A selectable Neon branch within a project. Surfaced so the user can connect
/// to a non-primary branch (e.g. a preview branch) instead of always landing on
/// the default one. `is_default` lets the UI preselect the primary branch.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct NeonBranch {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Deserialize)]
struct ProjectsResponse {
    projects: Vec<ProjectResponse>,
    #[serde(default)]
    pagination: Option<Pagination>,
}

#[derive(Debug, Deserialize)]
struct Pagination {
    #[serde(default)]
    cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectResponse {
    id: String,
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct BranchesResponse {
    branches: Vec<BranchResponse>,
}

#[derive(Debug, Deserialize)]
struct BranchResponse {
    id: String,
    // The human-readable branch name (e.g. `main`, `preview/pr-123`). Defaults
    // to empty if Neon ever omits it so decoding never fails on a sparse payload.
    #[serde(default)]
    name: String,
    // Neon flags the project's primary branch with `default`; older payloads
    // used `primary`, and current payloads carry BOTH keys. Read them as two
    // separate optional fields — a serde `alias` would route both keys into one
    // field and trip the duplicate-field check when both are present — then
    // treat either being true as "this is the branch to read".
    #[serde(default)]
    default: bool,
    #[serde(default)]
    primary: bool,
}

impl BranchResponse {
    fn is_default(&self) -> bool {
        self.default || self.primary
    }
}

#[derive(Debug, Deserialize)]
struct DatabasesResponse {
    databases: Vec<DatabaseResponse>,
}

#[derive(Debug, Deserialize)]
struct DatabaseResponse {
    name: String,
    // The role that owns the database — Neon needs this as `role_name` when
    // minting a connection URI.
    owner_name: String,
}

#[derive(Debug, Deserialize)]
struct ConnectionUriResponse {
    uri: String,
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to encrypt Neon token: {error}")))?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to decrypt Neon token: {error}")))?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Neon is not connected. Add a Neon API key first."
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

async fn get_projects(token: &str) -> Result<Vec<ProjectResponse>> {
    let client = reqwest::Client::new();
    let limit = PROJECTS_PAGE_LIMIT.to_string();
    let mut projects = Vec::new();
    let mut cursor: Option<String> = None;

    for _ in 0..MAX_PROJECT_PAGES {
        let mut request = client
            .get(format!("{API_BASE_URL}/projects"))
            .query(&[("limit", limit.as_str())])
            .bearer_auth(token);
        if let Some(cursor) = &cursor {
            request = request.query(&[("cursor", cursor.as_str())]);
        }

        let response = request.send().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Neon projects request failed: {error}"))
        })?;

        let status = response.status();
        let body = read_body(response).await;
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(Error::Any(anyhow::anyhow!(
                "Neon rejected this API key. Generate a new key and try again."
            )));
        }
        if !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!(
                "Neon projects request failed with HTTP {status}: {body}"
            )));
        }

        let parsed: ProjectsResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode Neon projects response: {error}"
            ))
        })?;

        let page_size = parsed.projects.len();
        let next_cursor = parsed.pagination.and_then(|pagination| pagination.cursor);
        projects.extend(parsed.projects);

        // A short page means we've reached the end. Otherwise advance the cursor
        // — but only if it actually moved, so a stuck cursor can't loop forever.
        if page_size < PROJECTS_PAGE_LIMIT {
            break;
        }
        match next_cursor {
            Some(next) if Some(&next) != cursor.as_ref() => cursor = Some(next),
            _ => break,
        }
    }

    Ok(projects)
}

/// The Neon account the stored key belongs to (`/users/me`), so the UI can show
/// which account is connected.
pub async fn current_account(storage: &Storage) -> Result<NeonAccount> {
    let token = require_token(storage)?;
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/users/me"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Neon account request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Neon rejected this API key. Generate a new key and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Neon account request failed with HTTP {status}: {body}"
        )));
    }

    serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Neon account response: {error}"
        ))
    })
}

/// Validates a pasted API key by listing projects, then persists it encrypted.
/// Validating up front means a bad paste fails immediately rather than on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("Neon API key is empty")));
    }
    get_projects(&token).await?;
    store_token(storage, &token)
}

/// Fetches every branch of a project. Shared by `get_default_branch` (which just
/// wants the primary) and `list_branches` (which surfaces all of them to the UI).
async fn get_branches(token: &str, project_id: &str) -> Result<Vec<BranchResponse>> {
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/projects/{project_id}/branches"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Neon branches request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Neon branches request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: BranchesResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Neon branches response: {error}"
        ))
    })?;
    Ok(parsed.branches)
}

async fn get_default_branch(token: &str, project_id: &str) -> Result<Option<String>> {
    let branches = get_branches(token, project_id).await?;
    // Prefer the primary branch; fall back to the first one a project has.
    let branch = branches
        .iter()
        .find(|branch| branch.is_default())
        .or_else(|| branches.first())
        .map(|branch| branch.id.clone());
    Ok(branch)
}

/// Lists every branch of a project so the user can connect to a non-primary one.
/// The primary branch is flagged via `is_default` so the UI can preselect it.
pub async fn list_branches(storage: &Storage, project_id: &str) -> Result<Vec<NeonBranch>> {
    let token = require_token(storage)?;
    let branches = get_branches(&token, project_id)
        .await?
        .into_iter()
        .map(|branch| NeonBranch {
            is_default: branch.is_default(),
            id: branch.id,
            name: branch.name,
        })
        .collect();
    Ok(branches)
}

async fn get_branch_databases(
    token: &str,
    project_id: &str,
    branch_id: &str,
) -> Result<Vec<DatabaseResponse>> {
    let response = reqwest::Client::new()
        .get(format!(
            "{API_BASE_URL}/projects/{project_id}/branches/{branch_id}/databases"
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Neon databases request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Neon databases request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: DatabasesResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Neon databases response: {error}"
        ))
    })?;
    Ok(parsed.databases)
}

/// Lists every database the key can see, across all projects' default branches.
pub async fn list_databases(storage: &Storage) -> Result<Vec<NeonDatabase>> {
    let token = require_token(storage)?;
    let mut databases = Vec::new();

    for project in get_projects(&token).await? {
        let Some(branch_id) = get_default_branch(&token, &project.id).await? else {
            continue;
        };
        for db in get_branch_databases(&token, &project.id, &branch_id).await? {
            databases.push(NeonDatabase {
                project_id: project.id.clone(),
                project_name: project.name.clone(),
                branch_id: branch_id.clone(),
                database_name: db.name,
                role_name: db.owner_name,
            });
        }
    }

    Ok(databases)
}

/// Mints a pooled connection URI (password embedded) for a database. This is the
/// credential Dora stores on the connection — the user never copies a secret.
pub async fn create_connection_uri(
    storage: &Storage,
    project_id: &str,
    branch_id: &str,
    database_name: &str,
    role_name: &str,
) -> Result<String> {
    let token = require_token(storage)?;
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/projects/{project_id}/connection_uri"))
        .query(&[
            ("branch_id", branch_id),
            ("database_name", database_name),
            ("role_name", role_name),
            ("pooled", "true"),
        ])
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| {
            Error::Any(anyhow::anyhow!("Neon connection URI request failed: {error}"))
        })?;

    let status = response.status();
    let body = read_body(response).await;
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Couldn't mint a Neon connection URI (HTTP {status}): {body}"
        )));
    }

    let parsed: ConnectionUriResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Neon connection URI response: {error}"
        ))
    })?;
    Ok(parsed.uri)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_projects() {
        let parsed: ProjectsResponse = serde_json::from_str(
            r#"{ "projects": [ { "id": "cool-darkness-123", "name": "my-app" } ] }"#,
        )
        .expect("projects json should deserialize");
        assert_eq!(parsed.projects.len(), 1);
        assert_eq!(parsed.projects[0].id, "cool-darkness-123");
        assert_eq!(parsed.projects[0].name, "my-app");
    }

    #[test]
    fn picks_default_branch_field() {
        let parsed: BranchesResponse = serde_json::from_str(
            r#"{ "branches": [
                { "id": "br-1", "default": false },
                { "id": "br-2", "default": true }
            ] }"#,
        )
        .expect("branches json should deserialize");
        let chosen = parsed.branches.iter().find(|b| b.is_default()).map(|b| &b.id);
        assert_eq!(chosen, Some(&"br-2".to_string()));
    }

    #[test]
    fn tolerates_primary_only_payload() {
        let parsed: BranchesResponse =
            serde_json::from_str(r#"{ "branches": [ { "id": "br-1", "primary": true } ] }"#)
                .expect("branches json should deserialize with primary only");
        assert!(parsed.branches[0].is_default());
    }

    #[test]
    fn tolerates_both_default_and_primary_keys() {
        // Current Neon payloads carry both keys; aliasing one onto the other
        // used to fail with a serde duplicate-field error.
        let parsed: BranchesResponse = serde_json::from_str(
            r#"{ "branches": [ { "id": "br-1", "default": true, "primary": true } ] }"#,
        )
        .expect("branches json should deserialize with both default and primary");
        assert!(parsed.branches[0].is_default());
    }

    #[test]
    fn decodes_branch_names_and_default_flag() {
        // What `list_branches` maps into NeonBranch: id + name + is_default. A
        // non-primary preview branch must surface its name and read as non-default.
        let parsed: BranchesResponse = serde_json::from_str(
            r#"{ "branches": [
                { "id": "br-main", "name": "main", "default": true },
                { "id": "br-prev", "name": "preview/pr-123", "primary": false }
            ] }"#,
        )
        .expect("named branches json should deserialize");
        let mapped: Vec<NeonBranch> = parsed
            .branches
            .into_iter()
            .map(|branch| NeonBranch {
                is_default: branch.is_default(),
                id: branch.id,
                name: branch.name,
            })
            .collect();
        assert_eq!(mapped.len(), 2);
        assert_eq!(mapped[0].name, "main");
        assert!(mapped[0].is_default);
        assert_eq!(mapped[1].name, "preview/pr-123");
        assert!(!mapped[1].is_default);
    }

    #[test]
    fn tolerates_branch_missing_name() {
        // A sparse payload (no `name`) must still decode — name falls back to "".
        let parsed: BranchesResponse =
            serde_json::from_str(r#"{ "branches": [ { "id": "br-1", "default": true } ] }"#)
                .expect("branches json should deserialize without a name");
        assert_eq!(parsed.branches[0].name, "");
    }

    #[test]
    fn decodes_database_owner_as_role() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [ { "name": "neondb", "owner_name": "neondb_owner" } ] }"#,
        )
        .expect("databases json should deserialize");
        assert_eq!(parsed.databases[0].name, "neondb");
        assert_eq!(parsed.databases[0].owner_name, "neondb_owner");
    }

    #[test]
    fn decodes_projects_with_pagination_cursor() {
        let parsed: ProjectsResponse = serde_json::from_str(
            r#"{ "projects": [ { "id": "p1", "name": "one" } ], "pagination": { "cursor": "next-cursor" } }"#,
        )
        .expect("paginated projects json should deserialize");
        assert_eq!(parsed.projects.len(), 1);
        assert_eq!(
            parsed.pagination.and_then(|pagination| pagination.cursor),
            Some("next-cursor".to_string())
        );
    }

    #[test]
    fn decodes_account_fields() {
        let account: NeonAccount = serde_json::from_str(
            r#"{ "id": "u-1", "email": "dev@example.com", "name": "Dev", "image": "x" }"#,
        )
        .expect("account json should deserialize and ignore extra fields");
        assert_eq!(account.email, "dev@example.com");
        assert_eq!(account.name, "Dev");
    }

    #[test]
    fn tolerates_account_missing_name() {
        let account: NeonAccount = serde_json::from_str(r#"{ "email": "dev@example.com" }"#)
            .expect("account json should deserialize with only email");
        assert_eq!(account.email, "dev@example.com");
        assert_eq!(account.name, "");
    }

    #[test]
    fn decodes_connection_uri() {
        let parsed: ConnectionUriResponse = serde_json::from_str(
            r#"{ "uri": "postgresql://neondb_owner:pass@ep-x-pooler.neon.tech/neondb?sslmode=require" }"#,
        )
        .expect("uri json");
        assert!(parsed.uri.contains("pooler"));
    }
}
