//! Picks the GTK backend and the WebKitGTK rendering path on Linux.
//!
//! WebKitGTK reads its rendering configuration from environment variables once,
//! when the toolkit starts, so [`configure`] has to run at process entry before
//! any thread or GTK code exists.
//!
//! Three paths exist, and they differ a lot in frame rate:
//!
//! - [`Renderer::Software`]: X11 backend, DMA-BUF renderer disabled. WebKit
//!   rasterizes and composites on the CPU. Works everywhere, but every animated
//!   frame repaints its damaged area on the main thread.
//! - [`Renderer::GpuShm`]: X11 backend, GPU compositing, finished frames read
//!   back into shared memory. Avoids the GBM buffer allocation that fails on
//!   NVIDIA drivers, at the cost of one full-frame copy per frame.
//! - [`Renderer::GpuWayland`]: native Wayland, GPU compositing, frames shared
//!   as DMA-BUFs without a copy.
//!
//! `DORA_RENDERER=software|gpu|wayland|auto` overrides the choice. A GPU path
//! picked automatically is on probation until the frontend reports its first
//! painted frame: a launch that never paints falls back to software rendering.

use std::{
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    time::Duration,
};

const RENDERER_ENV: &str = "DORA_RENDERER";
/// Names of the variables a parent Dora process set, so a relaunched child does
/// not mistake them for the user's own configuration.
const MANAGED_ENV: &str = "DORA_RENDERER_MANAGED";
const GDK_BACKEND: &str = "GDK_BACKEND";
const DISABLE_DMABUF: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
const FORCE_SHM: &str = "WEBKIT_DMABUF_RENDERER_FORCE_SHM";
const NVIDIA_EXPLICIT_SYNC: &str = "__NV_DISABLE_EXPLICIT_SYNC";

const PENDING_MARKER: &str = "renderer-pending";
const FAILED_MARKER: &str = "renderer-failed";
/// Unconfirmed GPU launches tolerated before giving up on the GPU path. One is
/// forgiven because quitting during boot looks the same as a failed launch.
const MAX_UNCONFIRMED_LAUNCHES: u32 = 2;
const FIRST_PAINT_TIMEOUT: Duration = Duration::from_secs(20);
/// Largest display, in device pixels, on which the shared-memory GPU path still
/// holds the display rate. Above this the per-frame copy halves the frame rate.
const SHM_MAX_DISPLAY_PIXELS: u64 = 2560 * 1600;

/// Frontend event that reports the first painted frame.
pub const FIRST_PAINT_EVENT: &str = "renderer-ready";

static APPLIED: OnceLock<Applied> = OnceLock::new();
static FIRST_PAINT_CONFIRMED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Renderer {
    Software,
    GpuShm,
    GpuWayland,
}

impl Renderer {
    fn parse(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "software" | "cpu" => Some(Self::Software),
            "gpu" | "shm" | "gpu-shm" => Some(Self::GpuShm),
            "wayland" | "gpu-wayland" => Some(Self::GpuWayland),
            _ => None,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Software => "software",
            Self::GpuShm => "gpu-shm",
            Self::GpuWayland => "gpu-wayland",
        }
    }
}

/// Everything the choice depends on, gathered without touching GTK.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct Facts {
    requested: Option<String>,
    gdk_backend: Option<String>,
    dmabuf_variable_set: bool,
    wayland_session: bool,
    nvidia_driver: bool,
    sandboxed: bool,
    largest_display_pixels: Option<u64>,
    gpu_failed_for_this_version: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Plan {
    /// `None` leaves WebKit's renderer variables exactly as the environment has them.
    renderer: Option<Renderer>,
    /// A GPU path picked without being asked for is on probation.
    on_probation: bool,
    reason: &'static str,
}

#[derive(Debug)]
struct Applied {
    plan: Plan,
    managed: Vec<&'static str>,
    state_dir: Option<PathBuf>,
}

