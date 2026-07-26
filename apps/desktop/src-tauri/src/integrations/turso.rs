use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{security, storage::Storage, Error, Result};

// Manually-pasted Turso Platform API token, encrypted on-device. Turso's API is
// token-based (no OAuth proxy), so this is the only credential we store.
const TOKEN_SETTING_KEY: &str = "integration.turso.access_token";
const API_BASE_URL: &str = "https://api.turso.tech/v1";

/// A Turso database, flattened across the organizations the token can see. The
/// `organization_slug` is carried so we can mint an auth token for it later.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TursoDatabase {
    pub name: String,
    pub hostname: String,
    pub organization_slug: String,
    pub group: String,
    pub primary_region: String,
}

// A Turso organization the stored token can access. Used to show the user which
// account/org they're connected as. Turso's `/organizations` returns at least a
// `name` and `slug` per org (a personal org's slug is the username).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TursoOrganization {
    pub slug: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct DatabasesResponse {
    databases: Vec<DatabaseResponse>,
}

// The Turso API returns database fields in PascalCase (`Name`, `Hostname`),
// with a few snake_case extras — alias both so we tolerate either.
#[derive(Debug, Deserialize)]
struct DatabaseResponse {
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Hostname")]
    hostname: String,
    #[serde(default, rename = "group")]
    group: String,
    #[serde(default, rename = "primaryRegion")]
    primary_region: String,
}

fn store_token(storage: &Storage, token: &str) -> Result<()> {
    let encrypted = security::encrypt(token)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to encrypt Turso token: {error}")))?;
    storage.set_setting(TOKEN_SETTING_KEY, &encrypted)
}

fn load_token(storage: &Storage) -> Result<Option<String>> {
    let Some(encrypted) = storage.get_setting(TOKEN_SETTING_KEY)? else {
        return Ok(None);
    };
    let decrypted = security::decrypt(&encrypted)
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to decrypt Turso token: {error}")))?;
    Ok(Some(decrypted))
}

fn require_token(storage: &Storage) -> Result<String> {
    load_token(storage)?.ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "Turso is not connected. Add a Turso API token first."
        ))
    })
}

pub fn is_connected(storage: &Storage) -> bool {
    load_token(storage).ok().flatten().is_some()
}

pub fn disconnect(storage: &Storage) -> Result<()> {
    storage.delete_setting(TOKEN_SETTING_KEY)
}

async fn fetch_organizations(token: &str) -> Result<Vec<TursoOrganization>> {
    let response = crate::http::client()
        .get(format!("{API_BASE_URL}/organizations"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| {
            Error::Any(anyhow::anyhow!("Turso organizations request failed: {error}"))
        })?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(Error::Any(anyhow::anyhow!(
            "Turso rejected this API token. Generate a new token and try again."
        )));
    }
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Turso organizations request failed with HTTP {status}: {body}"
        )));
    }

    serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Turso organizations response: {error}"
        ))
    })
}

async fn get_organizations(token: &str) -> Result<Vec<String>> {
    Ok(fetch_organizations(token)
        .await?
        .into_iter()
        .map(|org| org.slug)
        .collect())
}

/// The organizations the stored token can access, so the UI can show which
/// account is connected. Errors if no token is stored or the token is rejected.
pub async fn current_account(storage: &Storage) -> Result<Vec<TursoOrganization>> {
    let token = require_token(storage)?;
    fetch_organizations(&token).await
}

/// Validates a pasted Platform API token by listing organizations, then
/// persists it encrypted. Validating up front means a bad paste fails
/// immediately rather than on first use.
pub async fn save_token(storage: &Storage, token: String) -> Result<()> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err(Error::Any(anyhow::anyhow!("Turso API token is empty")));
    }
    get_organizations(&token).await?;
    store_token(storage, &token)
}

/// Lists every database the token can see, across all of its organizations.
pub async fn list_databases(storage: &Storage) -> Result<Vec<TursoDatabase>> {
    let token = require_token(storage)?;
    let client = crate::http::client();
    let mut databases = Vec::new();

    for slug in get_organizations(&token).await? {
        let response = client
            .get(format!("{API_BASE_URL}/organizations/{slug}/databases"))
            .bearer_auth(&token)
            .send()
            .await
            .map_err(|error| {
                Error::Any(anyhow::anyhow!("Turso databases request failed: {error}"))
            })?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(Error::Any(anyhow::anyhow!(
                "Turso databases request failed with HTTP {status}: {body}"
            )));
        }

        let parsed: DatabasesResponse = serde_json::from_str(&body).map_err(|error| {
            Error::Any(anyhow::anyhow!(
                "Failed to decode Turso databases response: {error}"
            ))
        })?;
        databases.extend(parsed.databases.into_iter().map(|db| TursoDatabase {
            name: db.name,
            hostname: db.hostname,
            organization_slug: slug.clone(),
            group: db.group,
            primary_region: db.primary_region,
        }));
    }

    Ok(databases)
}

