//! Gateway connection and RPC commands.
//!
//! Provides Tauri commands for establishing/closing the WebSocket
//! connection and making RPC calls to the Gateway.

use crate::gateway::client;
use crate::state::{AppState, ConnectionState, WsCommand};
use serde_json::Value;
use std::sync::Arc;
use tauri::State;

/// Establish a WebSocket connection to the Gateway.
///
/// Spawns a background connection manager task that handles
/// authentication, message routing, and reconnection.
#[tauri::command]
pub fn connect_gateway(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
    url: String,
    token: String,
) -> Result<(), String> {
    let current = state.connection_state.read().clone();
    if current == ConnectionState::Connected
        || current == ConnectionState::Connecting
        || current == ConnectionState::Reconnecting
    {
        // Disconnect existing connection first if reconnecting
        if current == ConnectionState::Reconnecting {
            let ws_tx = state.ws_command_tx.read();
            if let Some(tx) = ws_tx.as_ref() {
                let _ = tx.send(WsCommand::Disconnect);
            }
            drop(ws_tx);
            // Brief delay to let the old loop clean up
            std::thread::sleep(std::time::Duration::from_millis(100));
        } else {
            return Err("Already connected or connecting".to_string());
        }
    }

    // Store credentials in state
    {
        let mut gw_url = state.gateway_url.write();
        *gw_url = Some(url.clone());
        let mut auth = state.auth_token.write();
        *auth = Some(token.clone());
    }

    client::start_connection(app, Arc::clone(&state), url, token);
    Ok(())
}

/// Disconnect from the Gateway WebSocket.
///
/// Sends a close frame and stops the connection manager.
/// Does not attempt reconnection after a manual disconnect.
#[tauri::command]
pub fn disconnect_gateway(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let ws_tx = state.ws_command_tx.read();
    if let Some(tx) = ws_tx.as_ref() {
        tx.send(WsCommand::Disconnect)
            .map_err(|_| "Failed to send disconnect command".to_string())?;
    }
    Ok(())
}

/// Send an RPC call to the Gateway over the WebSocket.
///
/// Blocks until the response is received or a 30-second timeout occurs.
///
/// # Arguments
///
/// * `method` - The RPC method name (e.g., "health", "cron.list")
/// * `params` - Method parameters as a JSON value
#[tauri::command]
pub async fn gateway_rpc(
    state: State<'_, Arc<AppState>>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    client::send_rpc(&state, method, params).await
}

/// Get the current Gateway connection state.
#[tauri::command]
pub fn get_connection_state(state: State<'_, Arc<AppState>>) -> String {
    let conn = state.connection_state.read();
    match *conn {
        ConnectionState::Disconnected => "disconnected".to_string(),
        ConnectionState::Connecting => "connecting".to_string(),
        ConnectionState::Connected => "connected".to_string(),
        ConnectionState::Reconnecting => "reconnecting".to_string(),
    }
}
