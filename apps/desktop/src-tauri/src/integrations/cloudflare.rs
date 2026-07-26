//! Cloudflare D1 connect-flow backend.
//!
//! Mirrors `neon.rs`/`vercel.rs`: a manually-pasted Cloudflare API token,
//! encrypted on-device, used to discover the user's accounts and their D1
//! databases over the Cloudflare REST API. D1 is account-scoped, so the
//! connect-flow has two pick steps (account → database); this module exposes
//! `list_accounts` and `list_databases(account_id)` accordingly.
//!
//! The query transport (running SQL against a chosen D1 database) lives in
//! `crate::database::d1` — this module only handles the connect flow.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

const TOKEN_SETTING_KEY: &str = "integration.cloudflare.access_token";
const API_BASE_URL: &str = "https://api.cloudflare.com/client/v4";
// Cloudflare page-paginates list endpoints via `?page=&per_page=`. Request a
// full page and keep going until a short page comes back; cap the loop so a
// misbehaving API can't spin.
const PAGE_SIZE: usize = 50;
const MAX_PAGES: usize = 1000;

/// A Cloudflare account the token can see — used for the "Connected as …" label
/// and as the first pick step (D1 databases are account-scoped).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareAccount {
    pub id: String,
    #[serde(default)]
    pub name: String,
}

/// A selectable D1 database within an account. `uuid` is the database id used in
/// the query endpoint path; the connect-flow encodes it into the connection URL.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareD1Database {
    pub account_id: String,
    pub uuid: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct ApiEnvelope<T> {
    #[serde(default)]
    success: bool,
    #[serde(default)]
    errors: Vec<ApiError>,
    #[serde(default = "Vec::new")]
    result: Vec<T>,
    #[serde(default)]
    result_info: Option<ResultInfo>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    #[serde(default)]
    code: Option<i64>,
    #[serde(default)]
    message: String,
}

#[derive(Debug, Deserialize)]
struct ResultInfo {
    #[serde(default)]
    page: Option<u64>,
    #[serde(default)]
    total_pages: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct AccountResult {
    id: String,
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct D1DatabaseResult {
    uuid: String,
    #[serde(default)]
    name: String,
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to encrypt Cloudflare token: {error}"))
    })?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decrypt Cloudflare token: {error}"))
    })?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Cloudflare is not connected. Add a Cloudflare API token first."
        ))
    })
}

pub fn is_connected(storage: &Storage) -> bool {
    load_token(storage).ok().flatten().is_some()
}

/// The stored Cloudflare API token, for the D1 query transport to authenticate
/// at connect time. Errors if no token has been saved (the user disconnected or
/// never connected Cloudflare).
pub fn connect_token(storage: &Storage) -> Result<String> {
    require_token(storage)
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

/// Joins a Cloudflare envelope's `errors[]` into a readable message, mapping the
/// missing-D1-scope error code to a scope-specific hint (mirrors Supabase's
/// "lacks Database scope" message).
fn envelope_error<T>(envelope: &ApiEnvelope<T>) -> String {
    if envelope.errors.is_empty() {
        return "Cloudflare request failed (no error detail returned).".to_string();
    }
    // 9109 = "Unauthorized to access requested resource" — usually a token
    // missing the D1 permission.
    if envelope.errors.iter().any(|error| error.code == Some(9109)) {
        return "This Cloudflare API token can't access D1. Create a token with the \
                'D1 - Edit' (or read) permission for this account."
            .to_string();
    }
    envelope
        .errors
        .iter()
        .map(|error| match error.code {
            Some(code) => format!("{} (code {code})", error.message),
            None => error.message.clone(),
        })
        .collect::<Vec<_>>()
        .join("; ")
}

/// GETs a paginated Cloudflare list endpoint, following `result_info` pages.
async fn get_paginated<T>(token: &str, path: &str, context: &str) -> Result<Vec<T>>
where
    T: for<'de> Deserialize<'de>,
{
    let client = crate::http::client();
    let per_page = PAGE_SIZE.to_string();
    let mut all = Vec::new();
    let mut page: u64 = 1;

    for _ in 0..MAX_PAGES {
        let page_str = page.to_string();
        let response = client
            .get(format!("{API_BASE_URL}{path}"))
            .query(&[("page", page_str.as_str()), ("per_page", per_page.as_str())])
            .bearer_auth(token)
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!("Cloudflare {context} request failed: {error}"))
            })?;

        let status = response.status();
        let body = read_body(response).await;
        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(Error::Any(anyhow::anyhow!(
                "Cloudflare rejected this API token. Generate a token with D1 access \
                 and try again."
            )));
        }

        let envelope: ApiEnvelope<T> = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode Cloudflare {context} response: {error}"
            ))
        })?;

        if !envelope.success || !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!("{}", envelope_error(&envelope))));
        }

        let total_pages = envelope
            .result_info
            .as_ref()
            .and_then(|info| info.total_pages);
        let current_page = envelope
            .result_info
            .as_ref()
            .and_then(|info| info.page)
            .unwrap_or(page);

        all.extend(envelope.result);

        match total_pages {
            Some(total) if current_page < total => page = current_page + 1,
            _ => break,
        }
    }

    Ok(all)
}

