use std::fs::File;
use std::io::{copy, Read};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use flate2::read::GzDecoder;
use futures_util::StreamExt;
use tokio::sync::mpsc::UnboundedSender;
use zip::ZipArchive;

use super::OllamaInstallEvent;
use crate::error::Error;

pub fn platform_download() -> Result<(String, &'static str), Error> {
    let url = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => "https://ollama.com/download/ollama-linux-amd64.tar.zst",
        ("linux", "aarch64") => "https://ollama.com/download/ollama-linux-arm64.tar.zst",
        ("macos", _) => "https://ollama.com/download/ollama-darwin.tgz",
        ("windows", "x86_64") => "https://ollama.com/download/ollama-windows-amd64.zip",
        ("windows", "aarch64") => "https://ollama.com/download/ollama-windows-arm64.zip",
        (os, arch) => {
            return Err(Error::InvalidInput(format!(
                "Ollama auto-install is not supported on {os}/{arch} yet"
            )));
        }
    };

    let file_name = url.rsplit('/').next().unwrap_or("ollama-archive");
    Ok((url.to_string(), file_name))
}

pub async fn fetch_with_progress(
    url: &str,
    destination: &Path,
    sender: &UnboundedSender<OllamaInstallEvent>,
    cancel: &Arc<AtomicBool>,
) -> Result<(), Error> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60 * 60))
        .build()
        .map_err(|error| Error::Any(anyhow::anyhow!("download client failed: {error}")))?;

    let response = client.get(url).send().await.map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to download Ollama: {error}"))
    })?;

    if !response.status().is_success() {
        return Err(Error::Any(anyhow::anyhow!(
            "Failed to download Ollama ({})",
            response.status()
        )));
    }

    let total = response.content_length();
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(destination).await.map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to create archive file: {error}"))
    })?;
    let mut completed = 0u64;

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(destination).await;
            return Ok(());
        }

        let chunk = chunk.map_err(|error| Error::Any(anyhow::anyhow!("Download failed: {error}")))?;
        completed += chunk.len() as u64;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|error| Error::Any(anyhow::anyhow!("Failed to write archive: {error}")))?;

        let percent = total.map(|value| {
            if value == 0 {
                0.0
            } else {
                ((completed as f64 / value as f64) * 100.0) as f32
            }
        });

        let _ = sender.send(OllamaInstallEvent::Progress {
            completed,
            total,
            percent: percent.unwrap_or(0.0),
        });
    }

    Ok(())
}

pub fn extract_archive(archive_path: &Path, destination: &Path) -> Result<(), Error> {
    let file_name = archive_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if file_name.ends_with(".tar.zst") {
        extract_tar_zst(archive_path, destination)
    } else if file_name.ends_with(".tgz") || file_name.ends_with(".tar.gz") {
        extract_tar_gz(archive_path, destination)
    } else if file_name.ends_with(".zip") {
        extract_zip(archive_path, destination)
    } else {
        Err(Error::InvalidInput(format!(
            "Unsupported Ollama archive format: {}",
            archive_path.display()
        )))
    }
}

fn extract_tar_zst(archive_path: &Path, destination: &Path) -> Result<(), Error> {
    let file = File::open(archive_path).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to open archive: {error}"))
    })?;
    let decoder = zstd::stream::read::Decoder::new(file).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to decompress archive: {error}"))
    })?;
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(destination).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to extract archive: {error}"))
    })
}

fn extract_tar_gz(archive_path: &Path, destination: &Path) -> Result<(), Error> {
    let file = File::open(archive_path).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to open archive: {error}"))
    })?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive.unpack(destination).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to extract archive: {error}"))
    })
}

fn extract_zip(archive_path: &Path, destination: &Path) -> Result<(), Error> {
    let file = File::open(archive_path).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to open archive: {error}"))
    })?;
    let mut archive = ZipArchive::new(file).map_err(|error| {
        Error::Any(anyhow::anyhow!("Failed to read zip archive: {error}"))
    })?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to read zip entry: {error}"))
        })?;
        let Some(relative) = sanitize_zip_path(entry.name()) else {
            continue;
        };
        let out_path = destination.join(relative);
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).map_err(|error| {
                Error::Any(anyhow::anyhow!("Failed to create directory: {error}"))
            })?;
            continue;
        }
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                Error::Any(anyhow::anyhow!("Failed to create directory: {error}"))
            })?;
        }
        let mut out_file = File::create(&out_path).map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to create file: {error}"))
        })?;
        copy(&mut entry, &mut out_file).map_err(|error| {
            Error::Any(anyhow::anyhow!("Failed to extract file: {error}"))
        })?;
    }

    Ok(())
}

fn sanitize_zip_path(name: &str) -> Option<PathBuf> {
    let path = PathBuf::from(name);
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return None;
    }
    Some(path)
}
