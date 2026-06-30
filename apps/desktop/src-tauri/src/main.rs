// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cli;

/// Linux WebKit/GTK env vars must be set before any toolkit code runs.
#[cfg(target_os = "linux")]
fn configure_linux_webview_backend() {
    if std::env::var_os("GDK_BACKEND").is_none() {
        // SAFETY: called at process entry before threads or GTK init.
        unsafe { std::env::set_var("GDK_BACKEND", "x11") };
    }
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
    }
}

fn main() {
    match cli::handle_args(std::env::args().skip(1)) {
        cli::StartupAction::RunApp => {}
        cli::StartupAction::Exit(code) => std::process::exit(code),
    }

    #[cfg(target_os = "linux")]
    configure_linux_webview_backend();

    app_lib::run();
}
