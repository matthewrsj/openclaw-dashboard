//! macOS Keychain integration for secure bearer token storage.
//!
//! Uses the `security-framework` crate to interact with the macOS Security
//! framework directly, storing the Gateway bearer token in the login keychain.

use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

/// The keychain service name used to identify our stored token.
const SERVICE_NAME: &str = "ai.openclaw.dashboard";
/// The keychain account name for the bearer token.
const ACCOUNT_NAME: &str = "gateway-token";

/// Retrieve the bearer token from the macOS Keychain.
///
/// Returns `Ok(Some(token))` if found, `Ok(None)` if not found,
/// or `Err` on keychain access failure.
pub fn get_token() -> Result<Option<String>, String> {
    match get_generic_password(SERVICE_NAME, ACCOUNT_NAME) {
        Ok(bytes) => {
            let token =
                String::from_utf8(bytes.to_vec()).map_err(|e| format!("Invalid UTF-8: {e}"))?;
            Ok(Some(token))
        }
        Err(e) => {
            // errSecItemNotFound (-25300) means no token stored
            let code = e.code();
            if code == -25300 {
                Ok(None)
            } else {
                Err(format!("Keychain read error (code {code}): {e}"))
            }
        }
    }
}

/// Store the bearer token in the macOS Keychain.
///
/// Overwrites any existing token for this service/account pair.
pub fn set_token(token: &str) -> Result<(), String> {
    // Delete existing first (set_generic_password fails if duplicate)
    let _ = delete_generic_password(SERVICE_NAME, ACCOUNT_NAME);
    set_generic_password(SERVICE_NAME, ACCOUNT_NAME, token.as_bytes())
        .map_err(|e| format!("Keychain write error: {e}"))
}

/// Delete the bearer token from the macOS Keychain.
///
/// Returns `Ok(())` even if no token was stored.
pub fn delete_token() -> Result<(), String> {
    match delete_generic_password(SERVICE_NAME, ACCOUNT_NAME) {
        Ok(()) => Ok(()),
        Err(e) => {
            let code = e.code();
            if code == -25300 {
                // Not found — nothing to delete
                Ok(())
            } else {
                Err(format!("Keychain delete error (code {code}): {e}"))
            }
        }
    }
}
