use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

const TOKEN_SETTING_KEY: &str = "integration.supabase.access_token";
const API_BASE_URL: &str = "https://api.supabase.com/v1";

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

pub fn is_connected(storage: &Storage) -> bool {
    load_pat(storage).ok().flatten().is_some()
}

pub fn disconnect(storage: &Storage) -> Result<()> {
    storage.delete_setting(TOKEN_SETTING_KEY)
}

/// GETs `/projects` with the given personal access token. Centralizes auth-error
/// mapping so both validation (on connect) and listing report a 401 identically.
async fn fetch_projects(token: &str) -> Result<reqwest::Response> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{API_BASE_URL}/projects"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Supabase request failed: {error}")))?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase rejected this access token. Generate a new one at supabase.com/dashboard/account/tokens and try again."
        )));
    }
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(Error::Any(anyhow::anyhow!(
            "Supabase projects request failed with HTTP {status}: {body}"
        )));
    }
    Ok(response)
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
    fetch_projects(&token).await?;
    store_pat(storage, &token)
}

pub async fn list_projects(storage: &Storage) -> Result<Vec<SupabaseProject>> {
    let token = load_pat(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Supabase is not connected. Add a Supabase access token first."
        ))
    })?;

    let response = fetch_projects(&token).await?;
    let projects: Vec<SupabaseProjectResponse> = response.json().await.map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Supabase project response: {error}"
        ))
    })?;
    Ok(projects.into_iter().map(Into::into).collect())
}

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
