use sqlx::SqlitePool;
use tauri::State;
use tb_models::treatment::{FollowupInput, TreatmentPlanUpdate};

#[tauri::command]
pub async fn add_followup(
  db: State<'_, SqlitePool>,
  followup: FollowupInput,
) -> Result<i64, String> {
  tb_database::sqlite::add_followup(&db, &followup)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_treatment_phase(
  db: State<'_, SqlitePool>,
  plan: TreatmentPlanUpdate,
) -> Result<(), String> {
  tb_database::sqlite::update_treatment_phase(&db, &plan)
    .await
    .map_err(|e| e.to_string())
}
