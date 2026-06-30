use std::{
    env,
    ffi::OsStr,
    io::{self, IsTerminal},
    process::Command,
};

const APP_NAME: &str = "Dora";
const TAGLINE: &str = "Native desktop database workbench";
const WEBSITE_URL: &str = "https://doradb.app";
const DOWNLOADS_URL: &str = "https://doradb.app/downloads";
const GITHUB_URL: &str = "https://github.com/remcostoeten/dora";
const ISSUES_URL: &str = "https://github.com/remcostoeten/dora/issues";

pub enum StartupAction {
    RunApp,
    Exit(i32),
}

#[derive(Clone, Copy)]
enum ColorMode {
    Auto,
    Always,
    Never,
}

impl ColorMode {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "auto" => Some(Self::Auto),
            "always" => Some(Self::Always),
            "never" => Some(Self::Never),
            _ => None,
        }
    }
}

pub fn handle_args(args: impl IntoIterator<Item = String>) -> StartupAction {
    let mut color_mode = ColorMode::Auto;
    let mut positional = Vec::new();
    let mut args = args.into_iter();

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--no-color" | "--color=never" => color_mode = ColorMode::Never,
            "--color=always" => color_mode = ColorMode::Always,
            "--color=auto" => color_mode = ColorMode::Auto,
            "--color" => {
                let Some(mode) = args.next() else {
                    print_error("--color requires one of: auto, always, never", false);
                    return StartupAction::Exit(2);
                };
                let Some(parsed) = ColorMode::parse(&mode) else {
                    print_error("--color requires one of: auto, always, never", false);
                    return StartupAction::Exit(2);
                };
                color_mode = parsed;
            }
            _ => positional.push(arg),
        }
    }

    let color = colors_enabled(color_mode);

    if positional.is_empty() {
        return StartupAction::RunApp;
    }

    if positional.len() > 1 {
        print_error(
            &format!(
                "expected at most one CLI option, got: {}",
                positional.join(" ")
            ),
            color,
        );
        return StartupAction::Exit(2);
    }

    match positional[0].as_str() {
        "-h" | "--help" => {
            print_help(color);
            StartupAction::Exit(0)
        }
        "-v" | "--version" => {
            println!("{} {}", APP_NAME, env!("CARGO_PKG_VERSION"));
            StartupAction::Exit(0)
        }
        "--website" | "--site" => open_named_url("website", WEBSITE_URL, color),
        "--downloads" => open_named_url("downloads page", DOWNLOADS_URL, color),
        "--github" | "--repo" => open_named_url("GitHub repository", GITHUB_URL, color),
        "--issues" => open_named_url("issue tracker", ISSUES_URL, color),
        unknown => {
            print_error(
                &format!("unknown option: {unknown}\nRun `dora --help` for usage."),
                color,
            );
            StartupAction::Exit(2)
        }
    }
}

fn print_help(color: bool) {
    let theme = Theme::new(color);

    println!(
        "{bold}{name}{reset} {dim}{version}{reset}\n{tagline}\n",
        bold = theme.bold,
        name = APP_NAME,
        reset = theme.reset,
        dim = theme.dim,
        version = env!("CARGO_PKG_VERSION"),
        tagline = TAGLINE
    );
    println!("{bold}Usage{reset}", bold = theme.bold, reset = theme.reset);
    println!("  dora");
    println!(
        "  dora {cyan}<option>{reset}\n",
        cyan = theme.cyan,
        reset = theme.reset
    );
    println!(
        "{bold}Options{reset}",
        bold = theme.bold,
        reset = theme.reset
    );
    println!(
        "  {green}-h, --help{reset}        Show this help",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "  {green}-v, --version{reset}     Print version",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--website{reset}     Open the Dora website",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--downloads{reset}   Open the downloads page",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--github{reset}      Open the GitHub repository",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--issues{reset}      Open the issue tracker",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--no-color{reset}    Disable ANSI styling (alias for --color never)",
        green = theme.green,
        reset = theme.reset
    );
    println!(
        "      {green}--color MODE{reset}  Color mode: auto, always, or never\n",
        green = theme.green,
        reset = theme.reset
    );
    println!("{bold}Links{reset}", bold = theme.bold, reset = theme.reset);
    println!(
        "  Website  {cyan}{WEBSITE_URL}{reset}",
        cyan = theme.cyan,
        reset = theme.reset
    );
    println!(
        "  GitHub   {cyan}{GITHUB_URL}{reset}",
        cyan = theme.cyan,
        reset = theme.reset
    );
}

