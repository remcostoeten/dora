//! Tracing subscriber bootstrap.
//!
//! Initialises a global `tracing` subscriber for the app. The `log` crate is
//! bridged through `tracing-log` so existing `log::info!`/`log::error!` call
//! sites emit as `tracing` events without a mass find-replace.
//!
//! Filter rules via `RUST_LOG`, e.g. `RUST_LOG=debug,hyper=info bun tauri:dev`.
//! Default filter is `info` for the `app` crate and `warn` elsewhere.

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Must be called exactly once, before `tauri::Builder::default().run()`.
/// Second call is a no-op (returns `Err` from `set_global_default`).
pub fn init() {
    let default_filter = "info,app=debug";
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(default_filter));

    let fmt_layer = fmt::layer()
        .with_target(true)
        .with_thread_ids(false)
        .with_thread_names(false)
        .with_file(false)
        .with_line_number(false);

    let registry = tracing_subscriber::registry().with(filter).with(fmt_layer);

    if registry.try_init().is_ok() {
        // Bridge `log` crate calls into the tracing subscriber. Done after
        // init so tracing's own logs don't trigger re-entrance.
        let _ = tracing_log::LogTracer::init();
    }
}
