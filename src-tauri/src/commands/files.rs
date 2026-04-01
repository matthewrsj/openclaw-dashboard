//! Workspace file access commands.
//!
//! Provides Tauri commands for reading and listing files within
//! agent workspace directories, with path traversal protection.

use serde::Serialize;
use std::path::PathBuf;
use tokio::process::Command;

/// A file or directory entry in an agent workspace.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    /// File or directory name.
    pub name: String,
    /// Entry kind: "file", "directory", or "missing".
    pub kind: String,
    /// File size in bytes (0 for directories and missing files).
    pub size: u64,
}

/// Known safe files at the workspace root that may be displayed.
const ALLOWED_FILES: &[&str] = &[
    "SOUL.md",
    "MEMORY.md",
    "IDENTITY.md",
    "USER.md",
    "AGENTS.md",
    "TOOLS.md",
    "HEARTBEAT.md",
];

/// Known safe directories that may be listed.
const ALLOWED_DIRS: &[&str] = &["memory"];

/// Resolve the workspace path for a given agent.
///
/// Reads from the OpenClaw configuration to find the agent's workspace directory.
///
/// # Errors
///
/// Returns an error if the agent is not found or the path cannot be resolved.
#[tauri::command]
pub async fn get_agent_workspace_path(agent_id: String) -> Result<String, String> {
    // Use CLI to get workspace path (async to avoid blocking tokio runtime)
    let output = Command::new("openclaw")
        .args(["agents", "list", "--json"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute openclaw: {e}"))?;

    if !output.status.success() {
        return Err(format!(
            "openclaw agents list failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let agents: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse agent list: {e}"))?;

    // Search for the agent by ID in the JSON output
    if let Some(agents_arr) = agents.as_array() {
        for agent in agents_arr {
            if agent.get("id").and_then(|v| v.as_str()) == Some(&agent_id) {
                if let Some(workspace) = agent.get("workspace").and_then(|v| v.as_str()) {
                    return Ok(workspace.to_string());
                }
            }
        }
    }

    // Fallback: check common path pattern
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    let fallback = format!("{home}/.openclaw/workspace-{agent_id}");
    if tokio::fs::metadata(&fallback).await.is_ok() {
        return Ok(fallback);
    }

    Err(format!("Agent '{agent_id}' workspace not found"))
}

/// Read a file from an agent's workspace directory.
///
/// Performs path traversal validation to ensure the resolved path
/// stays within the workspace boundary.
///
/// Returns `None` if the file does not exist.
#[tauri::command]
pub async fn read_workspace_file(
    agent_id: String,
    relative_path: String,
) -> Result<Option<String>, String> {
    let workspace = get_agent_workspace_path(agent_id).await?;
    let full_path = PathBuf::from(&workspace).join(&relative_path);

    // Security: canonicalize and verify the path is within the workspace
    let canonical = match tokio::fs::canonicalize(&full_path).await {
        Ok(p) => p,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(format!("Path resolution error: {e}")),
    };

    let workspace_canonical = tokio::fs::canonicalize(&workspace)
        .await
        .map_err(|e| format!("Workspace path error: {e}"))?;

    if !canonical.starts_with(&workspace_canonical) {
        return Err("Path traversal denied".to_string());
    }

    match tokio::fs::read_to_string(&canonical).await {
        Ok(content) => Ok(Some(content)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("File read error: {e}")),
    }
}

/// List files and directories in an agent's workspace.
///
/// At the root level, returns only known safe files and directories.
/// Within allowed directories, returns all `.md` files.
#[tauri::command]
pub async fn list_workspace_files(
    agent_id: String,
    relative_path: String,
) -> Result<Vec<FileEntry>, String> {
    let workspace = get_agent_workspace_path(agent_id).await?;
    let mut entries = Vec::new();

    if relative_path.is_empty() || relative_path == "." {
        // Root level: show curated list
        for file in ALLOWED_FILES {
            let path = PathBuf::from(&workspace).join(file);
            let (kind, size) = match tokio::fs::metadata(&path).await {
                Ok(meta) => ("file".to_string(), meta.len()),
                Err(_) => ("missing".to_string(), 0),
            };
            entries.push(FileEntry {
                name: file.to_string(),
                kind,
                size,
            });
        }
        for dir in ALLOWED_DIRS {
            let path = PathBuf::from(&workspace).join(dir);
            let kind = match tokio::fs::metadata(&path).await {
                Ok(meta) if meta.is_dir() => "directory",
                _ => "missing",
            };
            entries.push(FileEntry {
                name: dir.to_string(),
                kind: kind.to_string(),
                size: 0,
            });
        }
    } else if ALLOWED_DIRS.contains(&relative_path.as_str()) {
        // Allowed subdirectory: list .md files
        let dir_path = PathBuf::from(&workspace).join(&relative_path);
        if tokio::fs::metadata(&dir_path).await.map(|m| m.is_dir()).unwrap_or(false) {
            let mut read_dir = tokio::fs::read_dir(&dir_path)
                .await
                .map_err(|e| format!("Read dir error: {e}"))?;

            while let Some(entry) = read_dir.next_entry().await.map_err(|e| format!("Dir entry error: {e}"))? {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".md") {
                    let size = entry.metadata().await.map(|m| m.len()).unwrap_or(0);
                    entries.push(FileEntry {
                        name,
                        kind: "file".to_string(),
                        size,
                    });
                }
            }
            entries.sort_by(|a, b| a.name.cmp(&b.name));
        }
    } else {
        return Err(format!("Directory '{}' is not in the allowed list", relative_path));
    }

    Ok(entries)
}
