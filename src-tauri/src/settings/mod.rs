pub mod crypto;

use crate::models::settings::{
  AlertConfig, DrugClassEntry, GeocodeConfig, HosxpConfig, PaginationConfig, SplashMessages,
};
use anyhow::Result;
use chrono::Local;
use serde::Serialize;
use serde::de::DeserializeOwned;
use sqlx::SqlitePool;
use std::collections::HashMap;

const KEY_FILENAME: &str = ".tb_key";

pub struct SettingsManager {
  pool: SqlitePool,
  master_key: [u8; 32],
}

#[allow(dead_code)]
impl SettingsManager {
  /// Create a new SettingsManager, loading or generating the master encryption key.
  pub async fn new(pool: SqlitePool, app_data_dir: &std::path::Path) -> Result<Self> {
    let master_key = Self::load_or_create_key(app_data_dir);
    let mgr = Self { pool, master_key };
    mgr.seed_defaults().await?;
    Ok(mgr)
  }

  pub fn master_key(&self) -> &[u8; 32] {
    &self.master_key
  }

  // ── Key management ────────────────────────────────────────────────────────

  fn load_or_create_key(app_data_dir: &std::path::Path) -> [u8; 32] {
    Self::load_or_create_static_key(app_data_dir)
  }

  pub fn load_or_create_static_key(app_data_dir: &std::path::Path) -> [u8; 32] {
    let key_path = app_data_dir.join(KEY_FILENAME);
    if key_path.exists() {
      let raw = std::fs::read(&key_path).unwrap_or_default();
      if raw.len() == 32 {
        let mut key = [0u8; 32];
        key.copy_from_slice(&raw);
        return key;
      }
    }
    let key = crypto::generate_master_key();
    let _ = std::fs::write(&key_path, key);
    key
  }

  // ── Default seeding ───────────────────────────────────────────────────────

  async fn seed_defaults(&self) -> Result<()> {
    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let defaults: Vec<(&str, &str)> = vec![
      // Connection (all 5 encrypted on write; seed with empty placeholders)
      ("mysql.host", ""),
      ("mysql.port", "3306"),
      ("mysql.database", ""),
      ("mysql.username", ""),
      ("mysql.password", ""),
      ("mysql.max_connections", "5"),
      ("mysql.connect_timeout_seconds", "8"),
      // SQLite
      ("sqlite.max_connections", "5"),
      ("sqlite.db_filename", "tb_plus.db"),
    ];

    for (key, value) in &defaults {
      let exists: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
          .bind(key)
          .fetch_optional(&self.pool)
          .await?;
      if exists.is_none() {
        sqlx::query("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
          .bind(key)
          .bind(value)
          .bind(&now)
          .execute(&self.pool)
          .await?;
      }
    }

    // Seed JSON defaults (drug_classes, regimens, staff_names, etc.)
    self
      .seed_json_default("drug_classes", &default_drug_classes(), &now)
      .await?;
    self
      .seed_json_default("regimens", &default_regimens(), &now)
      .await?;
    self
      .seed_json_default("staff_names", &default_staff_names(), &now)
      .await?;
    self
      .seed_json_default("alert", &AlertConfig::default(), &now)
      .await?;
    self
      .seed_json_default("pagination", &PaginationConfig::default(), &now)
      .await?;
    self
      .seed_json_default("hosxp", &HosxpConfig::default(), &now)
      .await?;
    self
      .seed_json_default("geocode", &GeocodeConfig::default(), &now)
      .await?;
    self
      .seed_json_default("splash", &SplashMessages::default(), &now)
      .await?;

    Ok(())
  }

  async fn seed_json_default<T: Serialize>(&self, key: &str, value: &T, now: &str) -> Result<()> {
    let exists: Option<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
      .bind(key)
      .fetch_optional(&self.pool)
      .await?;
    if exists.is_none() {
      let json = serde_json::to_string(value)?;
      sqlx::query("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
        .bind(key)
        .bind(&json)
        .bind(now)
        .execute(&self.pool)
        .await?;
    }
    Ok(())
  }

  // ── Generic getters ───────────────────────────────────────────────────────

  pub async fn get(&self, key: &str) -> Result<Option<String>> {
    let value: Option<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
      .bind(key)
      .fetch_optional(&self.pool)
      .await?;
    Ok(value)
  }

  pub async fn get_string(&self, key: &str, default: &str) -> Result<String> {
    Ok(
      self
        .get(key)
        .await?
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default.to_string()),
    )
  }

  pub async fn get_u32(&self, key: &str, default: u32) -> Result<u32> {
    Ok(
      self
        .get(key)
        .await?
        .and_then(|v| v.parse().ok())
        .unwrap_or(default),
    )
  }

  pub async fn get_u64(&self, key: &str, default: u64) -> Result<u64> {
    Ok(
      self
        .get(key)
        .await?
        .and_then(|v| v.parse().ok())
        .unwrap_or(default),
    )
  }

  pub async fn get_i64(&self, key: &str, default: i64) -> Result<i64> {
    Ok(
      self
        .get(key)
        .await?
        .and_then(|v| v.parse().ok())
        .unwrap_or(default),
    )
  }

  pub async fn get_f64(&self, key: &str, default: f64) -> Result<f64> {
    Ok(
      self
        .get(key)
        .await?
        .and_then(|v| v.parse().ok())
        .unwrap_or(default),
    )
  }

  pub async fn get_json<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
    let raw: Option<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
      .bind(key)
      .fetch_optional(&self.pool)
      .await?;
    match raw {
      Some(json) => Ok(Some(serde_json::from_str(&json)?)),
      None => Ok(None),
    }
  }

