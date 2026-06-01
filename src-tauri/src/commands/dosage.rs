use crate::commands::settings::MySqlState;
use tb_database;
use tb_logic::dosage::build_assessment_result;
use tb_models::dosage::{DosageAssessmentResult, DosageDrugCandidate};

use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;
use tb_database::SettingsManager;

#[tauri::command]
pub async fn get_configured_dosage_drugs(
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
) -> Result<Vec<DosageDrugCandidate>, String> {
  let guard = mysql.lock().await;
  let pool = guard
    .as_ref()
    .ok_or_else(|| "MySQL ยังไม่ได้เชื่อมต่อ".to_string())?;
  let class_by_icode = settings
    .build_icode_to_class()
    .await
    .map_err(|e| e.to_string())?;
  tb_database::mysql::get_drug_items_by_icodes(pool, &class_by_icode)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn assess_patient_dosage(
  _sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  hn: String,
  regimen_name: String,
) -> Result<DosageAssessmentResult, String> {
  let guard = mysql.lock().await;
  let pool = guard
    .as_ref()
    .ok_or_else(|| "MySQL ยังไม่ได้เชื่อมต่อ".to_string())?;

  let patient = tb_database::mysql::get_patient_latest_weight_summary(pool, &hn)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("ไม่พบผู้ป่วย HN {}", hn))?;

  let regimens = settings
    .get_regimen_definitions()
    .await
    .map_err(|e| e.to_string())?;
  let regimen = regimens
    .into_iter()
    .find(|entry| entry.name.eq_ignore_ascii_case(&regimen_name))
    .ok_or_else(|| format!("ไม่พบสูตรยา {}", regimen_name))?;

  let rules = settings
    .get_dosage_rules()
    .await
    .map_err(|e| e.to_string())?;
  let configured_drugs = load_candidate_map(pool, &settings).await?;

  Ok(build_assessment_result(
    patient,
    regimen,
    rules,
    configured_drugs,
  ))
}

async fn load_candidate_map(
  pool: &sqlx::MySqlPool,
  settings: &SettingsManager,
) -> Result<HashMap<String, DosageDrugCandidate>, String> {
  let class_by_icode = settings
    .build_icode_to_class()
    .await
    .map_err(|e| e.to_string())?;
  let candidates = tb_database::mysql::get_drug_items_by_icodes(pool, &class_by_icode)
    .await
    .map_err(|e| e.to_string())?;
  Ok(
    candidates
      .into_iter()
      .map(|candidate| (candidate.icode.clone(), candidate))
      .collect(),
  )
}
