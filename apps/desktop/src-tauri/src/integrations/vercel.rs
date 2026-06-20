use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted Vercel access token, encrypted on-device. Vercel's API is
// token-based (Bearer), so this is the only credential we store.
const TOKEN_SETTING_KEY: &str = "integration.vercel.access_token";
const API_BASE_URL: &str = "https://api.vercel.com";
// Vercel continuation-paginates `/v10/projects` via the `from`/`next` token;
// request a full page and keep going until a short page comes back. Caps the
// loop so a misbehaving token can't spin.
const PROJECTS_PAGE_LIMIT: usize = 100;
const MAX_PROJECT_PAGES: usize = 1000;

// Env keys Vercel/Neon inject for a Postgres store, in the order we prefer them.
// Pooled URLs first (best for a GUI), then non-pooling fallbacks. The Prisma URL
// is last because it carries `?pgbouncer=true&connect_timeout=...` query params
// that some drivers dislike, but it's still a valid Postgres URI.
const POSTGRES_ENV_KEYS: [&str; 5] = [
    "POSTGRES_URL",
    "DATABASE_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_PRISMA_URL",
];

// The Vercel account the stored token belongs to (`/v2/user`), so the UI can
// show which account is connected. All fields are optional in case the API omits
// one (a "limited" token can return a reduced shape).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VercelAccount {
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub name: String,
}

/// A selectable Vercel Postgres "store" (one per project that has a Postgres
/// connection string in its environment). `connection_string` is `None` when the
/// value couldn't be read (e.g. the env var is marked `sensitive`), in which case
/// the connect-flow asks the user to paste the `POSTGRES_URL` instead.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct VercelStore {
    pub project_id: String,
    pub project_name: String,
    /// The env key the connection string came from (e.g. `POSTGRES_URL`), shown
    /// in the picker so the user knows which credential they're connecting with.
    #[serde(default)]
    pub env_key: Option<String>,
    /// The decrypted connection string, when the API returned a readable value.
    #[serde(default)]
    pub connection_string: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserResponse {
    user: UserData,
}

#[derive(Debug, Deserialize)]
struct UserData {
    #[serde(default)]
    username: String,
    #[serde(default)]
    email: String,
    // `name` is nullable in the API; this maps a JSON null to an empty string so
    // a missing name doesn't fail decoding.
    #[serde(default, deserialize_with = "null_to_empty")]
    name: String,
}

#[derive(Debug, Deserialize)]
struct ProjectsResponse {
    projects: Vec<ProjectResponse>,
    #[serde(default)]
    pagination: Option<Pagination>,
}

#[derive(Debug, Deserialize)]
struct Pagination {
    // Continuation token (a timestamp) for the next page, or null on the last
    // page. Vercel serializes it as a number; capture it loosely as a JSON value
    // so either a number or a string token decodes.
    #[serde(default)]
    next: Option<serde_json::Value>,
}

impl Pagination {
    fn next_token(&self) -> Option<String> {
        match self.next.as_ref() {
            Some(serde_json::Value::Number(number)) => Some(number.to_string()),
            Some(serde_json::Value::String(text)) if !text.is_empty() => Some(text.clone()),
            _ => None,
        }
    }
}

#[derive(Debug, Deserialize)]
struct ProjectResponse {
    id: String,
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct EnvResponse {
    #[serde(default)]
    envs: Vec<EnvVar>,
}

#[derive(Debug, Deserialize)]
struct EnvVar {
    #[serde(default)]
    key: String,
    // The decrypted value, present when `?decrypt=true` succeeds and the var
    // isn't `sensitive`. `sensitive` vars come back without a readable value.
    #[serde(default)]
    value: Option<String>,
    #[serde(rename = "type", default)]
    var_type: String,
}

/// Deserializes a JSON string-or-null into a `String`, mapping null to empty.
fn null_to_empty<'de, D>(deserializer: D) -> std::result::Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value: Option<String> = Option::deserialize(deserializer)?;
    Ok(value.unwrap_or_default())
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to encrypt Vercel token: {error}")))?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to decrypt Vercel token: {error}")))?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Vercel is not connected. Add a Vercel access token first."
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
    let mut from: Option<String> = None;

    for _ in 0..MAX_PROJECT_PAGES {
        let mut request = client
            .get(format!("{API_BASE_URL}/v10/projects"))
            .query(&[("limit", limit.as_str())])
            .bearer_auth(token);
        if let Some(from) = &from {
            request = request.query(&[("from", from.as_str())]);
        }

        let response = request.send().await.map_err(|error| {
            Error::Any(anyhow::anyhow!("Vercel projects request failed: {error}"))
        })?;

        let status = response.status();
        let body = read_body(response).await;
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(Error::Any(anyhow::anyhow!(
                "Vercel rejected this access token. Generate a new token and try again."
            )));
        }
        if !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!(
                "Vercel projects request failed with HTTP {status}: {body}"
            )));
        }

        let parsed: ProjectsResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode Vercel projects response: {error}"
            ))
        })?;

        let page_size = parsed.projects.len();
        let next_token = parsed.pagination.as_ref().and_then(Pagination::next_token);
        projects.extend(parsed.projects);

        // A short page means we've reached the end. Otherwise advance the
        // continuation token — but only if it actually moved, so a stuck token
        // can't loop forever.
        if page_size < PROJECTS_PAGE_LIMIT {
            break;
        }
        match next_token {
            Some(next) if Some(&next) != from.as_ref() => from = Some(next),
            _ => break,
        }
    }

    Ok(projects)
}