  pub async fn get_json_or_default<T: DeserializeOwned + Default>(&self, key: &str) -> Result<T> {
    Ok(self.get_json::<T>(key).await?.unwrap_or_default())
  }

  // ── Encrypted getters/setters ─────────────────────────────────────────────

  pub async fn get_encrypted(&self, key: &str) -> Result<Option<String>> {
    let raw = self.get(key).await?;
    match raw {
      Some(encoded) if !encoded.is_empty() => {
        let decrypted = crypto::decrypt(&self.master_key, &encoded)?;
        Ok(Some(decrypted))
      }
      _ => Ok(None),
    }
  }

  pub async fn set_encrypted(&self, key: &str, plaintext: &str) -> Result<()> {
    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let encoded = crypto::encrypt(&self.master_key, plaintext)?;
    sqlx::query("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(key)
      .bind(&encoded)
      .bind(&now)
      .execute(&self.pool)
      .await?;
    Ok(())
  }

  // ── Setters ───────────────────────────────────────────────────────────────

  pub async fn set(&self, key: &str, value: &str) -> Result<()> {
    let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    sqlx::query("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(key)
      .bind(value)
      .bind(&now)
      .execute(&self.pool)
      .await?;
    Ok(())
  }

  pub async fn set_json<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
    let json = serde_json::to_string(value)?;
    self.set(key, &json).await
  }

  pub async fn delete(&self, key: &str) -> Result<()> {
    sqlx::query("DELETE FROM app_settings WHERE key = ?")
      .bind(key)
      .execute(&self.pool)
      .await?;
    Ok(())
  }

  pub async fn delete_keys(&self, keys: &[&str]) -> Result<()> {
    for key in keys {
      self.delete(key).await?;
    }
    Ok(())
  }

  // ── Typed config loaders ──────────────────────────────────────────────────

  pub async fn get_drug_classes(&self) -> Result<Vec<DrugClassEntry>> {
    Ok(
      self
        .get_json::<Vec<DrugClassEntry>>("drug_classes")
        .await?
        .unwrap_or_else(default_drug_classes),
    )
  }

  /// Build a HashMap from class letter → Vec<icode> from drug_classes config.
  pub async fn build_class_to_icodes(&self) -> Result<HashMap<String, Vec<String>>> {
    let classes = self.get_drug_classes().await?;
    let mut map = HashMap::new();
    for entry in classes {
      map.insert(entry.class.to_uppercase(), entry.icodes);
    }
    Ok(map)
  }

  /// Build a HashMap from icode → class letter from drug_classes config.
  pub async fn build_icode_to_class(&self) -> Result<HashMap<String, String>> {
    let classes = self.get_drug_classes().await?;
    let mut map = HashMap::new();
    for entry in classes {
      let cls = entry.class.to_uppercase();
      for icode in &entry.icodes {
        map.insert(icode.clone(), cls.clone());
      }
    }
    Ok(map)
  }

  /// Collect ALL icodes from drug_classes config.
  pub async fn get_all_tb_icodes(&self) -> Result<Vec<String>> {
    let classes = self.get_drug_classes().await?;
    let mut all = Vec::new();
    for entry in classes {
      all.extend(entry.icodes);
    }
    Ok(all)
  }

  pub async fn get_alert_config(&self) -> Result<AlertConfig> {
    self.get_json_or_default("alert").await
  }

  pub async fn get_pagination_config(&self) -> Result<PaginationConfig> {
    self.get_json_or_default("pagination").await
  }

  pub async fn get_hosxp_config(&self) -> Result<HosxpConfig> {
    self.get_json_or_default("hosxp").await
  }

  pub async fn get_geocode_config(&self) -> Result<GeocodeConfig> {
    self.get_json_or_default("geocode").await
  }

  pub async fn get_splash_messages(&self) -> Result<SplashMessages> {
    self.get_json_or_default("splash").await
  }

  pub async fn get_staff_names(&self) -> Result<Vec<String>> {
    Ok(
      self
        .get_json::<Vec<String>>("staff_names")
        .await?
        .unwrap_or_else(default_staff_names),
    )
  }

  pub async fn get_regimens(&self) -> Result<Vec<String>> {
    Ok(
      self
        .get_json::<Vec<String>>("regimens")
        .await?
        .unwrap_or_else(default_regimens),
    )
  }
}

// ── Default factory functions ────────────────────────────────────────────────

fn default_drug_classes() -> Vec<DrugClassEntry> {
  vec![
    DrugClassEntry {
      class: "H".into(),
      icodes: vec!["1430104".into()],
      name: "Isoniazid".into(),
    },
    DrugClassEntry {
      class: "R".into(),
      icodes: vec!["1000265".into(), "1000264".into()],
      name: "Rifampicin".into(),
    },
    DrugClassEntry {
      class: "E".into(),
      icodes: vec!["1600004".into(), "1000129".into()],
      name: "Ethambutol".into(),
    },
    DrugClassEntry {
      class: "Z".into(),
      icodes: vec!["1000258".into()],
      name: "Pyrazinamide".into(),
    },
  ]
}

fn default_regimens() -> Vec<String> {
  vec!["2HRZE/4HR".into(), "2HRZE/6HR".into()]
}

fn default_staff_names() -> Vec<String> {
  vec!["พยาบาลวิชาชีพ".into(), "เภสัชกร".into(), "แพทย์".into()]
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_default_drug_classes_contains_all_four() {
    let classes = default_drug_classes();
    assert_eq!(classes.len(), 4);
    let letters: Vec<_> = classes.iter().map(|c| c.class.as_str()).collect();
    assert!(letters.contains(&"H"));
    assert!(letters.contains(&"R"));
    assert!(letters.contains(&"E"));
    assert!(letters.contains(&"Z"));
  }

  #[test]
  fn test_default_r_has_two_icodes() {
    let classes = default_drug_classes();
    let r = classes.iter().find(|c| c.class == "R").unwrap();
    assert_eq!(r.icodes.len(), 2);
  }

  #[test]
  fn test_default_e_has_two_icodes() {
    let classes = default_drug_classes();
    let e = classes.iter().find(|c| c.class == "E").unwrap();
    assert_eq!(e.icodes.len(), 2);
  }

  #[test]
  fn test_default_regimens() {
    let r = default_regimens();
    assert!(r.contains(&"2HRZE/4HR".to_string()));
    assert!(r.contains(&"2HRZE/6HR".to_string()));
  }

  #[test]
  fn test_alert_config_defaults() {
    let cfg = AlertConfig::default();
    assert_eq!(cfg.overdue_days, 35);
    assert_eq!(cfg.lost_followup_days, 60);
    assert_eq!(cfg.e_overrun_lookback_days, 30);
    assert_eq!(cfg.phase_transition_lookback_days, 35);
  }

  #[test]
  fn test_pagination_defaults() {
    let cfg = PaginationConfig::default();
    assert_eq!(cfg.default_page_size, 50);
    assert_eq!(cfg.max_page_size, 200);
  }
}
