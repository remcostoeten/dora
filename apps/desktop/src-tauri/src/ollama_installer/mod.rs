mod download;
mod paths;
mod runtime;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;
use tokio::sync::mpsc::UnboundedSender;

pub use paths::{install_root, managed_binary_path, managed_install_exists};
pub use runtime::{start_managed_server, stop_managed_server};

use crate::error::Error;

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct OllamaInstallStatus {
    pub managed: bool,
    pub install_path: Option<String>,
    pub binary_ready: bool,
    pub running: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OllamaInstallEvent {
    Status {
        message: String,
    },
    Progress {
        completed: u64,
        total: Option<u64>,
        percent: f32,
    },
    Done {
        version: Option<String>,
        install_path: String,
    },
    Error {
        message: String,
    },
}

pub async fn get_install_status(endpoint: &str) -> OllamaInstallStatus {
    let managed = managed_install_exists();
    let install_path = managed.then(|| install_root().to_string_lossy().into_owned());
    let binary_ready = managed_binary_path().is_some();
    let (running, version) = match runtime::probe_server(endpoint).await {
        Ok(version) => (true, Some(version)),
        Err(_) => (false, None),
    };

    OllamaInstallStatus {
        managed,
        install_path,
        binary_ready,
        running,
        version,
    }
}

pub async fn install_managed(
    sender: UnboundedSender<OllamaInstallEvent>,
    cancel: Arc<AtomicBool>,
) -> Result<(), Error> {
    let _ = sender.send(OllamaInstallEvent::Status {
        message: "Preparing Ollama download…".into(),
    });

    let root = install_root();
    std::fs::create_dir_all(&root).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to create install directory: {error}"
        ))
    })?;

    let (url, archive_name) = download::platform_download()?;
    let archive_path = root.join(archive_name);

    download::fetch_with_progress(&url, &archive_path, &sender, &cancel).await?;

    if cancel.load(Ordering::Relaxed) {
        return Ok(());
    }

    let _ = sender.send(OllamaInstallEvent::Status {
        message: "Extracting Ollama…".into(),
    });

    download::extract_archive(&archive_path, &root)?;
    let _ = std::fs::remove_file(&archive_path);

    std::fs::write(root.join(".dora-managed"), b"1")
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to write install marker: {error}")))?;

    #[cfg(target_os = "macos")]
    {
        if let Some(binary) = managed_binary_path() {
            let _ = std::process::Command::new("xattr")
                .args([
                    "-dr",
                    "com.apple.quarantine",
                    binary.to_string_lossy().as_ref(),
                ])
                .status();
        }
    }

    if cancel.load(Ordering::Relaxed) {
        return Ok(());
    }

    let _ = sender.send(OllamaInstallEvent::Status {
        message: "Starting Ollama…".into(),
    });

    start_managed_server().await?;
    let version = runtime::wait_for_server("http://127.0.0.1:11434", 60)
        .await
        .ok();

    let _ = sender.send(OllamaInstallEvent::Done {
        version,
        install_path: root.to_string_lossy().into_owned(),
    });

    Ok(())
}
