//! WebSocket client for the OpenClaw Gateway.
//!
//! Manages the persistent WebSocket connection, handles message routing,
//! and coordinates with the reconnection manager.

use crate::gateway::events;
use crate::gateway::reconnect::ReconnectConfig;
use crate::gateway::rpc::{self, IncomingMessage, RpcRequest};
use crate::keychain;
use crate::state::{AppState, ConnectionState, PendingRpc, WsCommand};

use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::{mpsc, oneshot};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;
use zeroize::Zeroize;

/// Start the WebSocket connection manager.
///
/// Spawns a background task that:
/// 1. Connects to the Gateway WebSocket
/// 2. Waits for the connect.challenge event
/// 3. Sends the connect request frame
/// 4. Routes incoming messages (RPC responses → pending map, events → Tauri events)
/// 5. Handles reconnection on disconnect
///
/// The connection persists across frontend reloads since it lives in the Rust backend.
pub fn start_connection(app: AppHandle, state: Arc<AppState>, url: String, token: String) {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<WsCommand>();
    {
        let mut ws_tx = state.ws_command_tx.write();
        *ws_tx = Some(cmd_tx);
    }

    tauri::async_runtime::spawn(async move {
        connection_loop(app, state, url, token, cmd_rx).await;
    });
}

/// Read the bearer token — prefer in-memory state, fall back to Keychain.
fn read_token(state: &Arc<AppState>) -> Option<String> {
    // Try state first
    {
        let auth = state.auth_token.read();
        if let Some(ref t) = *auth {
            if !t.is_empty() {
                return Some(t.clone());
            }
        }
    }
    // Fall back to Keychain
    match keychain::get_token() {
        Ok(Some(t)) if !t.is_empty() => Some(t),
        _ => None,
    }
}

/// Build the connect request frame per the Gateway protocol.
fn build_connect_frame(token: &str, nonce: Option<&str>) -> (String, String) {
    let req_id = Uuid::new_v4().to_string();
    let mut params = serde_json::json!({
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
            "id": "openclaw-dashboard",
            "version": "0.1.0",
            "platform": "macos",
            "mode": "operator"
        },
        "role": "operator",
        "scopes": ["operator.read", "operator.write"],
        "caps": [],
        "commands": [],
        "permissions": {},
        "auth": { "token": token },
        "locale": "en-US",
        "userAgent": "openclaw-dashboard/0.1.0"
    });
    // Include challenge nonce if provided
    if let Some(n) = nonce {
        params["device"] = serde_json::json!({ "nonce": n });
    }
    let frame = serde_json::json!({
        "type": "req",
        "id": req_id,
        "method": "connect",
        "params": params
    });
    (req_id, frame.to_string())
}

