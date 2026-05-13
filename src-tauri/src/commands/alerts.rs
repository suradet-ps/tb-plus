use crate::commands::patients::compute_alerts_for_patient;
use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::alert::PatientAlert;
use crate::settings::SettingsManager;
use chrono::{Datelike, Local, NaiveDate};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn get_patient_alerts(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
) -> Result<Vec<PatientAlert>, String> {
  let patients = db::sqlite::get_active_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let mysql_guard = mysql.lock().await;
  let mysql_pool = mysql_guard.as_ref();

  let alert_cfg = settings
    .get_alert_config()
    .await
    .map_err(|e| e.to_string())?;
  let all_icodes = settings
    .get_all_tb_icodes()
    .await
    .map_err(|e| e.to_string())?;
  let class_to_icodes = settings
    .build_class_to_icodes()
    .await
    .map_err(|e| e.to_string())?;

  let today = Local::now().date_naive();
  let mut all_alerts: Vec<PatientAlert> = Vec::new();

  for patient in &patients {
    let current_plan = db::sqlite::get_current_treatment_plan(&sqlite, &patient.hn)
      .await
      .ok()
      .flatten();

    let first_start = db::sqlite::get_first_phase_start(&sqlite, &patient.hn)
      .await
      .ok()
      .flatten();

    let current_month = first_start.as_ref().and_then(|s| {
      NaiveDate::parse_from_str(s, "%Y-%m-%d").ok().map(|start| {
        let months =
          (today.year() - start.year()) * 12 + (today.month() as i32 - start.month() as i32);
        (months + 1).max(1) as i64
      })
    });

    let total_months = db::sqlite::get_all_treatment_plans(&sqlite, &patient.hn)
      .await
      .ok()
      .map(|plans| plans.iter().map(|p| p.duration_months).sum::<i64>());

    let days_since_last = if let Some(pool) = mysql_pool {
      db::mysql::get_last_dispensing_date(pool, &patient.hn, &all_icodes)
        .await
        .ok()
        .flatten()
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .map(|d| (today - d).num_days())
    } else {
      None
    };

    let patient_alerts = compute_alerts_for_patient(
      &patient.hn,
      &current_plan,
      current_month,
      total_months,
      days_since_last,
      mysql_pool,
      &sqlite,
      &alert_cfg,
      &all_icodes,
      &class_to_icodes,
    )
    .await;

    all_alerts.extend(patient_alerts);
  }

  Ok(all_alerts)
}
