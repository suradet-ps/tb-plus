use crate::commands::settings::MySqlState;
use tauri::State;
use tb_database;
use tb_database::SettingsManager;
use tb_models::patient::AppointmentRecord;

/// Fetch upcoming TB clinic appointments from HOSxP.
#[tauri::command]
pub async fn get_appointments(
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  days_ahead: Option<i64>,
) -> Result<Vec<AppointmentRecord>, String> {
  let guard = mysql.lock().await;
  match &*guard {
    None => Err("MySQL ยังไม่ได้เชื่อมต่อ".to_string()),
    Some(pool) => {
      let days = days_ahead.unwrap_or(30);
      let clinic_code = &settings
        .get_hosxp_config()
        .await
        .map_err(|e| e.to_string())?
        .clinic_code;
      tb_database::mysql::get_tb_appointments(pool, days, clinic_code)
        .await
        .map_err(|e| e.to_string())
    }
  }
}
