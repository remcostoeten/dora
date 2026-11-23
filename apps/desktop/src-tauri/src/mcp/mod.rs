pub mod catalog;
pub(crate) mod encode;
mod errors;
mod grants;
mod policy;
mod server;
mod session;
mod state;
mod tools;

use std::{sync::Arc, time::Duration};

use rmcp::{transport::stdio, ServiceExt};

use self::{server::DoraMcpServer, state::McpState};

const EXIT_STORAGE_UNAVAILABLE: i32 = 3;
const EXIT_SERVER_FAILED: i32 = 1;
const IDLE_SWEEP_INTERVAL: Duration = Duration::from_secs(15);

/// @name run_stdio
/// @description Runs the headless MCP server over stdin and stdout until the
/// client closes stdin, and returns the process exit code.
///
/// @example
/// std::process::exit(app_lib::mcp::run_stdio());
pub fn run_stdio() -> i32 {
    crate::observability::init_stderr();

    if rustls::crypto::ring::default_provider()
        .install_default()
        .is_err()
    {
        log::debug!("rustls crypto provider was already installed");
    }

    let state = match McpState::open() {
        Ok(state) => Arc::new(state),
        Err(error) => {
            eprintln!("Dora MCP server could not start: {error}");
            return EXIT_STORAGE_UNAVAILABLE;
        }
    };

    crate::credential_storage::warm_up();
    tauri::async_runtime::block_on(serve(state))
}

async fn serve(state: Arc<McpState>) -> i32 {
    let sweeper_state = Arc::clone(&state);
    let sweeper = tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(IDLE_SWEEP_INTERVAL).await;
            sweeper_state.close_idle_writes().await;
        }
    });

    let service = match DoraMcpServer::new(Arc::clone(&state)).serve(stdio()).await {
        Ok(service) => service,
        Err(error) => {
            log::error!("MCP initialization failed: {error}");
            sweeper.abort();
            return EXIT_SERVER_FAILED;
        }
    };

    let exit_code = match service.waiting().await {
        Ok(_) => 0,
        Err(error) => {
            log::error!("MCP server stopped unexpectedly: {error}");
            EXIT_SERVER_FAILED
        }
    };

    sweeper.abort();
    state.shutdown().await;
    exit_code
}