fn choose(facts: &Facts) -> Plan {
    if let Some(requested) = facts.requested.as_deref() {
        if let Some(renderer) = Renderer::parse(requested) {
            let renderer = match renderer {
                Renderer::GpuWayland if !facts.wayland_session => Renderer::GpuShm,
                other => other,
            };
            return Plan {
                renderer: Some(renderer),
                on_probation: false,
                reason: "DORA_RENDERER",
            };
        }
    }

    if facts.dmabuf_variable_set {
        return Plan {
            renderer: None,
            on_probation: false,
            reason: "WEBKIT_DISABLE_DMABUF_RENDERER is set in the environment",
        };
    }

    if facts.sandboxed {
        return software("sandboxed package");
    }

    if facts.gpu_failed_for_this_version {
        return software("an earlier GPU launch never painted");
    }

    match facts.gdk_backend.as_deref() {
        Some(backend) if backend.starts_with("wayland") => {
            return probation(Renderer::GpuWayland, "GDK_BACKEND selects Wayland");
        }
        Some(_) => return shm_if_display_fits(facts),
        None => {}
    }

    if facts.wayland_session {
        return probation(Renderer::GpuWayland, "Wayland session");
    }

    shm_if_display_fits(facts)
}

fn shm_if_display_fits(facts: &Facts) -> Plan {
    match facts.largest_display_pixels {
        Some(pixels) if pixels <= SHM_MAX_DISPLAY_PIXELS => {
            probation(Renderer::GpuShm, "display fits the shared-memory GPU path")
        }
        Some(_) => software("display too large for the shared-memory GPU path"),
        None => software("display size unknown"),
    }
}

fn software(reason: &'static str) -> Plan {
    Plan {
        renderer: Some(Renderer::Software),
        on_probation: false,
        reason,
    }
}

fn probation(renderer: Renderer, reason: &'static str) -> Plan {
    Plan {
        renderer: Some(renderer),
        on_probation: true,
        reason,
    }
}

/// The variables a plan needs, as `(name, value)`. A variable the environment
/// already defines is never overwritten, except that software rendering always
/// disables the DMA-BUF renderer.
fn variables(plan: &Plan, facts: &Facts) -> Vec<(&'static str, &'static str)> {
    let mut wanted = Vec::new();
    match plan.renderer {
        None | Some(Renderer::Software) | Some(Renderer::GpuShm) => {
            wanted.push((GDK_BACKEND, "x11"));
        }
        Some(Renderer::GpuWayland) => wanted.push((GDK_BACKEND, "wayland,x11")),
    }
    match plan.renderer {
        Some(Renderer::Software) => wanted.push((DISABLE_DMABUF, "1")),
        Some(Renderer::GpuShm) => wanted.push((FORCE_SHM, "1")),
        Some(Renderer::GpuWayland) if facts.nvidia_driver => {
            wanted.push((NVIDIA_EXPLICIT_SYNC, "1"));
        }
        Some(Renderer::GpuWayland) | None => {}
    }
    wanted
}

/// Decides and applies the rendering path. Must be the first thing the process
/// does: it mutates the environment, which is only sound while single threaded.
pub fn configure() {
    drop_inherited_variables();

    let state_dir = dirs::config_dir().map(|dir| dir.join("dora"));
    let mut facts = gather_facts();
    if let Some(dir) = state_dir.as_deref() {
        facts.gpu_failed_for_this_version = settle_previous_launch(dir);
    }

    let plan = choose(&facts);
    let mut managed = Vec::new();
    for (name, value) in variables(&plan, &facts) {
        if std::env::var_os(name).is_none() {
            std::env::set_var(name, value);
            managed.push(name);
        }
    }
    if !managed.is_empty() {
        std::env::set_var(MANAGED_ENV, managed.join(","));
    }

    if plan.on_probation {
        if let Some(dir) = state_dir.as_deref() {
            note_unconfirmed_launch(dir);
        }
    }

    let _ = APPLIED.set(Applied {
        plan,
        managed,
        state_dir,
    });
}

/// Logs the decision. Separate from [`configure`] because logging starts later.
pub fn log_decision() {
    let Some(applied) = APPLIED.get() else {
        return;
    };
    let renderer = applied
        .plan
        .renderer
        .map_or("environment", Renderer::as_str);
    log::info!(
        "Linux renderer: {renderer} ({}), GDK_BACKEND={:?}",
        applied.plan.reason,
        std::env::var_os(GDK_BACKEND).unwrap_or_default()
    );
}