#[derive(Debug, Deserialize)]
struct CreateTokenResponse {
    jwt: String,
}

/// Mints a full-access database auth token (JWT) for a database. This is the
/// credential Dora stores on the connection — the user never copies a secret.
pub async fn create_token(
    storage: &Storage,
    organization_slug: &str,
    database_name: &str,
) -> Result<String> {
    let token = require_token(storage)?;
    let response = crate::http::client()
        .post(format!(
            "{API_BASE_URL}/organizations/{organization_slug}/databases/{database_name}/auth/tokens"
        ))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Turso token request failed: {error}")))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Couldn't mint a Turso database token (HTTP {status}): {body}"
        )));
    }

    let parsed: CreateTokenResponse = serde_json::from_str(&body).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to decode Turso token response: {error}"
        ))
    })?;
    Ok(parsed.jwt)
}

// ---------------------------------------------------------------------------
// Turso CLI integration
//
// The Turso dashboard no longer hosts an API-token page, so the official way to
// get a Platform API token is the CLI (`turso auth api-tokens mint`). When the
// CLI is installed we drive it directly so the user never leaves the app: mint
// a token, and if the CLI reports the user isn't logged in, run
// `turso auth login` (opens a browser) and retry once. The minted token then
// goes through the same validate-and-store path as a hand-pasted one.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CLI binary resolution
//
// The Turso installer places the binary at ~/.turso/bin/turso, which is NOT
// on the app process's PATH right after a fresh install. We try PATH first
// (covers existing installs / shell config that already exports it), then fall
// back to the well-known default location so newly-installed binaries are found
// without requiring the user to restart Dora.
// ---------------------------------------------------------------------------

/// Runs `<bin> --version` and reports whether it executed successfully. Used to
/// confirm a candidate path is a working Turso binary, not just a stale file.
fn turso_runs(bin: &std::path::Path) -> bool {
    std::process::Command::new(bin)
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Absolute locations a Turso binary commonly lands in, across install methods
/// (official script, Homebrew, pacman/AUR, cargo, manual). A GUI app usually
/// doesn't inherit the shell PATH, so an install the user runs fine in their
/// terminal is invisible to a plain PATH lookup — we probe these directly.
#[cfg(not(target_os = "windows"))]
fn well_known_turso_paths() -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = std::path::Path::new(&home);
        paths.push(home.join(".turso/bin/turso"));
        paths.push(home.join(".local/bin/turso"));
        paths.push(home.join(".cargo/bin/turso"));
        paths.push(home.join("bin/turso"));
    }
    for fixed in [
        "/opt/homebrew/bin/turso",
        "/usr/local/bin/turso",
        "/usr/bin/turso",
        "/bin/turso",
    ] {
        paths.push(std::path::PathBuf::from(fixed));
    }
    paths
}

/// Last-resort lookup: ask the user's login shell where `turso` is. A login
/// shell sources the user's profile, so we resolve the same PATH their terminal
/// sees — covering custom prefixes the well-known list misses. Best-effort: any
/// failure just yields `None`.
#[cfg(not(target_os = "windows"))]
fn turso_via_login_shell() -> Option<std::path::PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let output = std::process::Command::new(&shell)
        .args(["-lc", "command -v turso"])
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        return None;
    }
    let candidate = std::path::PathBuf::from(path);
    if candidate.is_file() {
        Some(candidate)
    } else {
        None
    }
}

