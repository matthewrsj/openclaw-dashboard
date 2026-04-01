//! Keychain-backed authentication commands.
//!
//! Provides Tauri commands for storing, retrieving, and deleting
//! the Gateway bearer token from the macOS Keychain.

use crate::keychain;

/// Retrieve the bearer token from the macOS Keychain.
///
/// Returns `None` if no token has been stored.
#[tauri::command]
pub fn get_token() -> Result<Option<String>, String> {
    keychain::get_token()
}

/// Store a bearer token in the macOS Keychain.
///
/// Overwrites any previously stored token.
#[tauri::command]
pub fn set_token(token: String) -> Result<(), String> {
    keychain::set_token(&token)
}

/// Delete the bearer token from the macOS Keychain.
///
/// No-op if no token is currently stored.
#[tauri::command]
pub fn delete_token() -> Result<(), String> {
    keychain::delete_token()
}
