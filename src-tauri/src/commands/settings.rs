use crate::settings::SettingsManager;
use anyhow::Result as AnyhowResult;
use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlPoolOptions;
use sqlx::{MySqlPool, SqlitePool};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbConfig {
  pub host: String,
  pub port: u16,
  pub database: String,
  pub username: String,
  pub password: String,
  #[serde(default)]
  pub staff_names: Vec<String>,
  #[serde(default)]
  pub regimens: Vec<String>,
}

/// Tauri managed state: an optional live MySQL connection pool.
pub type MySqlState = Arc<Mutex<Option<MySqlPool>>>;

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

/// Test connectivity with a one-shot pool — does not persist the connection.
#[tauri::command]
pub async fn test_mysql_connection(config: DbConfig) -> Result<bool, String> {
  let url = format!(
    "mysql://{}:{}@{}:{}/{}",
    config.username, config.password, config.host, config.port, config.database
  );
  match MySqlPoolOptions::new()
    .max_connections(1)
    .connect(&url)
    .await
  {
    Ok(_) => Ok(true),
    Err(e) => Err(e.to_string()),
  }
}

/// Connect to MySQL and store the live pool in managed state.
#[tauri::command]
pub async fn connect_mysql(
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  config: DbConfig,
) -> Result<(), String> {
  let url = format!(
    "mysql://{}:{}@{}:{}/{}",
    config.username, config.password, config.host, config.port, config.database
  );
  let max_conn = settings
    .get_u32("mysql.max_connections", 5)
    .await
    .map_err(|e| e.to_string())?;
  let pool = MySqlPoolOptions::new()
    .max_connections(max_conn)
    .connect(&url)
    .await
    .map_err(|e| e.to_string())?;
  let mut guard = mysql.lock().await;
  *guard = Some(pool);
  Ok(())
}

/// Return `true` when a live MySQL pool is currently held in managed state.
#[tauri::command]
pub async fn get_mysql_status(mysql: State<'_, MySqlState>) -> Result<bool, String> {
  let guard = mysql.lock().await;
  Ok(guard.is_some())
}

