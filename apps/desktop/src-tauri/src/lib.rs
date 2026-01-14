mod bindings;
mod commands_system;
mod credentials;
mod database;
mod error;
mod init;
mod storage;
mod test_queries;
mod utils;
mod window;

use std::sync::{Arc, RwLock};

use dashmap::DashMap;
use tauri::Manager;
use uuid::Uuid;
pub mod security;
use crate::{
    commands_system::CommandRegistry,
    database::{
        stmt_manager::StatementManager,
        types::{DatabaseConnection, DatabaseSchema},
        ConnectionMonitor,
    },
    storage::Storage,
};
pub use error::{Error, Result};

#[derive(Debug)]
pub struct AppState {
    pub connections: DashMap<Uuid, DatabaseConnection>,
    pub schemas: DashMap<Uuid, Arc<DatabaseSchema>>,
    /// SQLite database for application data
    pub storage: Storage,
    pub stmt_manager: StatementManager,
    /// Command registry with keyboard shortcuts
    pub command_registry: RwLock<CommandRegistry>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        let data_dir = dirs::data_dir().expect("Failed to get data directory");
        let db_path = data_dir.join("Dora").join("Dora.db");

        let storage = Storage::new(db_path)?;

        // Initialize command registry and load custom shortcuts from database
        let mut command_registry = CommandRegistry::new();
        if let Err(e) = commands_system::load_custom_shortcuts(&storage, &mut command_registry) {
            log::warn!("Failed to load custom shortcuts: {}", e);
        }

        Ok(Self {
            connections: DashMap::new(),
            schemas: DashMap::new(),
            storage,
            stmt_manager: StatementManager::new(),
            command_registry: RwLock::new(command_registry),
        })
    }
}

#[allow(clippy::missing_panics_doc)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install ring as the default crypto provider for rustls
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let app_state = match AppState::new() {
        Ok(app_state) => app_state,
        Err(e) => {
            eprintln!("Error initializing app state: {}", e);
            std::process::exit(1);
        }
    };
    let certificates = database::Certificates::new();

    tauri::Builder::default()
        .manage(app_state)
        .manage(certificates)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                #[cfg(debug_assertions)]
                {
                    match std::panic::catch_unwind(|| crate::bindings::export_ts_bindings()) {
                        Ok(_) => log::info!("TypeScript bindings exported successfully"),
                        Err(_) => log::error!("Failed to export TypeScript bindings"),
                    }
                }
            }

            init::build_window(app)?;
            init::build_menu(app)?;

            let handle = app.handle();
            let monitor = ConnectionMonitor::new(handle.clone());
            handle.manage(monitor);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Database commands
            database::commands::test_connection,
            database::commands::add_connection,
            database::commands::update_connection,
            database::commands::update_connection_color,
            database::commands::connect_to_database,
            database::commands::disconnect_from_database,
            database::commands::start_query,
            database::commands::fetch_query,
            database::commands::fetch_page,
            database::commands::get_query_status,
            database::commands::get_page_count,
            database::commands::get_columns,
            database::commands::get_connections,
            database::commands::remove_connection,
            database::commands::initialize_connections,
            database::commands::save_query_to_history,
            database::commands::get_query_history,
            database::commands::get_database_schema,
            database::commands::save_script,
            database::commands::update_script,
            database::commands::get_scripts,
            database::commands::delete_script,
            database::commands::save_session_state,
            database::commands::get_session_state,
            database::commands::get_setting,
            database::commands::set_setting,
            database::commands::get_connection_history,
            // Mutation API commands
            database::commands::update_cell,
            database::commands::delete_rows,
            database::commands::insert_row,
            database::commands::execute_batch,
            database::commands::export_table,
            // Metadata commands
            database::commands::get_database_metadata,
            // Soft delete commands
            database::commands::soft_delete_rows,
            database::commands::undo_soft_delete,
            // Truncate commands
            database::commands::truncate_table,
            database::commands::truncate_database,
            // Dump commands
            database::commands::dump_database,
            // Recent queries/connections
            database::commands::get_recent_queries,
            database::commands::get_recent_connections,
            database::commands::set_connection_pin,
            database::commands::verify_pin_and_get_credentials,
            // Snippet commands
            database::commands::get_snippets,
            database::commands::save_snippet,
            database::commands::update_snippet,
            database::commands::delete_snippet,
            database::commands::seed_system_snippets,
            // Snippet folder commands
            database::commands::get_snippet_folders,
            database::commands::create_snippet_folder,
            database::commands::update_snippet_folder,
            database::commands::delete_snippet_folder,
            // Seeding commands
            database::commands::seed_table,
            // Query Builder commands
            database::commands::parse_sql,
            database::commands::build_sql,
            // Schema Export commands
            database::commands::export_schema_sql,
            database::commands::export_schema_drizzle,
            // AI commands
            database::commands::ai_complete,
            database::commands::ai_set_provider,
            database::commands::ai_get_provider,
            database::commands::ai_set_gemini_key,
            database::commands::ai_configure_ollama,
            database::commands::ai_list_ollama_models,
            // Window commands
            window::commands::minimize_window,
            window::commands::maximize_window,
            window::commands::close_window,
            window::commands::open_sqlite_db,
            window::commands::save_sqlite_db,
            window::commands::open_file,
            // Commands system
            commands_system::get_all_commands,
            commands_system::get_command,
            commands_system::update_command_shortcut,
            commands_system::get_custom_shortcuts,
            // Test queries
            test_queries::populate_test_queries_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
