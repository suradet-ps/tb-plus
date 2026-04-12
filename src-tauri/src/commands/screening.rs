use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::dispensing::DispensingRecord;
use crate::models::patient::{PatientDrugRecord, SearchFilters};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn search_tb_patients(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  filters: SearchFilters,
) -> Result<Vec<PatientDrugRecord>, String> {
  let guard = mysql.lock().await;
  match &*guard {
    None => Err("MySQL ยังไม่ได้เชื่อมต่อ กรุณาตั้งค่าการเชื่อมต่อ HOSxP ในการตั้งค่า".to_string()),
    Some(pool) => {
      let enrolled_map = db::sqlite::get_enrolled_patients_map(&sqlite)
        .await
        .map_err(|e| e.to_string())?;
      db::mysql::search_tb_patients(pool, &filters, &enrolled_map)
        .await
        .map_err(|e| e.to_string())
    }
  }
}

#[tauri::command]
pub async fn get_dispensing_history(
  mysql: State<'_, MySqlState>,
  hn: String,
) -> Result<Vec<DispensingRecord>, String> {
  let guard = mysql.lock().await;
  match &*guard {
    None => Err("MySQL ยังไม่ได้เชื่อมต่อ".to_string()),
    Some(pool) => db::mysql::get_dispensing_history(pool, &hn)
      .await
      .map_err(|e| e.to_string()),
  }
}
