//! Log tailing commands.
//!
//! Provides Tauri commands for reading the last N lines of an agent's log
//! and streaming new lines via Tauri events.

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

/// Payload emitted for each new log line.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLinePayload {
    /// The agent that generated this log line.
    pub agent_id: String,
    /// The log line text.
    pub line: String,
}

/// Managed state for tracking active log tail tasks.
pub struct LogTailState {
    /// Map of agent_id → cancellation token for active tail tasks.
    pub active_tails: Mutex<HashMap<String, CancellationToken>>,
}

impl LogTailState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            active_tails: Mutex::new(HashMap::new()),
        })
    }
}

/// Validate that an agent ID contains only safe characters.
fn validate_agent_id(agent_id: &str) -> Result<(), String> {
    if agent_id.is_empty() {
        return Err("Agent ID cannot be empty".to_string());
    }
    if agent_id.contains(['/', '\\', '.', '\0']) {
        return Err(
            "Agent ID contains forbidden characters".to_string(),
        );
    }
    Ok(())
}

/// Resolve the log file path for an agent.
fn resolve_log_path(agent_id: &str) -> Result<PathBuf, String> {
    validate_agent_id(agent_id)?;
    let home = std::env::var("HOME")
        .map_err(|_| "HOME not set".to_string())?;
    // OpenClaw stores logs at ~/.openclaw/logs/<agent>.log
    let log_path = PathBuf::from(&home)
        .join(".openclaw")
        .join("logs")
        .join(format!("{agent_id}.log"));

    if log_path.exists() {
        return Ok(log_path);
    }

    // Alternative: gateway log
    let gw_log = PathBuf::from(&home)
        .join(".openclaw")
        .join("logs")
        .join("gateway.log");
    if gw_log.exists() {
        return Ok(gw_log);
    }

    Err(format!("Log file not found for agent '{agent_id}'"))
}

/// Read the last N lines from an agent's log file.
///
/// Uses reverse seeking to efficiently read only the tail of the file.
#[tauri::command]
pub async fn tail_log(agent_id: String, lines: u32) -> Result<Vec<String>, String> {
    let log_path = resolve_log_path(&agent_id)?;
    let content = tokio::fs::read_to_string(&log_path)
        .await
        .map_err(|e| format!("Failed to read log: {e}"))?;

    let all_lines: Vec<&str> = content.lines().collect();
    let start = all_lines.len().saturating_sub(lines as usize);
    let result: Vec<String> = all_lines[start..].iter().map(|s| s.to_string()).collect();

    Ok(result)
}

/// Start streaming new log lines via Tauri events.
///
/// Watches the log file for modifications and emits `log:line` events
/// for each new line appended. Cancels any existing tail for the same agent.
#[tauri::command]
pub async fn start_log_tail(
    app: AppHandle,
    agent_id: String,
    log_tail_state: tauri::State<'_, Arc<LogTailState>>,
) -> Result<(), String> {
    let log_path = resolve_log_path(&agent_id)?;

    // Cancel any existing tail for this agent
    {
        let mut tails = log_tail_state.active_tails.lock().await;
        if let Some(token) = tails.remove(&agent_id) {
            token.cancel();
        }
    }

    // Create new cancellation token
    let cancel_token = CancellationToken::new();
    {
        let mut tails = log_tail_state.active_tails.lock().await;
        tails.insert(agent_id.clone(), cancel_token.clone());
    }

    let state_clone = log_tail_state.inner().clone();

    tauri::async_runtime::spawn(async move {
        let file = match std::fs::File::open(&log_path) {
            Ok(f) => f,
            Err(e) => {
                log::error!("Failed to open log file: {e}");
                return;
            }
        };

        let mut reader = BufReader::new(file);
        // Seek to end — only stream new lines
        if let Err(e) = reader.seek(SeekFrom::End(0)) {
            log::error!("Failed to seek log file: {e}");
            return;
        }

        loop {
            tokio::select! {
                _ = cancel_token.cancelled() => {
                    log::info!("Log tail cancelled for agent {}", agent_id);
                    break;
                }
                _ = tokio::time::sleep(std::time::Duration::from_millis(250)) => {
                    // Read any new lines
                    loop {
                        let mut line = String::new();
                        match reader.read_line(&mut line) {
                            Ok(0) => break, // No more data
                            Ok(_) => {
                                let trimmed = line.trim_end().to_string();
                                if !trimmed.is_empty() {
                                    let payload = LogLinePayload {
                                        agent_id: agent_id.clone(),
                                        line: trimmed,
                                    };
                                    if let Err(e) = app.emit("log:line", &payload) {
                                        log::error!("Failed to emit log line: {e}");
                                        // Clean up and exit
                                        let mut tails = state_clone.active_tails.lock().await;
                                        tails.remove(&agent_id);
                                        return;
                                    }
                                }
                            }
                            Err(e) => {
                                log::error!("Error reading log file: {e}");
                                break;
                            }
                        }
                    }
                }
            }
        }

        // Clean up on exit
        let mut tails = state_clone.active_tails.lock().await;
        tails.remove(&agent_id);
    });

    Ok(())
}

/// Stop streaming log lines for an agent.
///
/// Cancels the active tail task for the given agent, freeing resources.
#[tauri::command]
pub async fn stop_log_tail(
    agent_id: String,
    log_tail_state: tauri::State<'_, Arc<LogTailState>>,
) -> Result<(), String> {
    let mut tails = log_tail_state.active_tails.lock().await;
    if let Some(token) = tails.remove(&agent_id) {
        token.cancel();
        log::info!("Stopped log tail for agent '{agent_id}'");
    }
    Ok(())
}
