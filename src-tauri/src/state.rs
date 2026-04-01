//! Application-wide managed state for the Tauri backend.
//!
//! Holds the WebSocket connection state, RPC tracking, and agent workspace cache.

use parking_lot::RwLock;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};

/// Connection state for the Gateway WebSocket.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

/// A pending RPC request awaiting a response from the Gateway.
pub struct PendingRpc {
    pub sender: oneshot::Sender<Result<Value, String>>,
}

/// Message sent to the WebSocket manager task.
pub enum WsCommand {
    /// Send a JSON message over the WebSocket.
    Send(String),
    /// Disconnect the WebSocket.
    Disconnect,
}

/// Application state shared across all Tauri commands and the WebSocket manager.
pub struct AppState {
    /// Current WebSocket connection state.
    pub connection_state: RwLock<ConnectionState>,
    /// Gateway URL (e.g., "ws://localhost:18789").
    pub gateway_url: RwLock<Option<String>>,
    /// Bearer token for authentication.
    pub auth_token: RwLock<Option<String>>,
    /// Pending RPC requests keyed by request ID.
    pub pending_rpcs: RwLock<HashMap<String, PendingRpc>>,
    /// Channel to send commands to the WebSocket manager task.
    pub ws_command_tx: RwLock<Option<mpsc::UnboundedSender<WsCommand>>>,
    /// Reconnection attempt counter.
    pub reconnect_attempt: RwLock<u32>,
}

impl AppState {
    /// Create a new default application state.
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            connection_state: RwLock::new(ConnectionState::Disconnected),
            gateway_url: RwLock::new(None),
            auth_token: RwLock::new(None),
            pending_rpcs: RwLock::new(HashMap::new()),
            ws_command_tx: RwLock::new(None),
            reconnect_attempt: RwLock::new(0),
        })
    }
}
