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

/// Cached resolved environment (openclaw path + user PATH).
static RESOLVED_ENV: OnceLock<(String, String)> = OnceLock::new();

/// Resolve the `openclaw` binary path and the user's login
/// shell PATH.
///
/// macOS apps launched from Finder inherit a minimal PATH that
/// excludes common install locations and `node`.  We spawn a
/// login shell once to capture both `which openclaw` and the
/// full `$PATH`, then cache the result.
fn resolve_env() -> &'static (String, String) {
    RESOLVED_ENV.get_or_init(|| {
        // Ask a login shell for both the openclaw path and PATH
        if let Ok(output) = std::process::Command::new("/bin/zsh")
            .args([
                "-lc",
                "echo \"__PATH__=$PATH\"; which openclaw",
            ])
            .output()
        {
            if output.status.success() {
                let stdout =
                    String::from_utf8_lossy(&output.stdout);
                let mut user_path = String::new();
                let mut openclaw = String::new();
                for line in stdout.lines() {
                    if let Some(p) =
                        line.strip_prefix("__PATH__=")
                    {
                        user_path = p.to_string();
                    } else if !line.is_empty()
                        && !line.starts_with("__")
                    {
                        openclaw = line.trim().to_string();
                    }
                }
                if !openclaw.is_empty()
                    && PathBuf::from(&openclaw).is_file()
                {
                    return (openclaw, user_path);
                }
                if !user_path.is_empty() {
                    return (
                        "openclaw".to_string(),
                        user_path,
                    );
                }
            }
        }
        ("openclaw".to_string(), String::new())
    })
}

/// Get the resolved openclaw binary path.
pub fn resolve_openclaw_path() -> &'static str {
    &resolve_env().0
}

/// Get the user's login shell PATH.
pub fn user_path() -> &'static str {
    &resolve_env().1
}

/// Shell metacharacters that must not appear in CLI arguments.
const SHELL_METACHARACTERS: &[char] = &[';', '|', '&', '`', '$', '(', ')', '{', '}', '<', '>', '\n', '\r'];

/// Known safe openclaw subcommands.
const ALLOWED_SUBCOMMANDS: &[&str] = &[
    "acp", "agent", "agents", "approvals", "backup",
    "channels", "completion", "config", "configure", "cron",
    "dashboard", "devices", "directory", "dns", "docs",
    "doctor", "gateway", "health", "help", "hooks", "logs",
    "memory", "message", "models", "node", "nodes", "onboard",
    "pairing", "plugins", "qr", "reset", "sandbox", "secrets",
    "security", "sessions", "setup", "skills", "status",
    "system", "tasks", "tui", "uninstall", "update",
    "version", "webhooks",
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

    let mut cmd = Command::new(resolve_openclaw_path());
    cmd.args(&args);
    let path = user_path();
    if !path.is_empty() {
        cmd.env("PATH", path);
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute openclaw: {e}"))?;

    Ok(CliOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}