/// Returns the first usable Turso CLI path. Tries, in order: the inherited PATH,
/// well-known absolute install locations, then the user's login shell. The
/// extra fallbacks matter because GUI apps on macOS/Linux rarely inherit the
/// shell PATH, so an installed CLI is otherwise reported as missing.
fn resolve_turso_bin() -> Option<std::path::PathBuf> {
    // PATH lookup — works for existing installs where the user's shell config
    // already exports the install dir (e.g. when Dora was launched from a
    // terminal).
    if turso_runs(std::path::Path::new("turso")) {
        return Some(std::path::PathBuf::from("turso"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        for candidate in well_known_turso_paths() {
            if candidate.is_file() {
                return Some(candidate);
            }
        }

        if let Some(path) = turso_via_login_shell() {
            return Some(path);
        }
    }

    None
}

fn require_turso_bin() -> Result<std::path::PathBuf> {
    resolve_turso_bin().ok_or_else(|| {
        Error::Any(anyhow::anyhow!(
            "The Turso CLI isn't installed. Use the install button in Dora or run: curl -sSfL https://get.tur.so/install.sh | bash"
        ))
    })
}

/// Whether a usable Turso CLI binary exists (PATH or default install location).
pub fn cli_available() -> bool {
    resolve_turso_bin().is_some()
}

/// Shown when the CLI is installed but the user hasn't authenticated. The
/// frontend matches on this to route the user into the in-app sign-in flow.
const NOT_LOGGED_IN_MESSAGE: &str =
    "You're not signed in to the Turso CLI. Sign in to Turso, then try again.";

fn cli_reports_logged_out(output: &std::process::Output) -> bool {
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .to_lowercase();
    text.contains("not logged in")
        || text.contains("no user logged in")
        || text.contains("please login")
        || text.contains("please log in")
        || text.contains("you must log in")
        || text.contains("unauthenticated")
}

/// Pulls the platform token out of `turso auth api-tokens mint` output. Turso
/// platform tokens are JWTs (three dot-separated base64url segments), so we
/// prefer the longest JWT-looking word and fall back to the last bare line. The
/// token is validated against the API afterwards, so a wrong guess fails safe.
fn extract_minted_token(stdout: &str) -> Option<String> {
    let is_jwt_char = |c: char| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-');
    let jwt = stdout
        .split_whitespace()
        .filter(|word| {
            word.matches('.').count() == 2 && word.len() > 20 && word.chars().all(is_jwt_char)
        })
        .max_by_key(|word| word.len())
        .map(|word| word.to_string());
    if jwt.is_some() {
        return jwt;
    }
    stdout
        .lines()
        .rev()
        .map(|line| line.trim())
        .find(|line| !line.is_empty() && !line.contains(char::is_whitespace))
        .map(|line| line.to_string())
}

fn run_mint(bin: &std::path::Path, token_name: &str) -> Result<std::process::Output> {
    std::process::Command::new(bin)
        .args(["auth", "api-tokens", "mint", token_name])
        .stdin(std::process::Stdio::null())
        .output()
        .map_err(|error| {
            Error::Any(anyhow::anyhow!("Couldn't run the Turso CLI: {error}."))
        })
}

fn run_login(bin: &std::path::Path) -> Result<()> {
    // Opens a browser and blocks until the user finishes the flow (or the CLI
    // gives up). stdin is /dev/null so a CLI prompt can't hang us with no
    // terminal attached; the browser-based flow doesn't need it.
    let status = std::process::Command::new(bin)
        .args(["auth", "login"])
        .stdin(std::process::Stdio::null())
        .status()
        .map_err(|error| Error::Any(anyhow::anyhow!("Couldn't start Turso login: {error}")))?;
    if !status.success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Turso login didn't complete. Try again, or paste a token manually."
        )));
    }
    Ok(())
}

/// Whether the user is signed in to the Turso CLI (`turso auth whoami`). Returns
/// false if the CLI is missing or reports a logged-out state.
fn logged_in_blocking() -> bool {
    let Some(bin) = resolve_turso_bin() else {
        return false;
    };
    let output = std::process::Command::new(&bin)
        .args(["auth", "whoami"])
        .stdin(std::process::Stdio::null())
        .output();
    match output {
        Ok(output) => output.status.success() && !cli_reports_logged_out(&output),
        Err(_) => false,
    }
}

/// Runs `turso auth login`, opening a browser for the user to authenticate.
fn login_blocking() -> Result<()> {
    let bin = require_turso_bin()?;
    run_login(&bin)
}

/// Whether the user is signed in to the local Turso CLI.
pub async fn cli_logged_in() -> bool {
    tokio::task::spawn_blocking(logged_in_blocking)
        .await
        .unwrap_or(false)
}

/// Drives `turso auth login` so the user can authenticate from inside Dora.
pub async fn cli_login() -> Result<()> {
    tokio::task::spawn_blocking(login_blocking)
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Turso login task failed: {error}")))?
}

