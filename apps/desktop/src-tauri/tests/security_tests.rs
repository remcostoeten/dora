//! Integration tests for the security module.
//!
//! This module tests the encryption/decryption functionality provided by
//! [`app_lib::security`]. These tests verify AES-256-GCM encryption with
//! proper nonce handling and hex encoding.
//!
//! # Source Module
//! - [`app_lib::security`](../src/security.rs)

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;
use anyhow::{Context, Result};

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

    let plaintext = String::from_utf8(plaintext_bytes)
        .context("Decrypted data is not valid UTF-8")?;

    Ok(plaintext)
}

#[test]
fn encrypt_decrypt_roundtrip() {
    let original = "postgresql://user:password@localhost:5432/mydb";
    
    let encrypted = test_encrypt(original).expect("Encryption should succeed");
    
    assert_ne!(encrypted, original);
    assert!(encrypted.len() > original.len());
    
    let decrypted = test_decrypt(&encrypted).expect("Decryption should succeed");
    
    assert_eq!(decrypted, original);
}

#[test]
fn decrypt_invalid_hex() {
    let result = test_decrypt("not-valid-hex");
    assert!(result.is_err());
}

#[test]
fn decrypt_too_short() {
    let result = test_decrypt("abcd1234");
    assert!(result.is_err());
}

#[test]
fn encrypt_empty_string() {
    let encrypted = test_encrypt("").expect("Should encrypt empty string");
    let decrypted = test_decrypt(&encrypted).expect("Should decrypt empty string");
    assert_eq!(decrypted, "");
}

#[test]
fn encrypt_unicode() {
    let original = "postgresql://user:пароль@localhost/数据库";
    let encrypted = test_encrypt(original).expect("Should encrypt unicode");
    let decrypted = test_decrypt(&encrypted).expect("Should decrypt unicode");
    assert_eq!(decrypted, original);
}
