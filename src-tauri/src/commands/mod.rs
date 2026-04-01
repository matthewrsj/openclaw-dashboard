//! Tauri command handlers.
//!
//! Each module exposes `#[tauri::command]` functions that are invokable
//! from the React frontend via `invoke()`.

pub mod auth;
pub mod cli;
pub mod files;
pub mod gateway;
pub mod logs;