fn mint_token_blocking() -> Result<String> {
    let bin = require_turso_bin()?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0);
    // Token names must be unique per account — stamp it so re-runs don't collide.
    let token_name = format!("dora-{timestamp}");

    let mut output = run_mint(&bin, &token_name)?;
    if !output.status.success() && cli_reports_logged_out(&output) {
        run_login(&bin)?;
        output = run_mint(&bin, &token_name)?;
    }

    if !output.status.success() {
        // A logged-out CLI is the common case — surface a clear, actionable
        // message so the UI can route the user to sign in rather than showing a
        // raw CLI error.
        if cli_reports_logged_out(&output) {
            return Err(Error::Any(anyhow::anyhow!(NOT_LOGGED_IN_MESSAGE)));
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.trim();
        let detail = if detail.is_empty() { "unknown error" } else { detail };
        return Err(Error::Any(anyhow::anyhow!(
            "Turso CLI couldn't mint a token: {detail}"
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    extract_minted_token(&stdout).ok_or_else(|| {
        // The CLI can exit 0 yet print a login prompt instead of a token when
        // the session expired — treat that as a sign-in prompt, not a parse
        // failure.
        if cli_reports_logged_out(&output) {
            Error::Any(anyhow::anyhow!(NOT_LOGGED_IN_MESSAGE))
        } else {
            Error::Any(anyhow::anyhow!(
                "Couldn't read a token from the Turso CLI output."
            ))
        }
    })
}

/// Mints a Platform API token via the local Turso CLI, then validates and
/// stores it exactly like a hand-pasted token.
pub async fn mint_token_via_cli(storage: &Storage) -> Result<()> {
    let token = tokio::task::spawn_blocking(mint_token_blocking)
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Turso CLI task failed: {error}")))??;
    save_token(storage, token).await
}

// ---------------------------------------------------------------------------
// CLI installation
// ---------------------------------------------------------------------------

/// Installs the Turso CLI via the official install script (macOS/Linux only).
/// Runs `curl -sSfL https://get.tur.so/install.sh | bash` in a subprocess.
/// After this returns `Ok(())`, `cli_available()` will find the binary at
/// `~/.turso/bin/turso` even before the user's shell sources its profile.
pub async fn install_cli() -> Result<()> {
    #[cfg(target_os = "windows")]
    return Err(Error::Any(anyhow::anyhow!(
        "Automatic CLI install is not supported on Windows. Install via Scoop: scoop bucket add turso https://github.com/tursodatabase/scoop-bucket && scoop install turso"
    )));

    #[cfg(not(target_os = "windows"))]
    {
        tokio::task::spawn_blocking(|| {
            let output = std::process::Command::new("sh")
                .args(["-c", "curl -sSfL https://get.tur.so/install.sh | bash"])
                .stdin(std::process::Stdio::null())
                .output()
                .map_err(|error| {
                    Error::Any(anyhow::anyhow!(
                        "Failed to run Turso install script: {error}. Make sure curl is installed."
                    ))
                })?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                let detail = format!("{}{}", stdout.trim(), stderr.trim());
                let detail = if detail.is_empty() { "unknown error".to_string() } else { detail };
                return Err(Error::Any(anyhow::anyhow!(
                    "Turso CLI install failed: {detail}"
                )));
            }

            Ok(())
        })
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Install task panicked: {error}")))??;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_pascalcase_database_fields() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [
                { "Name": "my-db", "Hostname": "my-db-acme.turso.io", "group": "default", "primaryRegion": "aws-us-east-1" }
            ] }"#,
        )
        .expect("databases json should deserialize");
        assert_eq!(parsed.databases.len(), 1);
        assert_eq!(parsed.databases[0].name, "my-db");
        assert_eq!(parsed.databases[0].hostname, "my-db-acme.turso.io");
        assert_eq!(parsed.databases[0].primary_region, "aws-us-east-1");
    }

    #[test]
    fn tolerates_missing_optional_database_fields() {
        let parsed: DatabasesResponse = serde_json::from_str(
            r#"{ "databases": [ { "Name": "d", "Hostname": "d-acme.turso.io" } ] }"#,
        )
        .expect("databases json should deserialize without optional fields");
        assert_eq!(parsed.databases[0].group, "");
        assert_eq!(parsed.databases[0].primary_region, "");
    }

    #[test]
    fn decodes_token_jwt() {
        let parsed: CreateTokenResponse =
            serde_json::from_str(r#"{ "jwt": "ey.token.value" }"#).expect("token json");
        assert_eq!(parsed.jwt, "ey.token.value");
    }

    #[test]
    fn extracts_jwt_from_labelled_cli_output() {
        let out = "Created token dora-1700000000: eyJhbGciOiJFZERTQSJ9.eyJpZCI6Im9rIn0.sig_value_here\n";
        assert_eq!(
            extract_minted_token(out).as_deref(),
            Some("eyJhbGciOiJFZERTQSJ9.eyJpZCI6Im9rIn0.sig_value_here")
        );
    }

    #[test]
    fn extracts_bare_token_line() {
        let out = "eyJhbGciOiJFZERTQSJ9.eyJpZCI6Im9rIn0.sig_value_here\n";
        assert_eq!(
            extract_minted_token(out).as_deref(),
            Some("eyJhbGciOiJFZERTQSJ9.eyJpZCI6Im9rIn0.sig_value_here")
        );
    }

    #[test]
    fn ignores_urls_when_extracting_token() {
        // A help/login URL must not be mistaken for the token.
        let out = "Visit https://app.turso.tech to manage tokens\n";
        assert_eq!(extract_minted_token(out), None);
    }
}
