use anyhow::Context;
use rfd::AsyncFileDialog;
use tauri::Manager;
use tokio::io::AsyncReadExt;

use crate::window::file_probe::{probe_database_file_header, DatabaseFileKind};
use crate::Error;

#[tauri::command]
#[specta::specta]
pub async fn minimize_window(app: tauri::AppHandle) -> Result<(), Error> {
    app.get_webview_window("main")
        .context("Failed to get main window")?
        .minimize()
        .context("Failed to minimize window")?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn maximize_window(app: tauri::AppHandle) -> Result<(), Error> {
    app.get_webview_window("main")
        .context("Failed to get main window")?
        .maximize()
        .context("Failed to maximize window")?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn close_window(app: tauri::AppHandle) -> Result<(), Error> {
    app.get_webview_window("main")
        .context("Failed to get main window")?
        .close()
        .context("Failed to close window")?;

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn open_sqlite_db(app: tauri::AppHandle) -> Result<Option<String>, Error> {
    let chosen_file = run_dialog(app, || {
        AsyncFileDialog::new()
            .set_title("Pick a SQLite database file")
            .add_filter(
                "SQLite database",
                &["db", "db3", "sqlite", "sqlite2", "sqlite3", "s3db", "sl3"],
            )
            .pick_file()
    })
    .await?
    .map(|file| file.path().to_string_lossy().to_string());

    Ok(chosen_file)
}

#[tauri::command]
#[specta::specta]
pub async fn save_sqlite_db(app: tauri::AppHandle) -> Result<Option<String>, Error> {
    let chosen_file = run_dialog(app, || {
        AsyncFileDialog::new()
            .set_title("Create a new SQLite database file")
            .save_file()
    })
    .await?
    .map(|file| file.path().to_string_lossy().to_string());

    Ok(chosen_file)
}

#[tauri::command]
#[specta::specta]
pub async fn open_file(
    app: tauri::AppHandle,
    title: Option<String>,
) -> Result<Option<String>, Error> {
    let dialog_title = title.unwrap_or_else(|| "Select a file".to_string());
    let chosen_file = run_dialog(app, move || {
        AsyncFileDialog::new().set_title(&dialog_title).pick_file()
    })
    .await?
    .map(|file| file.path().to_string_lossy().to_string());

    Ok(chosen_file)
}

/// Multi-select picker for flat data files (CSV / TSV / Parquet / JSON) that
/// can be opened as a read-only DuckDB-backed connection.
#[tauri::command]
#[specta::specta]
pub async fn open_data_files(app: tauri::AppHandle) -> Result<Vec<String>, Error> {
    let chosen = run_dialog(app, || {
        AsyncFileDialog::new()
            .set_title("Open data files (CSV, Parquet, JSON)")
            .add_filter(
                "Data files",
                &[
                    "csv", "tsv", "txt", "parquet", "pq", "json", "ndjson", "jsonl",
                ],
            )
            .pick_files()
    })
    .await?
    .map(|files| {
        files
            .iter()
            .map(|file| file.path().to_string_lossy().to_string())
            .collect::<Vec<_>>()
    })
    .unwrap_or_default();

    Ok(chosen)
}

/// Read the first bytes of a database file and identify SQLite vs DuckDB.
#[tauri::command]
#[specta::specta]
pub async fn probe_database_file(path: String) -> Result<DatabaseFileKind, Error> {
    let mut file = tokio::fs::File::open(&path)
        .await
        .with_context(|| format!("Failed to open file: {path}"))?;
    let mut header = [0u8; 16];
    let read = file
        .read(&mut header)
        .await
        .with_context(|| format!("Failed to read file header: {path}"))?;
    Ok(probe_database_file_header(&header[..read]))
}

async fn run_dialog<F, Fut, T>(app: tauri::AppHandle, make_future: F) -> Result<Option<T>, Error>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Option<T>> + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.run_on_main_thread(move || {
        // According to the rfd docs, we have to _spawn_ the dialog on the main thread,
        // but we can await it in any other thread.
        let fut = make_future();

        tauri::async_runtime::spawn(async move {
            let _ = tx.send(fut.await);
        });
    })?;

    rx.await
        .map_err(|_| Error::Any(anyhow::anyhow!("Failed to receive dialog result")))
}
