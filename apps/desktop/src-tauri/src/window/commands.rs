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

/// Open a folder picker and return the chosen directory path. Used by the ORM
/// cockpit to let the user link a project folder.
#[tauri::command]
#[specta::specta]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, Error> {
    let chosen = run_dialog(app, || {
        AsyncFileDialog::new()
            .set_title("Select a project folder")
            .pick_folder()
    })
    .await?
    .map(|folder| folder.path().to_string_lossy().to_string());

    Ok(chosen)
}

/// Largest project file we'll read into memory for schema parsing. A
/// mistargeted path (e.g. a build artifact) shouldn't load something huge.
const MAX_PROJECT_FILE_BYTES: u64 = 2 * 1024 * 1024;

/// Read a project schema/config file (Drizzle `.ts`, Prisma `.prisma`, …) as
/// UTF-8 text, size-capped. Feeds the ORM detection + parsers.
#[tauri::command]
#[specta::specta]
pub async fn read_project_file(path: String) -> Result<String, Error> {
    let metadata = tokio::fs::metadata(&path)
        .await
        .with_context(|| format!("Failed to stat file: {path}"))?;
    if !metadata.is_file() {
        return Err(Error::Any(anyhow::anyhow!("Not a file: {path}")));
    }
    if metadata.len() > MAX_PROJECT_FILE_BYTES {
        return Err(Error::Any(anyhow::anyhow!(
            "File too large to read ({} bytes): {path}",
            metadata.len()
        )));
    }
    tokio::fs::read_to_string(&path)
        .await
        .with_context(|| format!("Failed to read file: {path}"))
        .map_err(Error::from)
}

/// Shallowly list a directory's entries as absolute paths. ORM detection in TS
/// filters these by extension / known names (e.g. a multi-file Drizzle
/// `schema/` dir or Prisma `prisma/schema/` dir).
#[tauri::command]
#[specta::specta]
pub async fn list_dir(path: String) -> Result<Vec<String>, Error> {
    let mut entries = tokio::fs::read_dir(&path)
        .await
        .with_context(|| format!("Failed to read directory: {path}"))?;

    let mut paths = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .with_context(|| format!("Failed to read directory entry in: {path}"))?
    {
        paths.push(entry.path().to_string_lossy().to_string());
    }

    Ok(paths)
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
