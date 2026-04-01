//! OpenClaw Dashboard — Application entry point.
//!
//! This binary entry point delegates to `lib::run()` which configures
//! and starts the Tauri application.

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    env_logger::init();
    openclaw_dashboard_lib::run();
}
