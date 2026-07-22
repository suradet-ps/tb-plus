use anyhow::Result;
use encryptman::MasterKey;

pub use encryptman::generate_master_key;

pub fn encrypt(master_key: &MasterKey, plaintext: &str) -> Result<String> {
  encryptman::encrypt(master_key, plaintext)
    .map_err(|e| anyhow::anyhow!("{e}"))
}

pub fn decrypt(master_key: &MasterKey, encoded: &str) -> Result<String> {
  encryptman::decrypt(master_key, encoded)
    .map_err(|e| anyhow::anyhow!("{e}"))
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
