//! WebSocket client for the OpenClaw Gateway.
//!
//! Manages the persistent WebSocket connection, handles message routing,
//! and coordinates with the reconnection manager.

use crate::gateway::events;
use crate::gateway::reconnect::ReconnectConfig;
use crate::gateway::rpc::{self, IncomingMessage, RpcRequest};
use crate::state::{AppState, ConnectionState, PendingRpc, WsCommand};

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use zeroize::Zeroize;

/// Start the WebSocket connection manager.
///
/// Spawns a background task that:
/// 1. Connects to the Gateway WebSocket
/// 2. Sends the auth frame
/// 3. Routes incoming messages (RPC responses → pending map, events → Tauri events)
/// 4. Handles reconnection on disconnect
///
/// The connection persists across frontend reloads since it lives in the Rust backend.
pub fn start_connection(app: AppHandle, state: Arc<AppState>, url: String, mut token: String) {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<WsCommand>();
    {
        let mut ws_tx = state.ws_command_tx.write();
        *ws_tx = Some(cmd_tx);
    }

    tauri::async_runtime::spawn(async move {
        connection_loop(app, state, url, &mut token, cmd_rx).await;
        // Ensure token is zeroed even if connection_loop returns early
        token.zeroize();
    });
}

/// Main connection loop with reconnection support.
async fn connection_loop(
    app: AppHandle,
    state: Arc<AppState>,
    url: String,
    token: &mut String,
    mut cmd_rx: mpsc::UnboundedReceiver<WsCommand>,
) {
    let reconnect_config = ReconnectConfig::default();
    let mut attempt: u32 = 0;

    loop {
        // Update state to connecting
        {
            let mut conn = state.connection_state.write();
            *conn = if attempt == 0 {
                ConnectionState::Connecting
            } else {
                ConnectionState::Reconnecting
            };
        }

        if attempt > 0 {
            let delay = reconnect_config.delay_for_attempt(attempt - 1);
            let delay_ms = delay.as_millis() as u64;
            events::emit_reconnecting(&app, attempt, delay_ms);
            log::info!(
                "Reconnecting to Gateway (attempt {attempt}, delay {delay_ms}ms)"
            );
            {
                let mut ra = state.reconnect_attempt.write();
                *ra = attempt;
            }
            tokio::time::sleep(delay).await;
        }

        // Attempt connection
        let ws_url = format!("{url}/ws");
        log::info!("Connecting to Gateway at {ws_url}");

        let connect_result = connect_async(&ws_url).await;
        let (ws_stream, _) = match connect_result {
            Ok(conn) => conn,
            Err(e) => {
                log::error!("WebSocket connection failed: {e}");
                events::emit_disconnected(&app, &format!("Connection failed: {e}"), true);
                attempt += 1;
                continue;
            }
        };

        let (mut write, mut read) = ws_stream.split();

        // Send auth frame
        let auth_frame = serde_json::json!({
            "type": "connect",
            "token": *token
        });
        let mut auth_json = auth_frame.to_string();
        if let Err(e) = write
            .send(Message::Text(auth_json.clone().into()))
            .await
        {
            log::error!("Failed to send auth frame: {e}");
            auth_json.zeroize();
            events::emit_disconnected(&app, &format!("Auth send failed: {e}"), true);
            attempt += 1;
            continue;
        }
        // Zero the auth JSON and token — no longer needed in memory
        auth_json.zeroize();
        token.zeroize();
        // Also zero the token stored in AppState
        {
            let mut auth = state.auth_token.write();
            if let Some(ref mut t) = *auth {
                t.zeroize();
            }
            *auth = None;
        }

        // Mark as connected
        {
            let mut conn = state.connection_state.write();
            *conn = ConnectionState::Connected;
            let mut ra = state.reconnect_attempt.write();
            *ra = 0;
        }
        attempt = 0;
        events::emit_connected(&app, &url);
        log::info!("Connected to Gateway at {url}");

        // Message processing loop
        let disconnected = loop {
            tokio::select! {
                // Incoming WebSocket message
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            handle_incoming_message(&app, &state, &text);
                        }
                        Some(Ok(Message::Ping(data))) => {
                            let _ = write.send(Message::Pong(data)).await;
                        }
                        Some(Ok(Message::Close(_))) => {
                            log::info!("Gateway sent close frame");
                            break true;
                        }
                        Some(Err(e)) => {
                            log::error!("WebSocket error: {e}");
                            break true;
                        }
                        None => {
                            log::info!("WebSocket stream ended");
                            break true;
                        }
                        _ => {}
                    }
                }
                // Outgoing command from Tauri commands
                cmd = cmd_rx.recv() => {
                    match cmd {
                        Some(WsCommand::Send(text)) => {
                            if let Err(e) = write.send(Message::Text(text.into())).await {
                                log::error!("Failed to send WebSocket message: {e}");
                                break true;
                            }
                        }
                        Some(WsCommand::Disconnect) | None => {
                            let _ = write.send(Message::Close(None)).await;
                            break false;
                        }
                    }
                }
            }
        };

        // Clean up pending RPCs
        {
            let mut pending = state.pending_rpcs.write();
            for (_, rpc) in pending.drain() {
                let _ = rpc.sender.send(Err("Disconnected from Gateway".to_string()));
            }
        }

        // Update state
        {
            let mut conn = state.connection_state.write();
            *conn = ConnectionState::Disconnected;
        }

        if disconnected {
            events::emit_disconnected(&app, "Connection lost", true);
            attempt += 1;
            // Continue loop to reconnect
        } else {
            events::emit_disconnected(&app, "Manually disconnected", false);
            break; // User requested disconnect; exit loop
        }
    }
}

