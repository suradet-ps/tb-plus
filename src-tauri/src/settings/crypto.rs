use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use anyhow::{Context, Result};
use base64::Engine;
use aes_gcm::aead::rand_core::RngCore;
use hkdf::Hkdf;
use sha2::Sha256;

const KEY_SIZE: usize = 32;
const NONCE_SIZE: usize = 12;
const CONTEXT: &str = "tb-plus-settings-v1";

pub fn generate_master_key() -> [u8; KEY_SIZE] {
  let mut key = [0u8; KEY_SIZE];
  OsRng.fill_bytes(&mut key);
  key
}

fn derive_key(master_key: &[u8; KEY_SIZE]) -> Key<Aes256Gcm> {
  let hk = Hkdf::<Sha256>::new(None, master_key);
  let mut okm = [0u8; KEY_SIZE];
  hk.expand(CONTEXT.as_bytes(), &mut okm)
    .expect("HKDF expand should succeed");
  *Key::<Aes256Gcm>::from_slice(&okm)
}

pub fn encrypt(master_key: &[u8; KEY_SIZE], plaintext: &str) -> Result<String> {
  let key = derive_key(master_key);
  let cipher = Aes256Gcm::new(&key);
  let mut nonce_bytes = [0u8; NONCE_SIZE];
  OsRng.fill_bytes(&mut nonce_bytes);
  let nonce = Nonce::from_slice(&nonce_bytes);
  let ciphertext = cipher
    .encrypt(nonce, plaintext.as_bytes())
    .map_err(|e| anyhow::anyhow!("encryption failed: {e}"))?;
  let mut packed = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
  packed.extend_from_slice(&nonce_bytes);
  packed.extend_from_slice(&ciphertext);
  Ok(base64::engine::general_purpose::STANDARD.encode(&packed))
}

pub fn decrypt(master_key: &[u8; KEY_SIZE], encoded: &str) -> Result<String> {
  let key = derive_key(master_key);
  let cipher = Aes256Gcm::new(&key);
  let packed = base64::engine::general_purpose::STANDARD
    .decode(encoded)
    .context("invalid base64")?;
  anyhow::ensure!(packed.len() > NONCE_SIZE, "ciphertext too short");
  let (nonce_bytes, ciphertext) = packed.split_at(NONCE_SIZE);
  let nonce = Nonce::from_slice(nonce_bytes);
  let plaintext = cipher
    .decrypt(nonce, ciphertext)
    .map_err(|_| anyhow::anyhow!("decryption failed"))?;
  String::from_utf8(plaintext).context("decrypted data is not valid UTF-8")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_encrypt_decrypt_roundtrip() {
    let key = generate_master_key();
    let original = "my_secret_password_123!";
    let encrypted = encrypt(&key, original).unwrap();
    let decrypted = decrypt(&key, &encrypted).unwrap();
    assert_eq!(original, decrypted);
  }

  #[test]
  fn test_encrypt_produces_different_output_each_time() {
    let key = generate_master_key();
    let a = encrypt(&key, "same_password").unwrap();
    let b = encrypt(&key, "same_password").unwrap();
    assert_ne!(a, b);
  }

  #[test]
  fn test_decrypt_wrong_key_fails() {
    let key1 = generate_master_key();
    let key2 = generate_master_key();
    let encrypted = encrypt(&key1, "secret").unwrap();
    assert!(decrypt(&key2, &encrypted).is_err());
  }

  #[test]
  fn test_decrypt_invalid_base64_fails() {
    let key = generate_master_key();
    assert!(decrypt(&key, "!!!invalid-base64!!!").is_err());
  }

  #[test]
  fn test_decrypt_truncated_ciphertext_fails() {
    let key = generate_master_key();
    assert!(decrypt(&key, "dHJ1bmNhdGVk").is_err());
  }
}
