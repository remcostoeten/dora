// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;

fn main() {
    match cli::handle_args(std::env::args().skip(1)) {
        cli::StartupAction::RunApp => {}
        cli::StartupAction::RunMcpStdio => std::process::exit(app_lib::mcp::run_stdio()),
        cli::StartupAction::Exit(code) => std::process::exit(code),
    }

    #[cfg(target_os = "linux")]
    app_lib::linux_renderer::configure();

    app_lib::run();
}
