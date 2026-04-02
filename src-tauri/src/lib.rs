//! OpenClaw Dashboard — Tauri backend library.
//!
//! This crate provides the Rust backend for the OpenClaw Dashboard desktop
//! application. It manages:
//! - WebSocket connection to the OpenClaw Gateway
//! - macOS Keychain integration for secure token storage
//! - CLI command execution as a fallback for Gateway API gaps
//! - File system access for agent workspace files
//! - System tray lifecycle
//! - Log file tailing

mod commands;
pub mod device;
mod gateway;
mod keychain;
mod state;
mod tray;

use commands::logs::LogTailState;
use state::AppState;

/// Run the Tauri application.
///
/// Registers all plugins, Tauri commands, and managed state,
/// then starts the event loop.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(app_state)
        .manage(LogTailState::new())
        .invoke_handler(tauri::generate_handler![
            commands::auth::get_token,
            commands::auth::set_token,
            commands::auth::delete_token,
            commands::gateway::connect_gateway,
            commands::gateway::disconnect_gateway,
            commands::gateway::gateway_rpc,
            commands::gateway::get_connection_state,
            commands::cli::exec_cli,
            commands::files::get_agent_workspace_path,
            commands::files::read_workspace_file,
            commands::files::write_workspace_file,
            commands::files::list_workspace_files,
            commands::logs::tail_log,
            commands::logs::start_log_tail,
            commands::logs::stop_log_tail,
        ])
        .setup(|app| {
            // Set up system tray
            if let Err(e) = tray::menu::setup_tray(app.handle()) {
                log::error!("Failed to set up system tray: {e}");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
