//! CLI executor command.
//!
//! Runs `openclaw` CLI commands via Tauri's shell plugin and returns
//! the structured output (stdout, stderr, exit code).

use serde::Serialize;
use std::path::PathBuf;
use std::sync::OnceLock;
use tokio::process::Command;

/// Output from a CLI command execution.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliOutput {
    /// Standard output text.
    pub stdout: String,
    /// Standard error text.
    pub stderr: String,
    /// Process exit code.
    pub exit_code: i32,
}

/// Cached path to the `openclaw` binary.
static OPENCLAW_PATH: OnceLock<String> = OnceLock::new();

/// Resolve the `openclaw` binary path.
///
/// macOS apps launched from Finder inherit a minimal PATH that
/// excludes common install locations.  We ask a login shell for
/// the real PATH, then search well-known locations as a fallback.
pub fn resolve_openclaw_path() -> &'static str {
    OPENCLAW_PATH.get_or_init(|| {
        // Ask a login shell for the full PATH, then use `which`
        if let Ok(output) = std::process::Command::new("/bin/zsh")
            .args(["-lc", "which openclaw"])
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_string();
                if !path.is_empty()
                    && PathBuf::from(&path).is_file()
                {
                    return path;
                }
            }
        }

        // Fallback: check well-known locations
        let mut candidates = Vec::new();
        if let Ok(home) = std::env::var("HOME") {
            let h = PathBuf::from(&home);
            candidates.push(h.join(".npm-global/bin/openclaw"));
            candidates.push(h.join(".cargo/bin/openclaw"));
            candidates.push(h.join(".local/bin/openclaw"));
        }
        candidates.push(PathBuf::from(
            "/usr/local/bin/openclaw",
        ));
        candidates.push(PathBuf::from(
            "/opt/homebrew/bin/openclaw",
        ));

        for c in &candidates {
            if c.is_file() {
                return c.to_string_lossy().into_owned();
            }
        }

        "openclaw".to_string()
    })
}

/// Shell metacharacters that must not appear in CLI arguments.
const SHELL_METACHARACTERS: &[char] = &[';', '|', '&', '`', '$', '(', ')', '{', '}', '<', '>', '\n', '\r'];

/// Known safe openclaw subcommands.
const ALLOWED_SUBCOMMANDS: &[&str] = &[
    "agents", "gateway", "sessions", "cron", "config", "help", "version", "status",
];

/// Validate that CLI arguments don't contain shell metacharacters
/// and the first argument is a known openclaw subcommand.
fn validate_args(args: &[String]) -> Result<(), String> {
    if args.is_empty() {
        return Err("No arguments provided".to_string());
    }

    // Validate first arg is a known subcommand
    let subcommand = &args[0];
    if !ALLOWED_SUBCOMMANDS.contains(&subcommand.as_str()) {
        return Err(format!("Unknown openclaw subcommand: {subcommand}"));
    }

    // Validate no shell metacharacters in any argument
    for (i, arg) in args.iter().enumerate() {
        if arg.contains(SHELL_METACHARACTERS) {
            return Err(format!(
                "Argument {i} contains forbidden shell metacharacter"
            ));
        }
    }

    Ok(())
}

/// Execute an `openclaw` CLI command with the given arguments.
///
/// The command is always `openclaw` — the `args` parameter provides
/// the subcommand and flags (e.g., `["agents", "list", "--json"]`).
///
/// Arguments are validated to prevent shell injection:
/// - First arg must be a known subcommand
/// - No arg may contain shell metacharacters
///
/// Uses `tokio::process::Command` to avoid blocking the async runtime.
///
/// # Errors
///
/// Returns an error string if validation fails or the process cannot be spawned.
#[tauri::command]
pub async fn exec_cli(args: Vec<String>) -> Result<CliOutput, String> {
    validate_args(&args)?;

    let output = Command::new(resolve_openclaw_path())
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute openclaw: {e}"))?;

    Ok(CliOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