/// Main connection loop with reconnection support.
async fn connection_loop(
    app: AppHandle,
    state: Arc<AppState>,
    url: String,
    initial_token: String,
    mut cmd_rx: mpsc::UnboundedReceiver<WsCommand>,
) {
    let reconnect_config = ReconnectConfig::default();
    let mut attempt: u32 = 0;
    // Store the initial token in state (it's already there from connect_gateway,
    // but keep a local copy for the first attempt)
    let mut first_token = Some(initial_token);

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

        // Read token: use first_token on first attempt, then re-read from Keychain
        let token = if let Some(t) = first_token.take() {
            t
        } else {
            match read_token(&state) {
                Some(t) => t,
                None => {
                    log::error!("No token available for reconnection");
                    events::emit_disconnected(&app, "No auth token available", false);
                    break;
                }
            }
        };

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

        // BUG-002: Wait for connect.challenge before sending auth frame
        let nonce: Option<String> = match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            read.next(),
        )
        .await
        {
            Ok(Some(Ok(Message::Text(text)))) => {
                // Parse challenge event
                if let Ok(val) = serde_json::from_str::<Value>(&text) {
                    if val.get("event").and_then(|e| e.as_str()) == Some("connect.challenge") {
                        val.get("payload")
                            .and_then(|p| p.get("nonce"))
                            .and_then(|n| n.as_str())
                            .map(|s| s.to_string())
                    } else {
                        log::warn!("Expected connect.challenge, got: {text}");
                        None
                    }
                } else {
                    log::warn!("Failed to parse challenge frame: {text}");
                    None
                }
            }
            Ok(Some(Ok(Message::Close(frame)))) => {
                let reason = frame
                    .map(|f| f.reason.to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                log::error!("Gateway closed before challenge: {reason}");
                events::emit_disconnected(&app, &format!("Gateway rejected: {reason}"), true);
                attempt += 1;
                continue;
            }
            Ok(Some(Err(e))) => {
                log::error!("WebSocket error waiting for challenge: {e}");
                attempt += 1;
                continue;
            }
            Ok(None) => {
                log::error!("WebSocket closed before challenge");
                attempt += 1;
                continue;
            }
            Err(_) => {
                log::warn!("Timeout waiting for connect.challenge — sending connect frame anyway");
                None
            }
            _ => None,
        };

        // Build and send the connect frame (BUG-001: correct protocol format)
        let (_connect_req_id, connect_json) =
            build_connect_frame(&token, nonce.as_deref());
        if let Err(e) = write
            .send(Message::Text(connect_json.into()))
            .await
        {
            log::error!("Failed to send connect frame: {e}");
            events::emit_disconnected(&app, &format!("Auth send failed: {e}"), true);
            attempt += 1;
            continue;
        }

        // BUG-003: Do NOT zero token here — wait for hello-ok confirmation.
        // Token stays in AppState for potential reconnects.

        // Wait for connect response (hello-ok or error)
        let auth_accepted = match tokio::time::timeout(
            std::time::Duration::from_secs(10),
            read.next(),
        )
        .await
        {
            Ok(Some(Ok(Message::Text(text)))) => {
                if let Ok(val) = serde_json::from_str::<Value>(&text) {
                    let msg_type = val.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    let is_ok = val.get("ok").and_then(|o| o.as_bool()).unwrap_or(false);
                    if msg_type == "res" && is_ok {
                        log::info!("Gateway accepted connection (hello-ok)");
                        true
                    } else if msg_type == "res" && !is_ok {
                        let err = val.get("error").cloned().unwrap_or(Value::Null);
                        log::error!("Gateway rejected connect: {err}");
                        events::emit_disconnected(
                            &app,
                            &format!("Auth rejected: {err}"),
                            true,
                        );
                        false
                    } else {
                        // Might be an event — treat as unexpected but continue
                        log::warn!("Unexpected response to connect: {text}");
                        // Forward to handler and hope for the best
                        handle_incoming_message(&app, &state, &text);
                        true // optimistic
                    }
                } else {
                    log::warn!("Could not parse connect response: {text}");
                    false
                }
            }
            Ok(Some(Ok(Message::Close(frame)))) => {
                let reason = frame
                    .map(|f| f.reason.to_string())
                    .unwrap_or_else(|| "unknown".to_string());
                log::error!("Gateway closed after connect frame: {reason}");
                events::emit_disconnected(&app, &format!("Rejected: {reason}"), true);
                false
            }
            Ok(Some(Err(e))) => {
                log::error!("WebSocket error waiting for hello-ok: {e}");
                false
            }
            Ok(None) => {
                log::error!("WebSocket closed waiting for hello-ok");
                false
            }
            Err(_) => {
                log::error!("Timeout waiting for hello-ok response");
                false
            }
            _ => false,
        };

        if !auth_accepted {
            attempt += 1;
            continue;
        }

        // BUG-003 + BUG-004: Only NOW mark as connected and reset backoff
        {
            let mut conn = state.connection_state.write();
            *conn = ConnectionState::Connected;
            let mut ra = state.reconnect_attempt.write();
            *ra = 0;
        }
        attempt = 0;
        events::emit_connected(&app, &url);
        log::info!("Connected to Gateway at {url}");

        // Now zero the in-memory token copy (connection is confirmed).
        // Keep Keychain token for future reconnects.
        {
            let mut auth = state.auth_token.write();
            if let Some(ref mut t) = *auth {
                t.zeroize();
            }
            *auth = None;
        }

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
                if !response.ok {
                    let err = response
                        .error
                        .map(|e| e.to_string())
                        .unwrap_or_else(|| "Unknown error".to_string());
                    let _ = rpc.sender.send(Err(err));
                } else {
                    let _ = rpc
                        .sender
                        .send(Ok(response.payload.unwrap_or(Value::Null)));
                }
            } else {
                log::warn!("Received RPC response for unknown request: {}", response.id);
            }
        }
        IncomingMessage::Event(event) => {
            events::emit_gateway_event(app, event.event, event.payload);
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
