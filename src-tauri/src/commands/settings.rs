use crate::models::settings::{AlertConfig, DrugClassEntry, HosxpConfig, RegimenEntry};
use crate::settings::SettingsManager;
use serde::{Deserialize, Serialize};
use sqlx::MySqlPool;
use sqlx::mysql::MySqlPoolOptions;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClinicResult {
  pub clinic: String,
  pub name: Option<String>,
}

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
  settings
    .load_db_config_inner()
    .await
    .map_err(|e| e.to_string())
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
// Setup wizard — drug search, drug classes, regimen definitions
// ─────────────────────────────────────────────────────────────────────────────

/// Search HOSxP drugitems by name/icode. Used in the settings page to let
/// users find the right icodes when configuring drug classes.
#[tauri::command]
pub async fn search_hosxp_drugs(
  mysql: State<'_, MySqlState>,
  query: String,
) -> Result<Vec<crate::models::settings::DrugItem>, String> {
  let guard = mysql.lock().await;
  let pool = guard
    .as_ref()
    .ok_or_else(|| "MySQL ยังไม่ได้เชื่อมต่อ".to_string())?;
  crate::db::mysql::search_drugs(pool, &query, 20)
    .await
    .map_err(|e| e.to_string())
}

/// Search HOSxP clinic table by name or code. Used to find TB clinic code.
#[tauri::command]
pub async fn search_hosxp_clinics(
  mysql: State<'_, MySqlState>,
  query: String,
) -> Result<Vec<ClinicResult>, String> {
  let guard = mysql.lock().await;
  let pool = guard
    .as_ref()
    .ok_or_else(|| "MySQL ยังไม่ได้เชื่อมต่อ".to_string())?;
  let rows = crate::db::mysql::search_clinics(pool, &query, 20)
    .await
    .map_err(|e| e.to_string())?;
  Ok(
    rows
      .into_iter()
      .map(|r| ClinicResult {
        clinic: r.clinic,
        name: r.name,
      })
      .collect(),
  )
}

/// Save a complete drug-classes configuration. Replaces any existing data.
#[tauri::command]
pub async fn save_drug_classes(
  settings: State<'_, SettingsManager>,
  classes: Vec<DrugClassEntry>,
) -> Result<(), String> {
  settings
    .set_json("drug_classes", &classes)
    .await
    .map_err(|e| e.to_string())
}

/// Save a complete regimen-definitions configuration. Replaces any existing data.
#[tauri::command]
pub async fn save_regimen_definitions(
  settings: State<'_, SettingsManager>,
  regimens: Vec<RegimenEntry>,
) -> Result<(), String> {
  settings
    .set_json("regimen_definitions", &regimens)
    .await
    .map_err(|e| e.to_string())
}

/// Get the current regimen definitions.
#[tauri::command]
pub async fn get_regimen_definitions(
  settings: State<'_, SettingsManager>,
) -> Result<Vec<RegimenEntry>, String> {
  settings
    .get_regimen_definitions()
    .await
    .map_err(|e| e.to_string())
}

/// Save HOSxP table/clinic configuration.
#[tauri::command]
pub async fn save_hosxp_config(
  settings: State<'_, SettingsManager>,
  config: HosxpConfig,
) -> Result<(), String> {
  settings
    .set_json("hosxp", &config)
    .await
    .map_err(|e| e.to_string())
}

/// Load HOSxP configuration.
#[tauri::command]
pub async fn load_hosxp_config(
  settings: State<'_, SettingsManager>,
) -> Result<HosxpConfig, String> {
  settings.get_hosxp_config().await.map_err(|e| e.to_string())
}

/// Save alert threshold configuration.
#[tauri::command]
pub async fn save_alert_config(
  settings: State<'_, SettingsManager>,
  config: AlertConfig,
) -> Result<(), String> {
  settings
    .set_json("alert", &config)
    .await
    .map_err(|e| e.to_string())
}

/// Load alert thresholds.
#[tauri::command]
pub async fn load_alert_config(
  settings: State<'_, SettingsManager>,
) -> Result<AlertConfig, String> {
  settings.get_alert_config().await.map_err(|e| e.to_string())
}

/// Load drug classes.
#[tauri::command]
pub async fn load_drug_classes(
  settings: State<'_, SettingsManager>,
) -> Result<Vec<DrugClassEntry>, String> {
  settings.get_drug_classes().await.map_err(|e| e.to_string())
}

/// Mark the initial setup wizard as completed.
#[tauri::command]
pub async fn mark_setup_complete(settings: State<'_, SettingsManager>) -> Result<(), String> {
  settings
    .set("setup_complete", "true")
    .await
    .map_err(|e| e.to_string())
}

/// Check whether the setup wizard has been completed.
#[tauri::command]
pub async fn is_setup_complete(settings: State<'_, SettingsManager>) -> Result<bool, String> {
  Ok(
    settings
      .get("setup_complete")
      .await
      .map_err(|e| e.to_string())?
      .as_deref()
      == Some("true"),
  )
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
