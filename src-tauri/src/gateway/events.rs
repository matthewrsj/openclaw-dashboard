//! Event dispatch for Gateway WebSocket events.
//!
//! Bridges Gateway push events to the Tauri event system so the React
//! frontend can react to real-time state changes.

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

/// Payload emitted as a `gateway:event` Tauri event.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayEventPayload {
    /// The event type name (e.g., "session.created").
    pub event: String,
    /// The event data payload.
    pub data: Value,
}

/// Payload emitted when the Gateway connection state changes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionEventPayload {
    /// The Gateway URL.
    pub url: String,
}

/// Payload emitted when the Gateway disconnects.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisconnectEventPayload {
    /// Reason for disconnection.
    pub reason: String,
    /// Whether the client will attempt to reconnect.
    pub will_retry: bool,
}

/// Payload emitted before a reconnection attempt.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconnectingEventPayload {
    /// The reconnection attempt number (1-indexed).
    pub attempt: u32,
    /// The delay in milliseconds before the attempt.
    pub delay_ms: u64,
}

/// Emit a Gateway push event to the frontend.
pub fn emit_gateway_event(app: &AppHandle, event: String, data: Value) {
    let payload = GatewayEventPayload { event, data };
    if let Err(e) = app.emit("gateway:event", &payload) {
        log::error!("Failed to emit gateway event: {e}");
    }
}

/// Emit a connection established event.
pub fn emit_connected(app: &AppHandle, url: &str) {
    let payload = ConnectionEventPayload {
        url: url.to_string(),
    };
    if let Err(e) = app.emit("gateway:connected", &payload) {
        log::error!("Failed to emit connected event: {e}");
    }
}

/// Emit a disconnection event.
pub fn emit_disconnected(app: &AppHandle, reason: &str, will_retry: bool) {
    let payload = DisconnectEventPayload {
        reason: reason.to_string(),
        will_retry,
    };
    if let Err(e) = app.emit("gateway:disconnected", &payload) {
        log::error!("Failed to emit disconnected event: {e}");
    }
}

/// Emit a reconnecting event.
pub fn emit_reconnecting(app: &AppHandle, attempt: u32, delay_ms: u64) {
    let payload = ReconnectingEventPayload { attempt, delay_ms };
    if let Err(e) = app.emit("gateway:reconnecting", &payload) {
        log::error!("Failed to emit reconnecting event: {e}");
    }
}