fn open_named_url(name: &str, url: &str, color: bool) -> StartupAction {
    let theme = Theme::new(color);

    match open_url(url) {
        Ok(()) => {
            println!(
                "{green}Opened{reset} {name}: {cyan}{url}{reset}",
                green = theme.green,
                reset = theme.reset,
                cyan = theme.cyan
            );
            StartupAction::Exit(0)
        }
        Err(error) => {
            eprintln!(
                "{yellow}Could not open {name}.{reset} {dim}{error}{reset}",
                yellow = theme.yellow,
                reset = theme.reset,
                dim = theme.dim
            );
            println!("{cyan}{url}{reset}", cyan = theme.cyan, reset = theme.reset);
            StartupAction::Exit(1)
        }
    }
}

fn open_url(url: &str) -> io::Result<()> {
    let mut command = platform_open_command(url);
    let status = command.status()?;

    if status.success() {
        Ok(())
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            format!("browser opener exited with {status}"),
        ))
    }
}

#[cfg(target_os = "macos")]
fn platform_open_command(url: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(url);
    command
}

#[cfg(target_os = "windows")]
fn platform_open_command(url: &str) -> Command {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", url]);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn platform_open_command(url: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(url);
    command
}

fn print_error(message: &str, color: bool) {
    let theme = Theme::new(color);
    eprintln!(
        "{red}error:{reset} {message}",
        red = theme.red,
        reset = theme.reset
    );
}

fn colors_enabled(mode: ColorMode) -> bool {
    match mode {
        ColorMode::Always => true,
        ColorMode::Never => false,
        ColorMode::Auto => {
            env::var_os("NO_COLOR").is_none()
                && env::var_os("TERM").as_deref() != Some(OsStr::new("dumb"))
                && io::stdout().is_terminal()
        }
    }
}

struct Theme {
    bold: &'static str,
    dim: &'static str,
    cyan: &'static str,
    green: &'static str,
    yellow: &'static str,
    red: &'static str,
    reset: &'static str,
}

impl Theme {
    fn new(enabled: bool) -> Self {
        if enabled {
            Self {
                bold: "\x1b[1m",
                dim: "\x1b[2m",
                cyan: "\x1b[36m",
                green: "\x1b[32m",
                yellow: "\x1b[33m",
                red: "\x1b[31m",
                reset: "\x1b[0m",
            }
        } else {
            Self {
                bold: "",
                dim: "",
                cyan: "",
                green: "",
                yellow: "",
                red: "",
                reset: "",
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{handle_args, StartupAction};

    #[test]
    fn no_args_runs_the_desktop_app() {
        assert!(matches!(handle_args([]), StartupAction::RunApp));
    }

    #[test]
    fn help_exits_successfully() {
        assert!(matches!(
            handle_args(["--help".to_string()]),
            StartupAction::Exit(0)
        ));
    }

    #[test]
    fn short_version_exits_successfully() {
        assert!(matches!(
            handle_args(["-v".to_string()]),
            StartupAction::Exit(0)
        ));
    }

    #[test]
    fn unknown_arg_exits_with_usage_error() {
        assert!(matches!(
            handle_args(["--wat".to_string()]),
            StartupAction::Exit(2)
        ));
    }

    #[test]
    fn color_flags_are_not_treated_as_positional() {
        assert!(matches!(
            handle_args(["--color".to_string(), "always".to_string()]),
            StartupAction::RunApp
        ));
        assert!(matches!(
            handle_args(["--color=never".to_string()]),
            StartupAction::RunApp
        ));
        assert!(matches!(
            handle_args(["--no-color".to_string()]),
            StartupAction::RunApp
        ));
    }

    #[test]
    fn color_with_missing_or_invalid_value_errors() {
        assert!(matches!(
            handle_args(["--color".to_string()]),
            StartupAction::Exit(2)
        ));
        assert!(matches!(
            handle_args(["--color".to_string(), "bogus".to_string()]),
            StartupAction::Exit(2)
        ));
    }
}