/// Lists the Cloudflare accounts the token can see.
pub async fn list_accounts(storage: &Storage) -> Result<Vec<CloudflareAccount>> {
    let token = require_token(storage)?;
    let accounts: Vec<AccountResult> = get_paginated(&token, "/accounts", "accounts").await?;
    Ok(accounts
        .into_iter()
        .map(|account| CloudflareAccount {
            id: account.id,
            name: account.name,
        })
        .collect())
}

/// Lists the D1 databases in one account.
pub async fn list_databases(
    storage: &Storage,
    account_id: &str,
) -> Result<Vec<CloudflareD1Database>> {
    let token = require_token(storage)?;
    let path = format!("/accounts/{account_id}/d1/database");
    let databases: Vec<D1DatabaseResult> = get_paginated(&token, &path, "D1 databases").await?;
    Ok(databases
        .into_iter()
        .map(|database| CloudflareD1Database {
            account_id: account_id.to_string(),
            uuid: database.uuid,
            name: database.name,
        })
        .collect())
}

/// The accounts the stored token belongs to, so the UI can show "Connected as
/// …". The first account name is the natural label.
pub async fn current_account(storage: &Storage) -> Result<Vec<CloudflareAccount>> {
    list_accounts(storage).await
}

/// Validates a pasted API token by listing accounts, then persists it encrypted.
/// Validating up front means a bad paste fails immediately rather than on first
/// use. (Listing accounts also exercises the token's account read scope, which
/// D1 access requires.)
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("Cloudflare API token is empty")));
    }
    let accounts: Vec<AccountResult> = get_paginated(&token, "/accounts", "accounts").await?;
    if accounts.is_empty() {
        return Err(Error::Any(anyhow::anyhow!(
            "This Cloudflare token has no accessible accounts. Check the token's \
             account scope."
        )));
    }
    store_token(storage, &token)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_accounts_envelope() {
        let envelope: ApiEnvelope<AccountResult> = serde_json::from_str(
            r#"{ "success": true, "errors": [], "messages": [],
                 "result": [ { "id": "acc-1", "name": "My Account" } ],
                 "result_info": { "page": 1, "per_page": 50, "total_pages": 1, "count": 1 } }"#,
        )
        .expect("accounts envelope should deserialize");
        assert!(envelope.success);
        assert_eq!(envelope.result.len(), 1);
        assert_eq!(envelope.result[0].id, "acc-1");
        assert_eq!(envelope.result[0].name, "My Account");
        assert_eq!(
            envelope.result_info.and_then(|info| info.total_pages),
            Some(1)
        );
    }

    #[test]
    fn decodes_d1_database_list() {
        let envelope: ApiEnvelope<D1DatabaseResult> = serde_json::from_str(
            r#"{ "success": true, "errors": [],
                 "result": [
                   { "uuid": "db-abc", "name": "prod", "version": "production", "created_at": "x" },
                   { "uuid": "db-def", "name": "staging" }
                 ] }"#,
        )
        .expect("d1 database list should deserialize");
        assert_eq!(envelope.result.len(), 2);
        assert_eq!(envelope.result[0].uuid, "db-abc");
        assert_eq!(envelope.result[0].name, "prod");
        assert_eq!(envelope.result[1].uuid, "db-def");
    }

    #[test]
    fn maps_missing_d1_scope_error() {
        let envelope: ApiEnvelope<AccountResult> = serde_json::from_str(
            r#"{ "success": false,
                 "errors": [ { "code": 9109, "message": "Unauthorized to access requested resource" } ],
                 "result": [] }"#,
        )
        .expect("error envelope should deserialize");
        assert!(!envelope.success);
        let message = envelope_error(&envelope);
        assert!(message.contains("D1"), "expected D1 scope hint, got: {message}");
    }

    #[test]
    fn joins_generic_errors_readably() {
        let envelope: ApiEnvelope<AccountResult> = serde_json::from_str(
            r#"{ "success": false,
                 "errors": [ { "code": 1000, "message": "Invalid request" } ],
                 "result": [] }"#,
        )
        .expect("error envelope should deserialize");
        let message = envelope_error(&envelope);
        assert!(message.contains("Invalid request"));
        assert!(message.contains("1000"));
    }

    #[test]
    fn tolerates_missing_result_info() {
        // D1 list responses may omit result_info; pagination then stops after the
        // first page.
        let envelope: ApiEnvelope<D1DatabaseResult> =
            serde_json::from_str(r#"{ "success": true, "result": [ { "uuid": "x", "name": "x" } ] }"#)
                .expect("envelope without result_info should deserialize");
        assert!(envelope.result_info.is_none());
        assert_eq!(envelope.result.len(), 1);
    }
}