/// The Vercel account the stored token belongs to (`/v2/user`), so the UI can
/// show which account is connected.
pub async fn current_account(storage: &Storage) -> Result<VercelAccount> {
    let token = require_token(storage)?;
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/v2/user"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Vercel account request failed: {error}")))?;

    let status = response.status();
    let body = read_body(response).await;
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Vercel rejected this access token. Generate a new token and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Vercel account request failed with HTTP {status}: {body}"
        )));
    }

    let parsed: UserResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Vercel account response: {error}"
        ))
    })?;
    Ok(VercelAccount {
        username: parsed.user.username,
        email: parsed.user.email,
        name: parsed.user.name,
    })
}

/// Validates a pasted access token by listing projects, then persists it
/// encrypted. Validating up front means a bad paste fails immediately rather
/// than on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("Vercel access token is empty")));
    }
    get_projects(&token).await?;
    store_token(storage, &token)
}

/// Picks the best readable Postgres connection string from a project's env vars,
/// preferring pooled URLs. Returns `(env_key, connection_string)` when one is
/// readable. A `sensitive` var (or one without a value) is skipped — the
/// connect-flow falls back to a manual paste for that store.
fn pick_connection_string(envs: &[EnvVar]) -> Option<(String, String)> {
    for key in POSTGRES_ENV_KEYS {
        if let Some(env) = envs.iter().find(|env| env.key == key) {
            if env.var_type == "sensitive" {
                continue;
            }
            if let Some(value) = env.value.as_ref() {
                let trimmed = value.trim();
                if trimmed.starts_with("postgres://") || trimmed.starts_with("postgresql://") {
                    return Some((key.to_string(), trimmed.to_string()));
                }
            }
        }
    }
    None
}

/// Reads a project's decrypted environment variables and extracts a Postgres
/// connection string if one is present and readable. Errors on the project's env
/// fetch are swallowed (returns `None`) so one inaccessible project doesn't sink
/// the whole store list.
async fn project_connection_string(token: &str, project_id: &str) -> Option<(String, String)> {
    let response = reqwest::Client::new()
        .get(format!("{API_BASE_URL}/v10/projects/{project_id}/env"))
        .query(&[("decrypt", "true")])
        .bearer_auth(token)
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }
    let body = response.text().await.ok()?;
    let parsed: EnvResponse = serde_json::from_str(&body).ok()?;
    pick_connection_string(&parsed.envs)
}

