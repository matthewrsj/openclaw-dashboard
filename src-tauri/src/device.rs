//! Ed25519 device identity for Gateway authentication.
//!
//! Generates and persists an Ed25519 keypair, derives a device fingerprint
//! (SHA-256 of the raw public key bytes), and signs challenge payloads per
//! the Gateway's device-auth protocol.

use base64::engine::general_purpose::STANDARD_NO_PAD as BASE64;
use base64::Engine;
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;

/// Persisted key file format (matches OpenClaw CLI's identity file structure).
#[derive(Serialize, Deserialize)]
struct KeyFile {
    version: u32,
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "publicKeyPem")]
    public_key_pem: String,
    #[serde(rename = "privateKeyPem")]
    private_key_pem: String,
}

/// In-memory device identity with raw key material.
#[derive(Clone)]
pub struct DeviceIdentity {
    pub device_id: String,
    signing_key: SigningKey,
    verifying_key: VerifyingKey,
}

impl DeviceIdentity {
    /// Load or create a device identity from the default path.
    pub fn load_or_create() -> Result<Self, String> {
        let path = Self::default_path();
        if path.exists() {
            Self::load(&path)
        } else {
            let identity = Self::generate();
            identity.save(&path)?;
            Ok(identity)
        }
    }

    /// Default path: ~/.openclaw/dashboard-device-key
    fn default_path() -> PathBuf {
        let home = dirs_next::home_dir().unwrap_or_else(|| PathBuf::from("."));
        home.join(".openclaw").join("dashboard-device-key")
    }

    /// Generate a fresh Ed25519 keypair.
    fn generate() -> Self {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let device_id = Self::fingerprint(&verifying_key);
        Self {
            device_id,
            signing_key,
            verifying_key,
        }
    }

    /// Compute device fingerprint: hex(SHA-256(raw_public_key_bytes)).
    fn fingerprint(verifying_key: &VerifyingKey) -> String {
        let raw = verifying_key.as_bytes();
        let hash = Sha256::digest(raw);
        hex::encode(hash)
    }

    /// Load identity from a JSON key file.
    fn load(path: &PathBuf) -> Result<Self, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read device key file: {e}"))?;
        let key_file: KeyFile = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse device key file: {e}"))?;

        // Extract raw private key from PKCS8 PEM
        let signing_key = Self::signing_key_from_pem(&key_file.private_key_pem)?;
        let verifying_key = signing_key.verifying_key();
        let device_id = Self::fingerprint(&verifying_key);

        Ok(Self {
            device_id,
            signing_key,
            verifying_key,
        })
    }

    /// Save identity as a JSON key file (mode 0600).
    fn save(&self, path: &PathBuf) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {e}"))?;
        }

        let key_file = KeyFile {
            version: 1,
            device_id: self.device_id.clone(),
            public_key_pem: self.public_key_pem(),
            private_key_pem: self.private_key_pem(),
        };

        let json = serde_json::to_string_pretty(&key_file)
            .map_err(|e| format!("Failed to serialize key file: {e}"))?;

        fs::write(path, format!("{json}\n"))
            .map_err(|e| format!("Failed to write device key file: {e}"))?;

        // Set file permissions to 0600 (owner read/write only)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            fs::set_permissions(path, perms)
                .map_err(|e| format!("Failed to set key file permissions: {e}"))?;
        }

        Ok(())
    }

    /// Export public key as SPKI PEM (for compatibility with Node.js crypto).
    fn public_key_pem(&self) -> String {
        // Ed25519 SPKI DER = prefix + 32-byte raw public key
        let spki_prefix: [u8; 12] = [
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
        ];
        let mut der = Vec::with_capacity(44);
        der.extend_from_slice(&spki_prefix);
        der.extend_from_slice(self.verifying_key.as_bytes());

        let b64 = BASE64.encode(&der);
        // Format as PEM with 64-char line wrapping
        let lines: Vec<&str> = b64.as_bytes().chunks(64).map(|c| std::str::from_utf8(c).unwrap()).collect();
        format!(
            "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----\n",
            lines.join("\n")
        )
    }

    /// Export private key as PKCS8 PEM (for compatibility with Node.js crypto).
    fn private_key_pem(&self) -> String {
        // Ed25519 PKCS8 DER structure:
        // SEQUENCE {
        //   INTEGER 0 (version)
        //   SEQUENCE { OID 1.3.101.112 }
        //   OCTET STRING { OCTET STRING { 32-byte private key } }
        // }
        let pkcs8_prefix: [u8; 16] = [
            0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
            0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
        ];
        let mut der = Vec::with_capacity(48);
        der.extend_from_slice(&pkcs8_prefix);
        der.extend_from_slice(self.signing_key.as_bytes());

        let b64 = BASE64.encode(&der);
        let lines: Vec<&str> = b64.as_bytes().chunks(64).map(|c| std::str::from_utf8(c).unwrap()).collect();
        format!(
            "-----BEGIN PRIVATE KEY-----\n{}\n-----END PRIVATE KEY-----\n",
            lines.join("\n")
        )
    }

    /// Parse a signing key from a PKCS8 PEM string.
    fn signing_key_from_pem(pem: &str) -> Result<SigningKey, String> {
        let b64: String = pem
            .lines()
            .filter(|l| !l.starts_with("-----"))
            .collect::<Vec<_>>()
            .join("");
        let der = BASE64.decode(&b64)
            .map_err(|e| format!("Failed to decode PEM base64: {e}"))?;

        // PKCS8 prefix is 16 bytes, followed by 32-byte private key
        if der.len() < 48 {
            return Err(format!("Invalid PKCS8 DER length: {}", der.len()));
        }
        let key_bytes: [u8; 32] = der[16..48]
            .try_into()
            .map_err(|_| "Failed to extract 32-byte key from PKCS8".to_string())?;

        Ok(SigningKey::from_bytes(&key_bytes))
    }

    /// Raw public key bytes as base64url (no padding), for the `device.publicKey` field.
    pub fn public_key_base64url(&self) -> String {
        base64url_encode(self.verifying_key.as_bytes())
    }

    /// Build the v3 signature payload and sign it.
    ///
    /// v3 format: `v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily`
    pub fn sign_challenge(
        &self,
        client_id: &str,
        client_mode: &str,
        role: &str,
        scopes: &[&str],
        token: &str,
        nonce: &str,
        signed_at_ms: u64,
        platform: &str,
        device_family: Option<&str>,
    ) -> String {
        let scopes_csv = scopes.join(",");
        let norm_platform = platform.trim().to_lowercase();
        let norm_family = device_family
            .map(|f| f.trim().to_lowercase())
            .unwrap_or_default();

        let payload = format!(
            "v3|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}",
            self.device_id,
            client_id,
            client_mode,
            role,
            scopes_csv,
            signed_at_ms,
            token,
            nonce,
            norm_platform,
            norm_family,
        );

        let signature = self.signing_key.sign(payload.as_bytes());
        base64url_encode(&signature.to_bytes())
    }
}

/// Base64url encode (no padding) — matches Gateway's base64UrlEncode.
fn base64url_encode(data: &[u8]) -> String {
    BASE64
        .encode(data)
        .replace('+', "-")
        .replace('/', "_")
}