/// Turns off WebKit's animated wheel scrolling under software rendering. Each
/// notch otherwise plays an animation whose every frame repaints the scrolled
/// area on the CPU, which delays the first movement and looks choppy.
pub fn tune_webview(window: &tauri::WebviewWindow) {
    let software = std::env::var_os(DISABLE_DMABUF).is_some_and(|value| value != "0");
    if !software {
        return;
    }
    let tuned = window.with_webview(|webview| {
        use webkit2gtk::{SettingsExt, WebViewExt};
        if let Some(settings) = webview.inner().settings() {
            settings.set_enable_smooth_scrolling(false);
        }
    });
    if let Err(error) = tuned {
        log::warn!("Could not tune the webview for software rendering: {error}");
    }
}

/// Called when the frontend reports its first painted frame.
pub fn confirm_first_paint() {
    if FIRST_PAINT_CONFIRMED.swap(true, Ordering::SeqCst) {
        return;
    }
    let Some(applied) = APPLIED.get() else {
        return;
    };
    if let Some(dir) = applied.state_dir.as_deref() {
        let _ = fs::remove_file(dir.join(PENDING_MARKER));
    }
}

/// Restarts into software rendering when a GPU path on probation has not
/// painted a frame in time. A window that stays blank is worse than a slow one.
pub fn watch_first_paint(app: tauri::AppHandle) {
    let Some(applied) = APPLIED.get() else {
        return;
    };
    if !applied.plan.on_probation || cfg!(debug_assertions) {
        return;
    }

    std::thread::spawn(move || {
        std::thread::sleep(FIRST_PAINT_TIMEOUT);
        if FIRST_PAINT_CONFIRMED.load(Ordering::SeqCst) {
            return;
        }
        log::error!(
            "No frame painted within {}s on the GPU renderer, restarting with software rendering",
            FIRST_PAINT_TIMEOUT.as_secs()
        );
        if let Some(dir) = applied.state_dir.as_deref() {
            mark_gpu_failed(dir);
        }
        for name in &applied.managed {
            std::env::remove_var(name);
        }
        std::env::remove_var(MANAGED_ENV);
        std::env::set_var(RENDERER_ENV, Renderer::Software.as_str());
        app.restart();
    });
}

fn drop_inherited_variables() {
    let Some(inherited) = std::env::var_os(MANAGED_ENV) else {
        return;
    };
    for name in inherited.to_string_lossy().split(',') {
        if [GDK_BACKEND, DISABLE_DMABUF, FORCE_SHM, NVIDIA_EXPLICIT_SYNC].contains(&name) {
            std::env::remove_var(name);
        }
    }
    std::env::remove_var(MANAGED_ENV);
}

fn gather_facts() -> Facts {
    Facts {
        requested: non_empty(RENDERER_ENV),
        gdk_backend: non_empty(GDK_BACKEND),
        dmabuf_variable_set: std::env::var_os(DISABLE_DMABUF).is_some(),
        wayland_session: non_empty("WAYLAND_DISPLAY").is_some()
            || non_empty("XDG_SESSION_TYPE").as_deref() == Some("wayland"),
        nvidia_driver: Path::new("/proc/driver/nvidia/version").exists(),
        sandboxed: ["FLATPAK_ID", "SNAP", "APPIMAGE"]
            .iter()
            .any(|name| std::env::var_os(name).is_some())
            || Path::new("/.flatpak-info").exists(),
        largest_display_pixels: largest_display_pixels(Path::new("/sys/class/drm")),
        gpu_failed_for_this_version: false,
    }
}

fn non_empty(name: &str) -> Option<String> {
    std::env::var_os(name)
        .map(OsString::into_string)
        .and_then(Result::ok)
        .filter(|value| !value.trim().is_empty())
}

/// Pixel count of the largest connected display, from the kernel's connector
/// list. The first entry of `modes` is the connector's preferred mode.
fn largest_display_pixels(drm: &Path) -> Option<u64> {
    let connectors = fs::read_dir(drm).ok()?;
    connectors
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|connector| {
            fs::read_to_string(connector.join("status"))
                .is_ok_and(|status| status.trim() == "connected")
        })
        .filter_map(|connector| {
            let modes = fs::read_to_string(connector.join("modes")).ok()?;
            parse_mode(modes.lines().next()?)
        })
        .max()
}

