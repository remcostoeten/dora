use keyring::Entry;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use std::sync::OnceLock;

const PROBE_SERVICE: &str = "dora_db_client";
const PROBE_ACCOUNT: &str = "dora_encryption_key";
pub const FALLBACK_KEY_FILE: &str = "encryption.key";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum CredentialStorageBackend {
    OsKeyring,
    LocalEncryptedFile,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CredentialStorageStatus {
    pub backend: CredentialStorageBackend,
    pub message: String,
    pub storage_path: Option<String>,
    pub install_hint: Option<String>,
}

static BACKEND: OnceLock<CredentialStorageBackend> = OnceLock::new();
static UNAVAILABLE_REASON: OnceLock<String> = OnceLock::new();
static STARTUP_LOGGED: OnceLock<()> = OnceLock::new();

pub fn backend() -> CredentialStorageBackend {
    *BACKEND.get_or_init(detect_backend)
}

pub fn uses_os_keyring() -> bool {
    matches!(backend(), CredentialStorageBackend::OsKeyring)
}

pub fn warm_up() {
    let backend = backend();
    STARTUP_LOGGED.get_or_init(|| match backend {
        CredentialStorageBackend::OsKeyring => {
            log::info!("Credential storage: OS keyring");
        }
        CredentialStorageBackend::LocalEncryptedFile => {
            let path = fallback_storage_display_path();
            let reason = UNAVAILABLE_REASON
                .get()
                .map(String::as_str)
                .unwrap_or("OS secret service unavailable");
            log::warn!(
                "Credential storage: local encrypted file at {path} ({reason}). {}",
                install_hint_for_logs()
            );
        }
    });
}

pub fn status() -> CredentialStorageStatus {
    match backend() {
        CredentialStorageBackend::OsKeyring => CredentialStorageStatus {
            backend: CredentialStorageBackend::OsKeyring,
            message: "Credentials are stored in your OS keychain.".to_string(),
            storage_path: None,
            install_hint: None,
        },
        CredentialStorageBackend::LocalEncryptedFile => {
            let path = fallback_storage_display_path();
            CredentialStorageStatus {
                backend: CredentialStorageBackend::LocalEncryptedFile,
                message: format!(
                    "Credentials are encrypted locally at {path} because the OS secret service is unavailable."
                ),
                storage_path: Some(path),
                install_hint: install_hint_for_ui(),
            }
        }
    }
}

pub fn fallback_key_path() -> anyhow::Result<PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("OS config directory is unavailable"))?
        .join("dora");
    Ok(config_dir.join(FALLBACK_KEY_FILE))
}

pub fn fallback_storage_display_path() -> String {
    fallback_key_path()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|_| "~/.config/dora/encryption.key".to_string())
}

fn detect_backend() -> CredentialStorageBackend {
    match probe_os_keyring() {
        Ok(()) => CredentialStorageBackend::OsKeyring,
        Err(reason) => {
            let _ = UNAVAILABLE_REASON.set(reason);
            CredentialStorageBackend::LocalEncryptedFile
        }
    }
}

fn probe_os_keyring() -> Result<(), String> {
    let entry = Entry::new(PROBE_SERVICE, PROBE_ACCOUNT).map_err(|error| error.to_string())?;

    match entry.get_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn install_hint_for_logs() -> &'static str {
    #[cfg(target_os = "linux")]
    {
        "Install gnome-keyring or kwallet for OS-backed storage."
    }
    #[cfg(not(target_os = "linux"))]
    {
        "Unlock or enable your OS credential store for stronger isolation."
    }
}

fn install_hint_for_ui() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        Some(
            "Install gnome-keyring (or kwallet) and restart Dora for OS-backed credential storage."
                .to_string(),
        )
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}
