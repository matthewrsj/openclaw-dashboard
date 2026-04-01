//! RPC request/response tracking for Gateway WebSocket communication.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// An RPC request to send to the Gateway.
///
/// Serializes with `"type": "req"` per the Gateway protocol.
#[derive(Debug, Serialize)]
pub struct RpcRequest {
    /// Frame type — always "req" for requests.
    #[serde(rename = "type")]
    pub msg_type: String,
    /// Unique request identifier.
    pub id: String,
    /// The RPC method name (e.g., "health", "cron.list").
    pub method: String,
    /// Method parameters.
    pub params: Value,
}

impl RpcRequest {
    /// Create a new RPC request with a generated UUID.
    pub fn new(method: String, params: Value) -> Self {
        Self {
            msg_type: "req".to_string(),
            id: Uuid::new_v4().to_string(),
            method,
            params,
        }
    }
}

/// An RPC response received from the Gateway.
///
/// Matches the Gateway protocol: `{type:"res", id, ok, payload|error}`.
#[derive(Debug, Deserialize)]
pub struct RpcResponse {
    /// The request ID this response corresponds to.
    pub id: String,
    /// Whether the request succeeded.
    #[serde(default)]
    pub ok: bool,
    /// The result payload (present on success).
    pub payload: Option<Value>,
    /// Error details (present on failure).
    pub error: Option<Value>,
}

/// A push event from the Gateway (not tied to an RPC request).
#[derive(Debug, Deserialize)]
pub struct GatewayEvent {
    /// Event type name (e.g., "session.created", "agent.status").
    pub event: String,
    /// Event payload data.
    #[serde(alias = "data")]
    pub payload: Value,
}

/// Parsed incoming WebSocket message — either an RPC response or a push event.
#[derive(Debug)]
pub enum IncomingMessage {
    /// Response to a previously sent RPC request.
    RpcResponse(RpcResponse),
    /// Server-pushed event.
    Event(GatewayEvent),
}

/// Parse a raw JSON message from the Gateway into an `IncomingMessage`.
///
/// Uses the `type` field for discrimination: "res" → RPC response, "event" → push event.
/// Falls back to heuristic (id → response, event field → event) for compatibility.
pub fn parse_incoming(text: &str) -> Option<IncomingMessage> {
    let value: Value = serde_json::from_str(text).ok()?;

    let msg_type = value.get("type").and_then(|t| t.as_str()).unwrap_or("");

    match msg_type {
        "res" => {
            let response: RpcResponse = serde_json::from_value(value).ok()?;
            Some(IncomingMessage::RpcResponse(response))
        }
        "event" => {
            let event: GatewayEvent = serde_json::from_value(value).ok()?;
            Some(IncomingMessage::Event(event))
        }
        _ => {
            // Fallback heuristic for backward compatibility
            if value.get("id").is_some() && (value.get("ok").is_some() || value.get("payload").is_some() || value.get("error").is_some()) {
                let response: RpcResponse = serde_json::from_value(value).ok()?;
                Some(IncomingMessage::RpcResponse(response))
            } else if value.get("event").is_some() {
                let event: GatewayEvent = serde_json::from_value(value).ok()?;
                Some(IncomingMessage::Event(event))
            } else {
                log::warn!("Unknown Gateway message format: {text}");
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rpc_request_new_generates_uuid() {
        let req = RpcRequest::new("health".into(), serde_json::json!({}));
        assert_eq!(req.method, "health");
        assert!(!req.id.is_empty());
        // Should be valid UUID v4
        assert!(uuid::Uuid::parse_str(&req.id).is_ok());
    }

    #[test]
    fn rpc_request_serializes_to_json() {
        let req = RpcRequest::new("cron.list".into(), serde_json::json!({"limit": 10}));
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["method"], "cron.list");
        assert_eq!(json["params"]["limit"], 10);
        assert!(json["id"].is_string());
    }

    #[test]
    fn parse_incoming_rpc_response_success() {
        let text = r#"{"id":"req-123","result":{"ok":true}}"#;
        let msg = parse_incoming(text);
        assert!(msg.is_some());
        match msg.unwrap() {
            IncomingMessage::RpcResponse(resp) => {
                assert_eq!(resp.id, "req-123");
                assert!(resp.result.is_some());
                assert!(resp.error.is_none());
            }
            _ => panic!("Expected RpcResponse"),
        }
    }

    #[test]
    fn parse_incoming_rpc_response_error() {
        let text = r#"{"id":"req-456","error":"not found"}"#;
        let msg = parse_incoming(text);
        assert!(msg.is_some());
        match msg.unwrap() {
            IncomingMessage::RpcResponse(resp) => {
                assert_eq!(resp.id, "req-456");
                assert!(resp.error.is_some());
            }
            _ => panic!("Expected RpcResponse"),
        }
    }

    #[test]
    fn parse_incoming_push_event() {
        let text = r#"{"event":"session.created","data":{"agentId":"brokkr","sessionKey":"s1"}}"#;
        let msg = parse_incoming(text);
        assert!(msg.is_some());
        match msg.unwrap() {
            IncomingMessage::Event(event) => {
                assert_eq!(event.event, "session.created");
                assert_eq!(event.data["agentId"], "brokkr");
            }
            _ => panic!("Expected Event"),
        }
    }

    #[test]
    fn parse_incoming_unknown_format_returns_none() {
        let text = r#"{"foo":"bar"}"#;
        assert!(parse_incoming(text).is_none());
    }

    #[test]
    fn parse_incoming_invalid_json_returns_none() {
        assert!(parse_incoming("not json at all").is_none());
    }

    #[test]
    fn parse_incoming_empty_string_returns_none() {
        assert!(parse_incoming("").is_none());
    }

    #[test]
    fn parse_incoming_event_with_complex_data() {
        let text = r#"{
            "event": "cron.run.completed",
            "data": {
                "jobId": "j-1",
                "runId": "r-1",
                "status": "ok",
                "durationMs": 45000,
                "nested": {"a": [1, 2, 3]}
            }
        }"#;
        let msg = parse_incoming(text);
        assert!(msg.is_some());
        match msg.unwrap() {
            IncomingMessage::Event(event) => {
                assert_eq!(event.event, "cron.run.completed");
                assert_eq!(event.data["durationMs"], 45000);
            }
            _ => panic!("Expected Event"),
        }
    }

    #[test]
    fn rpc_response_both_result_and_error_null() {
        let text = r#"{"id":"req-789"}"#;
        let msg = parse_incoming(text);
        assert!(msg.is_some());
        match msg.unwrap() {
            IncomingMessage::RpcResponse(resp) => {
                assert_eq!(resp.id, "req-789");
                assert!(resp.result.is_none());
                assert!(resp.error.is_none());
            }
            _ => panic!("Expected RpcResponse"),
        }
    }
}