fn parse_mode(mode: &str) -> Option<u64> {
    let (width, height) = mode.trim().split_once('x')?;
    let height = height.trim_end_matches(|c: char| !c.is_ascii_digit());
    Some(width.parse::<u64>().ok()? * height.parse::<u64>().ok()?)
}

/// Reads the markers the previous launch left behind and reports whether the
/// GPU path is ruled out for this version of the app.
fn settle_previous_launch(dir: &Path) -> bool {
    let unconfirmed = fs::read_to_string(dir.join(PENDING_MARKER))
        .ok()
        .and_then(|raw| raw.trim().parse::<u32>().ok())
        .unwrap_or(0);
    if unconfirmed >= MAX_UNCONFIRMED_LAUNCHES {
        mark_gpu_failed(dir);
    }

    match fs::read_to_string(dir.join(FAILED_MARKER)) {
        Ok(version) if version.trim() == env!("CARGO_PKG_VERSION") => true,
        Ok(_) => {
            let _ = fs::remove_file(dir.join(FAILED_MARKER));
            false
        }
        Err(_) => false,
    }
}

fn note_unconfirmed_launch(dir: &Path) {
    let unconfirmed = fs::read_to_string(dir.join(PENDING_MARKER))
        .ok()
        .and_then(|raw| raw.trim().parse::<u32>().ok())
        .unwrap_or(0);
    let _ = fs::create_dir_all(dir);
    let _ = fs::write(dir.join(PENDING_MARKER), (unconfirmed + 1).to_string());
}