/// Copy the live SQLite database file to the user-selected target path.
#[tauri::command]
pub async fn backup_sqlite(app: tauri::AppHandle, target_path: String) -> Result<(), String> {
  use tauri::Manager;
  let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let source_path = app_data_dir.join("tb_plus.db");
  if !source_path.exists() {
    return Err("ไม่พบไฟล์ฐานข้อมูล SQLite".to_string());
  }
  let target_path = PathBuf::from(target_path);
  if let Some(parent) = target_path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  std::fs::copy(&source_path, &target_path).map_err(|e| e.to_string())?;
  Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent connection settings — stored in SQLite app_settings with encryption
// ─────────────────────────────────────────────────────────────────────────────

/// Persist all connection fields and list settings to SQLite `app_settings`.
/// Every MySQL connection field is encrypted using AES-256-GCM before storage.
#[tauri::command]
pub async fn save_db_config(
  settings: State<'_, SettingsManager>,
  config: DbConfig,
) -> Result<(), String> {
  settings
    .set_encrypted("mysql.host", &config.host)
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_encrypted("mysql.port", &config.port.to_string())
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_encrypted("mysql.database", &config.database)
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_encrypted("mysql.username", &config.username)
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_encrypted("mysql.password", &config.password)
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_json("staff_names", &config.staff_names)
    .await
    .map_err(|e| e.to_string())?;
  settings
    .set_json("regimens", &config.regimens)
    .await
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Load the saved DB config from SQLite app_settings.
/// All five MySQL fields are transparently decrypted.
#[tauri::command]
pub async fn load_db_config(
  settings: State<'_, SettingsManager>,
) -> Result<Option<DbConfig>, String> {
  let host = settings
    .get_encrypted("mysql.host")
    .await
    .map_err(|e| e.to_string())?;
  if host.as_deref().unwrap_or("").is_empty() {
    return Ok(None);
  }

  let port: u16 = settings
    .get_encrypted("mysql.port")
    .await
    .map_err(|e| e.to_string())?
    .and_then(|v| v.parse().ok())
    .unwrap_or(3306);
  let database = settings
    .get_encrypted("mysql.database")
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or_default();
  let username = settings
    .get_encrypted("mysql.username")
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or_default();
  let password = settings
    .get_encrypted("mysql.password")
    .await
    .map_err(|e| e.to_string())?
    .unwrap_or_default();
  let staff_names = settings
    .get_staff_names()
    .await
    .map_err(|e| e.to_string())?;
  let regimens = settings.get_regimens().await.map_err(|e| e.to_string())?;

  Ok(Some(DbConfig {
    host: host.unwrap_or_default(),
    port,
    database,
    username,
    password,
    staff_names,
    regimens,
  }))
}

/// Remove saved config from SQLite.
#[tauri::command]
pub async fn delete_db_config(settings: State<'_, SettingsManager>) -> Result<(), String> {
  let keys = [
    "mysql.host",
    "mysql.port",
    "mysql.database",
    "mysql.username",
    "mysql.password",
    "staff_names",
    "regimens",
  ];
  settings.delete_keys(&keys).await.map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Public helper — used by lib.rs during startup auto-connect
// ─────────────────────────────────────────────────────────────────────────────

/// Read a scalar value from the app_settings table directly.
async fn read_setting(pool: &SqlitePool, key: &str) -> AnyhowResult<Option<String>> {
  let value: Option<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
    .bind(key)
    .fetch_optional(pool)
    .await?;
  Ok(value)
}

/// Read a JSON array from the app_settings table directly.
async fn read_json_setting<T: serde::de::DeserializeOwned>(
  pool: &SqlitePool,
  key: &str,
  default: Vec<T>,
) -> AnyhowResult<Vec<T>> {
  let value: Option<String> = read_setting(pool, key).await?;
  match value {
    Some(raw) => serde_json::from_str(&raw).or(Ok(default)),
    None => Ok(default),
  }
}

/// Read and decrypt an encrypted setting from the SqlitePool.
async fn read_decrypted(
  pool: &SqlitePool,
  key: &str,
  mk: &[u8; 32],
) -> AnyhowResult<Option<String>> {
  let raw = read_setting(pool, key).await?;
  match raw {
    Some(enc) if !enc.is_empty() => Ok(Some(
      crate::settings::crypto::decrypt(mk, &enc).unwrap_or_default(),
    )),
    _ => Ok(None),
  }
}

/// Read the persisted DB config directly from the SqlitePool, bypassing
/// the SettingsManager (needed before SettingsManager is registered).
/// All five MySQL fields are decrypted using the device master key.
pub async fn load_config_from_sqlite(pool: &SqlitePool) -> AnyhowResult<Option<DbConfig>> {
  let app_data_dir = app_data_dir_for_key()?;
  let mk = SettingsManager::load_or_create_static_key(&app_data_dir);

  let host = read_decrypted(pool, "mysql.host", &mk).await?;
  if host.as_deref().unwrap_or("").is_empty() {
    return Ok(None);
  }

  let port: u16 = read_decrypted(pool, "mysql.port", &mk)
    .await?
    .and_then(|v| v.parse().ok())
    .unwrap_or(3306);
  let database = read_decrypted(pool, "mysql.database", &mk)
    .await?
    .unwrap_or_default();
  let username = read_decrypted(pool, "mysql.username", &mk)
    .await?
    .unwrap_or_default();
  let password = read_decrypted(pool, "mysql.password", &mk)
    .await?
    .unwrap_or_default();
  let staff_names = read_json_setting(pool, "staff_names", default_staff_names_vec()).await?;
  let regimens = read_json_setting(pool, "regimens", default_regimens_vec()).await?;

  Ok(Some(DbConfig {
    host: host.unwrap_or_default(),
    port,
    database,
    username,
    password,
    staff_names,
    regimens,
  }))
}

fn app_data_dir_for_key() -> AnyhowResult<PathBuf> {
  let home = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .map_err(|_| anyhow::anyhow!("cannot determine home directory"))?;
  Ok(
    std::path::PathBuf::from(home)
      .join("Library")
      .join("Application Support")
      .join("com.sabothospital.tb-plus"),
  )
}

fn default_staff_names_vec() -> Vec<String> {
  vec!["พยาบาลวิชาชีพ".into(), "เภสัชกร".into(), "แพทย์".into()]
}

fn default_regimens_vec() -> Vec<String> {
  vec!["2HRZE/4HR".into(), "2HRZE/6HR".into()]
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_db_config_serde_roundtrip() {
    let config = DbConfig {
      host: "192.168.1.100".into(),
      port: 3306,
      database: "hosxp_db".into(),
      username: "admin".into(),
      password: "secret".into(),
      staff_names: vec!["พยาบาลวิชาชีพ".into(), "เภสัชกร".into()],
      regimens: vec!["2HRZE/4HR".into(), "2HRZE/6HR".into()],
    };
    let json = serde_json::to_string(&config).unwrap();
    let restored: DbConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.host, "192.168.1.100");
    assert_eq!(restored.port, 3306);
    assert_eq!(restored.database, "hosxp_db");
    assert_eq!(restored.staff_names.len(), 2);
    assert_eq!(restored.regimens.len(), 2);
  }

  #[test]
  fn test_db_config_serde_empty_optionals() {
    let config = DbConfig {
      host: "localhost".into(),
      port: 3307,
      database: "test".into(),
      username: "user".into(),
      password: "pass".into(),
      staff_names: vec![],
      regimens: vec![],
    };
    let json = serde_json::to_string(&config).unwrap();
    let restored: DbConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(restored.staff_names, Vec::<String>::new());
    assert_eq!(restored.regimens, Vec::<String>::new());
  }
}
