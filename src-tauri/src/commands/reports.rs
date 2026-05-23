use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::reports::DrugConsumptionRow;
use crate::settings::SettingsManager;
use tauri::State;

#[tauri::command]
pub async fn get_drug_consumption(
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  months_back: Option<i32>,
) -> Result<Vec<DrugConsumptionRow>, String> {
  let guard = mysql.lock().await;
  let pool = guard.as_ref().ok_or("MySQL ยังไม่ได้เชื่อมต่อ")?;

  let all_icodes = settings
    .get_all_tb_icodes()
    .await
    .map_err(|e| e.to_string())?;
  let icode_to_class_map = settings
    .build_icode_to_class()
    .await
    .map_err(|e| e.to_string())?;

  let months = months_back.unwrap_or(12).clamp(1, 60);

  db::mysql::get_drug_consumption_by_month(pool, &all_icodes, &icode_to_class_map, months)
    .await
    .map_err(|e| e.to_string())
}
