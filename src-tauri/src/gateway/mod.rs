//! Gateway WebSocket client module.
//!
//! Manages the persistent WebSocket connection to the OpenClaw Gateway,
//! including authentication, RPC request/response tracking, event dispatch,
//! and automatic reconnection with exponential backoff.

pub mod client;
pub mod events;
pub mod reconnect;
pub mod rpc;