/// Lists every project as a connectable store, attaching a Postgres connection
/// string when one is readable from the project's env vars. Stores without a
/// readable string still appear (the connect-flow asks the user to paste the
/// `POSTGRES_URL` for them), so identity + project names are always shown.
pub async fn list_stores(storage: &Storage) -> Result<Vec<VercelStore>> {
    let token = require_token(storage)?;
    let mut stores = Vec::new();

    for project in get_projects(&token).await? {
        let connection = project_connection_string(&token, &project.id).await;
        let (env_key, connection_string) = match connection {
            Some((key, value)) => (Some(key), Some(value)),
            None => (None, None),
        };
        stores.push(VercelStore {
            project_id: project.id,
            project_name: project.name,
            env_key,
            connection_string,
        });
    }

    Ok(stores)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_user_fields() {
        let parsed: UserResponse = serde_json::from_str(
            r#"{ "user": { "id": "u-1", "username": "ada", "email": "ada@example.com", "name": "Ada" } }"#,
        )
        .expect("user json should deserialize");
        assert_eq!(parsed.user.username, "ada");
        assert_eq!(parsed.user.email, "ada@example.com");
        assert_eq!(parsed.user.name, "Ada");
    }

    #[test]
    fn tolerates_user_null_name() {
        // The API marks `name` as nullable; a null must decode to an empty string.
        let parsed: UserResponse = serde_json::from_str(
            r#"{ "user": { "username": "ada", "email": "ada@example.com", "name": null } }"#,
        )
        .expect("user json should deserialize with null name");
        assert_eq!(parsed.user.name, "");
    }

    #[test]
    fn tolerates_limited_user_payload() {
        // A "limited" token returns a reduced shape (no full privileges); decoding
        // must still succeed and ignore the extra `limited` flag.
        let parsed: UserResponse = serde_json::from_str(
            r#"{ "user": { "id": "u-1", "limited": true, "username": "ada", "email": "ada@example.com", "name": null, "avatar": null, "defaultTeamId": null } }"#,
        )
        .expect("limited user json should deserialize");
        assert_eq!(parsed.user.username, "ada");
    }

    #[test]
    fn decodes_projects() {
        let parsed: ProjectsResponse = serde_json::from_str(
            r#"{ "projects": [ { "id": "prj_123", "name": "my-app" } ] }"#,
        )
        .expect("projects json should deserialize");
        assert_eq!(parsed.projects.len(), 1);
        assert_eq!(parsed.projects[0].id, "prj_123");
        assert_eq!(parsed.projects[0].name, "my-app");
    }

    #[test]
    fn decodes_projects_with_numeric_pagination_token() {
        // Vercel serializes the continuation token as a number; we stringify it
        // for the next request's `from` query param.
        let parsed: ProjectsResponse = serde_json::from_str(
            r#"{ "projects": [ { "id": "prj_1", "name": "one" } ], "pagination": { "count": 1, "next": 1717171717171 } }"#,
        )
        .expect("paginated projects json should deserialize");
        assert_eq!(
            parsed.pagination.and_then(|pagination| pagination.next_token()),
            Some("1717171717171".to_string())
        );
    }

    #[test]
    fn treats_null_pagination_next_as_end() {
        let parsed: ProjectsResponse = serde_json::from_str(
            r#"{ "projects": [], "pagination": { "count": 0, "next": null } }"#,
        )
        .expect("end-of-list projects json should deserialize");
        assert_eq!(
            parsed.pagination.and_then(|pagination| pagination.next_token()),
            None
        );
    }

    #[test]
    fn picks_pooled_postgres_url_first() {
        let envs = vec![
            EnvVar {
                key: "DATABASE_URL".into(),
                value: Some("postgres://u:p@ep-x.us-east-1.postgres.vercel-storage.com/verceldb".into()),
                var_type: "encrypted".into(),
            },
            EnvVar {
                key: "POSTGRES_URL".into(),
                value: Some(
                    "postgres://u:p@ep-x-pooler.us-east-1.postgres.vercel-storage.com:5432/verceldb?pgbouncer=true".into(),
                ),
                var_type: "encrypted".into(),
            },
        ];
        let chosen = pick_connection_string(&envs).expect("a connection string should be picked");
        assert_eq!(chosen.0, "POSTGRES_URL");
        assert!(chosen.1.contains("pooler"));
    }

    #[test]
    fn falls_back_to_database_url() {
        let envs = vec![EnvVar {
            key: "DATABASE_URL".into(),
            value: Some("postgresql://u:p@host.neon.tech/neondb?sslmode=require".into()),
            var_type: "plain".into(),
        }];
        let chosen = pick_connection_string(&envs).expect("a connection string should be picked");
        assert_eq!(chosen.0, "DATABASE_URL");
        assert!(chosen.1.starts_with("postgresql://"));
    }

    #[test]
    fn skips_sensitive_postgres_url() {
        // A `sensitive` env var is non-readable — its value (if any) must not be
        // surfaced, so the store falls back to a manual paste.
        let envs = vec![EnvVar {
            key: "POSTGRES_URL".into(),
            value: None,
            var_type: "sensitive".into(),
        }];
        assert!(pick_connection_string(&envs).is_none());
    }

    #[test]
    fn ignores_non_postgres_env_values() {
        let envs = vec![EnvVar {
            key: "POSTGRES_URL".into(),
            value: Some("not-a-connection-string".into()),
            var_type: "plain".into(),
        }];
        assert!(pick_connection_string(&envs).is_none());
    }

    #[test]
    fn decodes_env_response_and_extracts_string() {
        let parsed: EnvResponse = serde_json::from_str(
            r#"{ "envs": [
                { "key": "NEXT_PUBLIC_FOO", "value": "bar", "type": "plain" },
                { "key": "POSTGRES_URL", "value": "postgres://u:p@h/db", "type": "encrypted", "id": "env_1" }
            ] }"#,
        )
        .expect("env json should deserialize");
        let chosen = pick_connection_string(&parsed.envs).expect("postgres url should be found");
        assert_eq!(chosen.0, "POSTGRES_URL");
        assert_eq!(chosen.1, "postgres://u:p@h/db");
    }
}
