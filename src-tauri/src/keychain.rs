//! Secure storage for the Resend API key using the OS-native credential store
//! (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux).

use keyring::Entry;

const SERVICE: &str = "com.resender.app";
const USER: &str = "resend-api-key";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| format!("Keychain unavailable: {e}"))
}

/// Store (or overwrite) the API key in the OS keychain.
pub fn set_api_key(key: &str) -> Result<(), String> {
    entry()?
        .set_password(key)
        .map_err(|e| format!("Failed to store API key: {e}"))
}

/// Read the API key from the keychain, if one has been stored.
pub fn get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(k) => Ok(Some(k)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read API key: {e}")),
    }
}

/// Read the API key, returning a user-facing error if none is configured.
pub fn require_api_key() -> Result<String, String> {
    get_api_key()?
        .filter(|k| !k.is_empty())
        .ok_or_else(|| "No API key configured. Add your Resend API key in Settings.".to_string())
}

/// Remove the API key from the keychain. Succeeds even if nothing was stored.
pub fn delete_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete API key: {e}")),
    }
}
