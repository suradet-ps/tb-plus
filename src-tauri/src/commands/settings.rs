use anyhow::Result as AnyhowResult;
use chrono::Local;
use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlPoolOptions;
use sqlx::{MySqlPool, SqlitePool};
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
}

/// Tauri managed state: an optional live MySQL connection pool protected by an
/// async Mutex so multiple commands can safely read/replace it.
pub type MySqlState = Arc<Mutex<Option<MySqlPool>>>;

// ─────────────────────────────────────────────────────────────────────────────
// Existing commands (kept verbatim)
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
/// Call this from the UI "Connect" button; call `save_db_config` afterwards
/// to persist the credentials across restarts.
#[tauri::command]
pub async fn connect_mysql(mysql: State<'_, MySqlState>, config: DbConfig) -> Result<(), String> {
  let url = format!(
    "mysql://{}:{}@{}:{}/{}",
    config.username, config.password, config.host, config.port, config.database
  );
  let pool = MySqlPoolOptions::new()
    .max_connections(5)
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

/// Return the on-disk path to the SQLite database file (useful for manual
/// backups or pointing external tools at the file).
#[tauri::command]
pub async fn backup_sqlite(app: tauri::AppHandle) -> Result<String, String> {
  use tauri::Manager;
  let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let db_path = app_data_dir.join("tb_clinic.db");
  Ok(db_path.to_string_lossy().to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistent connection settings — stored entirely in SQLite app_settings
// ─────────────────────────────────────────────────────────────────────────────

/// All keys stored in `app_settings` (all fields including password).
/// SQLite DB lives in the OS-protected app data directory.
const SETTING_KEYS: [&str; 5] = [
  "mysql_host",
  "mysql_port",
  "mysql_database",
  "mysql_username",
  "mysql_password",
];

/// Persist all connection fields to the local SQLite `app_settings` table.
/// Should be called after a successful `connect_mysql`.
#[tauri::command]
pub async fn save_db_config(sqlite: State<'_, SqlitePool>, config: DbConfig) -> Result<(), String> {
  let now = Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
  let port_str = config.port.to_string();

  let fields: [(&str, &str); 5] = [
    ("mysql_host", config.host.as_str()),
    ("mysql_port", port_str.as_str()),
    ("mysql_database", config.database.as_str()),
    ("mysql_username", config.username.as_str()),
    ("mysql_password", config.password.as_str()),
  ];

  for (key, value) in &fields {
    sqlx::query("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)")
      .bind(*key)
      .bind(*value)
      .bind(&now)
      .execute(sqlite.inner())
      .await
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

/// Load the saved DB config from SQLite app_settings.
/// Returns `None` when no complete config has been saved yet.
#[tauri::command]
pub async fn load_db_config(sqlite: State<'_, SqlitePool>) -> Result<Option<DbConfig>, String> {
  load_config_from_sqlite(sqlite.inner())
    .await
    .map_err(|e| e.to_string())
}

/// Remove saved config from SQLite.
#[tauri::command]
pub async fn delete_db_config(sqlite: State<'_, SqlitePool>) -> Result<(), String> {
  sqlx::query(
    "DELETE FROM app_settings \
     WHERE key IN ('mysql_host', 'mysql_port', 'mysql_database', 'mysql_username', 'mysql_password')",
  )
  .execute(sqlite.inner())
  .await
  .map_err(|e| e.to_string())?;

  Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Public (non-command) helper — used by lib.rs during startup auto-connect
// ─────────────────────────────────────────────────────────────────────────────

/// Read the persisted DB config directly from a `&SqlitePool`.
/// Called during app startup before managed state has been registered.
///
/// Returns `Ok(None)` when any of the five keys are absent from `app_settings`.
pub async fn load_config_from_sqlite(pool: &SqlitePool) -> AnyhowResult<Option<DbConfig>> {
  let mut values: std::collections::HashMap<String, String> =
    std::collections::HashMap::with_capacity(SETTING_KEYS.len());

  for key in SETTING_KEYS {
    let value: Option<String> = sqlx::query_scalar("SELECT value FROM app_settings WHERE key = ?")
      .bind(key)
      .fetch_optional(pool)
      .await?;

    match value {
      Some(v) => {
        values.insert(key.to_string(), v);
      }
      // Any missing key means the config is incomplete — bail out gracefully
      None => return Ok(None),
    }
  }

  let port: u16 = values
    .get("mysql_port")
    .and_then(|v| v.parse().ok())
    .unwrap_or(3306);

  Ok(Some(DbConfig {
    host: values.remove("mysql_host").unwrap_or_default(),
    port,
    database: values.remove("mysql_database").unwrap_or_default(),
    username: values.remove("mysql_username").unwrap_or_default(),
    password: values.remove("mysql_password").unwrap_or_default(),
  }))
}