use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce, // Or `Aes128Gcm`
};
use anyhow::{Context, Result};
use keyring::Entry;
use aes_gcm::aead::rand_core::RngCore;

const SERVICE_NAME: &str = "dora_db_client";
const KEY_NAME: &str = "dora_encryption_key";

fn get_or_create_key() -> Result<[u8; 32]> {
    let entry = Entry::new(SERVICE_NAME, KEY_NAME).context("Failed to create keyring entry")?;

    match entry.get_password() {
        Ok(hex_key) => {
            let key_bytes = hex::decode(hex_key).context("Failed to decode stored encryption key")?;
            if key_bytes.len() != 32 {
                anyhow::bail!("Stored key has invalid length");
            }
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes);
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            // Generate new key
            let key = Aes256Gcm::generate_key(OsRng);
            let key_bytes: &[u8] = key.as_slice();
            let hex_key = hex::encode(key_bytes);
            entry
                .set_password(&hex_key)
                .context("Failed to save new encryption key to keyring")?;
            
            let mut key_arr = [0u8; 32];
            key_arr.copy_from_slice(key_bytes);
            Ok(key_arr)
        }
        Err(e) => Err(anyhow::anyhow!("Keyring error: {}", e)),
    }
}

pub fn encrypt(plaintext: &str) -> Result<String> {
    let key = get_or_create_key()?;
    let cipher = Aes256Gcm::new(&key.into());
    
    // 96-bit (12-byte) nonce is standard for GCM
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

    // Format: hex(nonce) + hex(ciphertext)
    // Nonce is required for decryption
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

    let plaintext = String::from_utf8(plaintext_bytes)
        .context("Decrypted data is not valid UTF-8")?;

    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to encrypt/decrypt with a fixed test key (not using keyring)
    fn test_encrypt(plaintext: &str) -> Result<String> {
        let key = [42u8; 32]; // Fixed test key
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

        let key = [42u8; 32]; // Same fixed test key
        let cipher = Aes256Gcm::new(&key.into());

        let plaintext_bytes = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        let plaintext = String::from_utf8(plaintext_bytes)
            .context("Decrypted data is not valid UTF-8")?;

        Ok(plaintext)
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = "postgresql://user:password@localhost:5432/mydb";
        
        let encrypted = test_encrypt(original).expect("Encryption should succeed");
        
        // Verify it's actually encrypted (not plaintext)
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
        let result = test_decrypt("abcd1234"); // Valid hex but too short
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
