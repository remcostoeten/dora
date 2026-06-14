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

/// How the OS-backed credential store can be installed on this machine.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyringInstallPlan {
    /// Detected package manager (e.g. "pacman", "apt-get", "dnf"), if any.
    pub package_manager: Option<String>,
    /// Package that provides the OS Secret Service (e.g. "gnome-keyring").
    pub package: String,
    /// Human-readable command the user could run themselves.
    pub command: String,
    /// True when Dora can run the install itself (via pkexec on Linux).
    pub can_auto_install: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct KeyringInstallResult {
    pub ok: bool,
    pub message: String,
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
        let package = keyring_package(detect_package_manager().map(|(name, _)| name));
        Some(format!(
            "Install {package} and restart Dora for OS-backed credential storage."
        ))
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

/// True when the current session is KDE Plasma, where kwallet is the natural
/// Secret Service provider (it implements org.freedesktop.secrets).
#[cfg(target_os = "linux")]
fn is_kde_session() -> bool {
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_ascii_lowercase();
    desktop.contains("kde") || desktop.contains("plasma")
}

/// Picks the package that provides the freedesktop Secret Service.
///
/// gnome-keyring is the universal default — it's light and works under any
/// desktop. On KDE we prefer kwallet (users there already have it), but its
/// package name differs per distro, so it's keyed off the package manager.
#[cfg(target_os = "linux")]
fn keyring_package(package_manager: Option<&str>) -> &'static str {
    if !is_kde_session() {
        return "gnome-keyring";
    }
    match package_manager {
        Some("pacman") | Some("apk") => "kwallet",
        Some("apt-get") => "kwalletmanager",
        Some("dnf") | Some("zypper") => "kwalletmanager5",
        _ => "kwallet",
    }
}

/// Returns true when `bin` is found on PATH.
#[cfg(target_os = "linux")]
fn which(bin: &str) -> bool {
    std::env::var_os("PATH")
        .map(|paths| std::env::split_paths(&paths).any(|dir| dir.join(bin).is_file()))
        .unwrap_or(false)
}

/// Detects the system package manager and the arguments needed to install a
/// package non-interactively. Returns (display name, install args).
#[cfg(target_os = "linux")]
fn detect_package_manager() -> Option<(&'static str, Vec<&'static str>)> {
    let candidates: [(&str, Vec<&str>); 5] = [
        ("pacman", vec!["pacman", "-S", "--noconfirm"]),
        ("apt-get", vec!["apt-get", "install", "-y"]),
        ("dnf", vec!["dnf", "install", "-y"]),
        ("zypper", vec!["zypper", "--non-interactive", "install"]),
        ("apk", vec!["apk", "add"]),
    ];

    candidates.into_iter().find(|(_, args)| which(args[0]))
}

/// Describes how (or whether) the OS keyring can be installed on this machine.
/// Returns `None` when the OS keyring is already in use or the platform isn't
/// supported for guided installs.
pub fn install_plan() -> Option<KeyringInstallPlan> {
    if uses_os_keyring() {
        return None;
    }

    #[cfg(target_os = "linux")]
    {
        match detect_package_manager() {
            Some((name, args)) => {
                let package = keyring_package(Some(name));
                let command = format!("sudo {} {}", args.join(" "), package);
                Some(KeyringInstallPlan {
                    package_manager: Some(name.to_string()),
                    package: package.to_string(),
                    command,
                    can_auto_install: which("pkexec"),
                })
            }
            None => {
                let package = keyring_package(None);
                Some(KeyringInstallPlan {
                    package_manager: None,
                    package: package.to_string(),
                    command: format!("Install {package} with your system package manager"),
                    can_auto_install: false,
                })
            }
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}

/// Attempts to install the OS keyring package, requesting privilege escalation
/// via pkexec. Blocking — run off the main thread.
pub fn install() -> KeyringInstallResult {
    #[cfg(target_os = "linux")]
    {
        let Some((name, args)) = detect_package_manager() else {
            return KeyringInstallResult {
                ok: false,
                message: "No supported package manager was found. Install gnome-keyring manually."
                    .to_string(),
            };
        };

        if !which("pkexec") {
            return KeyringInstallResult {
                ok: false,
                message: "pkexec (PolicyKit) is not available. Run the install command in a terminal instead."
                    .to_string(),
            };
        }

        let package = keyring_package(Some(name));
        let output = std::process::Command::new("pkexec")
            .args(&args)
            .arg(package)
            .output();

        match output {
            Ok(out) if out.status.success() => KeyringInstallResult {
                ok: true,
                message: format!(
                    "{package} installed. Restart Dora to use OS-backed credential storage."
                ),
            },
            Ok(out) => {
                // pkexec exits 126 when the auth dialog is dismissed/denied.
                if out.status.code() == Some(126) {
                    return KeyringInstallResult {
                        ok: false,
                        message: "Installation was cancelled.".to_string(),
                    };
                }
                let stderr = String::from_utf8_lossy(&out.stderr);
                let detail = stderr.trim();
                KeyringInstallResult {
                    ok: false,
                    message: if detail.is_empty() {
                        "Install failed. Try running the command in a terminal.".to_string()
                    } else {
                        format!("Install failed: {detail}")
                    },
                }
            }
            Err(error) => KeyringInstallResult {
                ok: false,
                message: format!("Could not launch installer: {error}"),
            },
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        KeyringInstallResult {
            ok: false,
            message: "Automatic install is only supported on Linux.".to_string(),
        }
    }
}
