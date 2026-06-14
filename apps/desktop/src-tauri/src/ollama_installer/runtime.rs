use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::Deserialize;

use super::paths::{lib_dir, managed_binary_path, models_dir};
use crate::error::Error;

static MANAGED_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn child_slot() -> &'static Mutex<Option<Child>> {
    MANAGED_CHILD.get_or_init(|| Mutex::new(None))
}

pub async fn probe_server(endpoint: &str) -> Result<String, Error> {
    let url = format!("{}/api/version", endpoint.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|error| Error::Any(anyhow::anyhow!("client build failed: {error}")))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Ollama unreachable: {error}")))?;

    if !response.status().is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Ollama version check failed ({})",
            response.status()
        )));
    }

    #[derive(Deserialize)]
    struct VersionResponse {
        version: String,
    }

    let parsed: VersionResponse = response
        .json()
        .await
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to parse Ollama version: {error}")))?;

    Ok(parsed.version)
}

pub async fn wait_for_server(endpoint: &str, timeout_secs: u64) -> Result<String, Error> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        if let Ok(version) = probe_server(endpoint).await {
            return Ok(version);
        }
        if std::time::Instant::now() >= deadline {
            return Err(Error::Any(anyhow::anyhow!(
                "Timed out waiting for Ollama to start"
            )));
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
}

pub async fn start_managed_server() -> Result<(), Error> {
    if probe_server("http://127.0.0.1:11434").await.is_ok() {
        return Ok(());
    }

    let binary = managed_binary_path().ok_or_else(|| {
        Error::InvalidInput("Managed Ollama binary not found. Install Ollama first.".into())
    })?;

    stop_managed_server();

    std::fs::create_dir_all(models_dir()).map_err(|error| {
        Error::Any(anyhow::anyhow!(
            "Failed to create models directory: {error}"
        ))
    })?;

    let mut command = Command::new(&binary);
    command
        .arg("serve")
        .env("OLLAMA_HOST", "127.0.0.1:11434")
        .env("OLLAMA_MODELS", models_dir())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    apply_platform_env(&mut command, &binary);

    let child = command
        .spawn()
        .map_err(|error| Error::Any(anyhow::anyhow!("Failed to start Ollama: {error}")))?;

    if let Ok(mut slot) = child_slot().lock() {
        *slot = Some(child);
    }

    Ok(())
}

pub fn stop_managed_server() {
    if let Ok(mut slot) = child_slot().lock() {
        if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn apply_platform_env(command: &mut Command, binary: &PathBuf) {
    #[cfg(target_os = "linux")]
    let _ = binary;

    #[cfg(target_os = "linux")]
    if let Some(lib) = lib_dir() {
        let existing = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
        let value = if existing.is_empty() {
            lib.to_string_lossy().into_owned()
        } else {
            format!("{}:{}", lib.to_string_lossy(), existing)
        };
        command.env("LD_LIBRARY_PATH", value);
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(lib) = lib_dir() {
            let existing = std::env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
            let value = if existing.is_empty() {
                lib.to_string_lossy().into_owned()
            } else {
                format!("{}:{}", lib.to_string_lossy(), existing)
            };
            command.env("DYLD_LIBRARY_PATH", value);
        }
        let _ = binary;
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(parent) = binary.parent() {
            let existing = std::env::var("PATH").unwrap_or_default();
            let parent = parent.to_string_lossy();
            let value = if existing.is_empty() {
                parent.into_owned()
            } else {
                format!("{parent};{existing}")
            };
            command.env("PATH", value);
        }
    }
}
