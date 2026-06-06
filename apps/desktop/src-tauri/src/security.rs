use aes_gcm::aead::rand_core::RngCore;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm,
    Nonce,
};
use anyhow::{Context, Result};
use keyring::Entry;
use std::fs;

use crate::credential_storage;

const SERVICE_NAME: &str = "dora_db_client";
const KEY_NAME: &str = "dora_encryption_key";

fn get_or_create_key() -> Result<[u8; 32]> {
    if !credential_storage::uses_os_keyring() {
        return get_or_create_fallback_key();
    }

    get_or_create_keyring_key()
}

fn get_or_create_keyring_key() -> Result<[u8; 32]> {
    let entry = Entry::new(SERVICE_NAME, KEY_NAME)
        .context("Failed to open OS keyring entry for Dora encryption key")?;

    match entry.get_password() {
        Ok(hex_key) => decode_key_hex(&hex_key).context("Failed to decode stored encryption key"),
        Err(keyring::Error::NoEntry) => {
            let key = Aes256Gcm::generate_key(OsRng);
            let key_bytes: &[u8] = key.as_slice();
            let hex_key = hex::encode(key_bytes);

            if let Err(error) = entry.set_password(&hex_key) {
                log::debug!(
                    "Failed to save Dora encryption key to OS keyring; using local fallback key file: {error}"
                );
                return get_or_create_fallback_key();
            }

            let mut key_arr = [0u8; 32];
            key_arr.copy_from_slice(key_bytes);
            Ok(key_arr)
        }
        Err(error) => {
            log::debug!(
                "OS keyring read failed for Dora encryption key; using local fallback key file: {error}"
            );
            get_or_create_fallback_key()
        }
    }
}

fn decode_key_hex(hex_key: &str) -> Result<[u8; 32]> {
    let key_bytes = hex::decode(hex_key.trim()).context("Failed to decode encryption key")?;
    if key_bytes.len() != 32 {
        anyhow::bail!("Stored key has invalid length");
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&key_bytes);
    Ok(key)
}

fn get_or_create_fallback_key() -> Result<[u8; 32]> {
    let path = credential_storage::fallback_key_path()?;
    if path.exists() {
        let hex_key = fs::read_to_string(&path).with_context(|| {
            format!("Failed to read fallback encryption key: {}", path.display())
        })?;
        return decode_key_hex(&hex_key)
            .with_context(|| format!("Invalid fallback encryption key: {}", path.display()));
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "Failed to create fallback encryption key directory: {}",
                parent.display()
            )
        })?;
    }

    let key = Aes256Gcm::generate_key(OsRng);
    let key_bytes: &[u8] = key.as_slice();
    fs::write(&path, hex::encode(key_bytes)).with_context(|| {
        format!(
            "Failed to write fallback encryption key: {}",
            path.display()
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).with_context(|| {
            format!(
                "Failed to restrict fallback encryption key permissions: {}",
                path.display()
            )
        })?;
    }

    let mut key_arr = [0u8; 32];
    key_arr.copy_from_slice(key_bytes);
    Ok(key_arr)
}

pub fn encrypt(plaintext: &str) -> Result<String> {
    let key = get_or_create_key()?;
    let cipher = Aes256Gcm::new(&key.into());

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

    let mut result = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);

    Ok(hex::encode(result))
}

pub fn decrypt(hex_data: &str) -> Result<String> {
    let data = hex::decode(hex_data).context("Failed to decode hex string")?;

    if data.len() < 12 {
        anyhow::bail!("Data too short to contain nonce");
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = get_or_create_key()?;
    let cipher = Aes256Gcm::new(&key.into());

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

    let plaintext =
        String::from_utf8(plaintext_bytes).context("Decrypted data is not valid UTF-8")?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_encrypt(plaintext: &str) -> Result<String> {
        let key = [42u8; 32];
        let cipher = Aes256Gcm::new(&key.into());

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        let mut result = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        Ok(hex::encode(result))
    }

    fn test_decrypt(hex_data: &str) -> Result<String> {
        let data = hex::decode(hex_data).context("Failed to decode hex string")?;

        if data.len() < 12 {
            anyhow::bail!("Data too short to contain nonce");
        }

        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let key = [42u8; 32];
        let cipher = Aes256Gcm::new(&key.into());

        let plaintext_bytes = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        let plaintext =
            String::from_utf8(plaintext_bytes).context("Decrypted data is not valid UTF-8")?;

        Ok(plaintext)
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = "postgresql://user:password@localhost:5432/mydb";

        let encrypted = test_encrypt(original).expect("Encryption should succeed");

        assert_ne!(encrypted, original);
        assert!(encrypted.len() > original.len());

        let decrypted = test_decrypt(&encrypted).expect("Decryption should succeed");

        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_decrypt_invalid_hex() {
        let result = test_decrypt("not-valid-hex");
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_too_short() {
        let result = test_decrypt("abcd1234");
        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_empty_string() {
        let encrypted = test_encrypt("").expect("Should encrypt empty string");
        let decrypted = test_decrypt(&encrypted).expect("Should decrypt empty string");
        assert_eq!(decrypted, "");
    }

    #[test]
    fn test_encrypt_unicode() {
        let original = "postgresql://user:пароль@localhost/数据库";
        let encrypted = test_encrypt(original).expect("Should encrypt unicode");
        let decrypted = test_decrypt(&encrypted).expect("Should decrypt unicode");
        assert_eq!(decrypted, original);
    }
}