fn mark_gpu_failed(dir: &Path) {
    let _ = fs::create_dir_all(dir);
    let _ = fs::write(dir.join(FAILED_MARKER), env!("CARGO_PKG_VERSION"));
    let _ = fs::remove_file(dir.join(PENDING_MARKER));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn facts() -> Facts {
        Facts {
            largest_display_pixels: Some(1920 * 1080),
            ..Facts::default()
        }
    }

    #[test]
    fn explicit_request_wins_over_everything() {
        let plan = choose(&Facts {
            requested: Some("gpu".into()),
            sandboxed: true,
            gpu_failed_for_this_version: true,
            dmabuf_variable_set: true,
            ..facts()
        });
        assert_eq!(plan.renderer, Some(Renderer::GpuShm));
        assert!(!plan.on_probation);
    }

    #[test]
    fn wayland_request_needs_a_wayland_session() {
        let on_x11 = choose(&Facts {
            requested: Some("wayland".into()),
            ..facts()
        });
        assert_eq!(on_x11.renderer, Some(Renderer::GpuShm));

        let on_wayland = choose(&Facts {
            requested: Some("wayland".into()),
            wayland_session: true,
            ..facts()
        });
        assert_eq!(on_wayland.renderer, Some(Renderer::GpuWayland));
    }

    #[test]
    fn unknown_request_falls_through_to_auto() {
        let plan = choose(&Facts {
            requested: Some("auto".into()),
            ..facts()
        });
        assert_eq!(plan.renderer, Some(Renderer::GpuShm));
        assert!(plan.on_probation);
    }

    #[test]
    fn a_dmabuf_variable_from_the_environment_is_left_alone() {
        let plan = choose(&Facts {
            dmabuf_variable_set: true,
            wayland_session: true,
            ..facts()
        });
        assert_eq!(plan.renderer, None);
        assert_eq!(
            variables(&plan, &facts()),
            vec![(GDK_BACKEND, "x11")],
            "the X11 default still applies"
        );
    }

    #[test]
    fn sandboxes_and_failed_launches_use_software() {
        let sandboxed = choose(&Facts {
            sandboxed: true,
            wayland_session: true,
            ..facts()
        });
        assert_eq!(sandboxed.renderer, Some(Renderer::Software));

        let failed = choose(&Facts {
            gpu_failed_for_this_version: true,
            wayland_session: true,
            ..facts()
        });
        assert_eq!(failed.renderer, Some(Renderer::Software));
        assert!(!failed.on_probation);
    }

    #[test]
    fn wayland_sessions_render_natively_on_probation() {
        let plan = choose(&Facts {
            wayland_session: true,
            largest_display_pixels: Some(3840 * 2160),
            ..facts()
        });
        assert_eq!(plan.renderer, Some(Renderer::GpuWayland));
        assert!(plan.on_probation);
    }

    #[test]
    fn x11_sessions_pick_by_display_size() {
        let small = choose(&facts());
        assert_eq!(small.renderer, Some(Renderer::GpuShm));

        let large = choose(&Facts {
            largest_display_pixels: Some(3840 * 2160),
            ..facts()
        });
        assert_eq!(large.renderer, Some(Renderer::Software));

        let unknown = choose(&Facts {
            largest_display_pixels: None,
            ..facts()
        });
        assert_eq!(unknown.renderer, Some(Renderer::Software));
    }

    #[test]
    fn a_forced_x11_backend_never_gets_the_wayland_path() {
        let plan = choose(&Facts {
            gdk_backend: Some("x11".into()),
            wayland_session: true,
            ..facts()
        });
        assert_eq!(plan.renderer, Some(Renderer::GpuShm));
    }

    #[test]
    fn variables_match_the_renderer() {
        let nvidia = Facts {
            nvidia_driver: true,
            ..facts()
        };
        assert_eq!(
            variables(&software("test"), &nvidia),
            vec![(GDK_BACKEND, "x11"), (DISABLE_DMABUF, "1")]
        );
        assert_eq!(
            variables(&probation(Renderer::GpuShm, "test"), &nvidia),
            vec![(GDK_BACKEND, "x11"), (FORCE_SHM, "1")]
        );
        assert_eq!(
            variables(&probation(Renderer::GpuWayland, "test"), &nvidia),
            vec![(GDK_BACKEND, "wayland,x11"), (NVIDIA_EXPLICIT_SYNC, "1")]
        );
        assert_eq!(
            variables(&probation(Renderer::GpuWayland, "test"), &facts()),
            vec![(GDK_BACKEND, "wayland,x11")]
        );
    }

    #[test]
    fn parses_kernel_mode_lines() {
        assert_eq!(parse_mode("3840x2160"), Some(3840 * 2160));
        assert_eq!(parse_mode("1920x1080i\n"), Some(1920 * 1080));
        assert_eq!(parse_mode("garbage"), None);
    }

    #[test]
    fn largest_connected_display_is_found() {
        let dir = tempdir("drm");
        for (name, status, modes) in [
            ("card1-DP-1", "connected", "3840x2160\n1920x1080\n"),
            ("card1-HDMI-A-1", "connected", "2560x1440\n"),
            ("card1-DP-2", "disconnected", ""),
        ] {
            let connector = dir.join(name);
            fs::create_dir_all(&connector).unwrap();
            fs::write(connector.join("status"), status).unwrap();
            fs::write(connector.join("modes"), modes).unwrap();
        }
        fs::create_dir_all(dir.join("version")).unwrap();

        assert_eq!(largest_display_pixels(&dir), Some(3840 * 2160));
        assert_eq!(largest_display_pixels(&dir.join("missing")), None);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn two_unconfirmed_launches_rule_out_the_gpu_until_the_next_version() {
        let dir = tempdir("markers");

        assert!(!settle_previous_launch(&dir));
        note_unconfirmed_launch(&dir);
        assert!(
            !settle_previous_launch(&dir),
            "one unconfirmed launch is forgiven"
        );
        note_unconfirmed_launch(&dir);
        assert!(settle_previous_launch(&dir));
        assert!(!dir.join(PENDING_MARKER).exists());
        assert!(settle_previous_launch(&dir), "the verdict sticks");

        fs::write(dir.join(FAILED_MARKER), "0.0.1-older").unwrap();
        assert!(
            !settle_previous_launch(&dir),
            "a new version tries the GPU again"
        );
        assert!(!dir.join(FAILED_MARKER).exists());
        fs::remove_dir_all(dir).unwrap();
    }

    fn tempdir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "dora-renderer-{label}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}