/// Handle an incoming WebSocket text message.
fn handle_incoming_message(app: &AppHandle, state: &Arc<AppState>, text: &str) {
    let parsed = match rpc::parse_incoming(text) {
        Some(msg) => msg,
        None => return,
    };

    match parsed {
        IncomingMessage::RpcResponse(response) => {
            let mut pending = state.pending_rpcs.write();
            if let Some(rpc) = pending.remove(&response.id) {
                if let Some(error) = response.error {
                    let _ = rpc
                        .sender
                        .send(Err(error.to_string()));
                } else {
                    let _ = rpc
                        .sender
                        .send(Ok(response.result.unwrap_or(Value::Null)));
                }
            } else {
                log::warn!("Received RPC response for unknown request: {}", response.id);
            }
        }
        IncomingMessage::Event(event) => {
            events::emit_gateway_event(app, event.event, event.data);
        }
    }
}

/// Send an RPC request over the WebSocket and wait for the response.
///
/// Returns the result payload on success, or an error string on failure.
pub async fn send_rpc(
    state: &Arc<AppState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let request = RpcRequest::new(method, params);
    let request_id = request.id.clone();

    let (tx, rx) = oneshot::channel();
    {
        let mut pending = state.pending_rpcs.write();
        pending.insert(request_id.clone(), PendingRpc { sender: tx });
    }

    // Send the request
    let json = serde_json::to_string(&request).map_err(|e| format!("Serialize error: {e}"))?;
    {
        let ws_tx = state.ws_command_tx.read();
        match ws_tx.as_ref() {
            Some(tx) => tx
                .send(WsCommand::Send(json))
                .map_err(|_| "WebSocket not connected".to_string())?,
            None => {
                // Clean up pending RPC
                let mut pending = state.pending_rpcs.write();
                pending.remove(&request_id);
                return Err("WebSocket not connected".to_string());
            }
        }
    }

    // Wait for response with timeout
    match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("RPC channel closed".to_string()),
        Err(_) => {
            let mut pending = state.pending_rpcs.write();
            pending.remove(&request_id);
            Err("RPC request timed out".to_string())
        }
    }
}
