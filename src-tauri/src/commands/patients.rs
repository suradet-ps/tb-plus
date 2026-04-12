use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::alert::PatientAlert;
use crate::models::patient::{ActivePatientRow, EnrollmentInput, PatientDetail};
use crate::models::treatment::TreatmentPlan;
use chrono::{Datelike, Local, NaiveDate};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn enroll_patient(
  sqlite: State<'_, SqlitePool>,
  enrollment: EnrollmentInput,
) -> Result<i64, String> {
  db::sqlite::enroll_patient(&sqlite, &enrollment)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_patients(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
) -> Result<Vec<ActivePatientRow>, String> {
  let patients = db::sqlite::get_active_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let mysql_guard = mysql.lock().await;
  let mysql_pool = mysql_guard.as_ref();

  let today = Local::now().date_naive();
  let mut rows = Vec::new();

  for patient in patients {
    let demographics = if let Some(pool) = mysql_pool {
      db::mysql::get_patient_demographics(pool, &patient.hn)
        .await
        .ok()
        .flatten()
    } else {
      None
    };

    let current_plan = db::sqlite::get_current_treatment_plan(&sqlite, &patient.hn)
      .await
      .ok()
      .flatten();

    // Compute current month from earliest phase_start across all plans
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
      db::mysql::get_last_dispensing_date(pool, &patient.hn)
        .await
        .ok()
        .flatten()
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .map(|last| (today - last).num_days())
    } else {
      None
    };

    let alerts = compute_alerts_for_patient(
      &patient.hn,
      &current_plan,
      current_month,
      total_months,
      days_since_last,
      mysql_pool,
      &sqlite,
    )
    .await;

    rows.push(ActivePatientRow {
      tb_patient: patient,
      demographics,
      current_plan,
      current_month,
      total_months,
      days_since_last_dispensing: days_since_last,
      alerts,
    });
  }

  Ok(rows)
}

#[tauri::command]
pub async fn get_patient_detail(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  hn: String,
) -> Result<PatientDetail, String> {
  let patient = db::sqlite::get_patient_by_hn(&sqlite, &hn)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Patient {} not found", hn))?;

  let mysql_guard = mysql.lock().await;
  let mysql_pool = mysql_guard.as_ref();
  let mysql_connected = mysql_pool.is_some();
  let mut mysql_errors: Vec<String> = Vec::new();

  // ── Demographics (HOSxP) ─────────────────────────────────────────────────
  let demographics = if let Some(pool) = mysql_pool {
    match db::mysql::get_patient_demographics(pool, &hn).await {
      Ok(demo) => demo,
      Err(e) => {
        mysql_errors.push(format!("demographics: {}", e));
        None
      }
    }
  } else {
    None
  };

  // ── SQLite data ──────────────────────────────────────────────────────────
  let current_plan = db::sqlite::get_current_treatment_plan(&sqlite, &hn)
    .await
    .ok()
    .flatten();

  let followups = db::sqlite::get_followups(&sqlite, &hn)
    .await
    .map_err(|e| e.to_string())?;

  let outcome = db::sqlite::get_outcome(&sqlite, &hn).await.ok().flatten();

  // ── Dispensing history (HOSxP) ───────────────────────────────────────────
  let dispensing_history = if let Some(pool) = mysql_pool {
    match db::mysql::get_dispensing_history(pool, &hn).await {
      Ok(rows) => rows,
      Err(e) => {
        mysql_errors.push(format!("dispensing: {}", e));
        vec![]
      }
    }
  } else {
    vec![]
  };

  let today = Local::now().date_naive();

  // ── Last dispensing date (HOSxP) ─────────────────────────────────────────
  let days_since_last = if let Some(pool) = mysql_pool {
    match db::mysql::get_last_dispensing_date(pool, &hn).await {
      Ok(date_str) => date_str
        .and_then(|s| NaiveDate::parse_from_str(&s, "%Y-%m-%d").ok())
        .map(|d| (today - d).num_days()),
      Err(e) => {
        mysql_errors.push(format!("last_dispensing: {}", e));
        None
      }
    }
  } else {
    None
  };

  let first_start = db::sqlite::get_first_phase_start(&sqlite, &hn)
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

  let total_months = db::sqlite::get_all_treatment_plans(&sqlite, &hn)
    .await
    .ok()
    .map(|plans| plans.iter().map(|p| p.duration_months).sum::<i64>());

  let alerts = compute_alerts_for_patient(
    &hn,
    &current_plan,
    current_month,
    total_months,
    days_since_last,
    mysql_pool,
    &sqlite,
  )
  .await;

  let mysql_error = if mysql_errors.is_empty() {
    None
  } else {
    Some(mysql_errors.join(" | "))
  };

  Ok(PatientDetail {
    patient,
    demographics,
    current_plan,
    followups,
    outcome,
    dispensing_history,
    alerts,
    mysql_connected,
    mysql_error,
  })
}

// ---------------------------------------------------------------------------
// Private alert helper — shared by get_active_patients and get_patient_detail
// ---------------------------------------------------------------------------

async fn compute_alerts_for_patient(
  hn: &str,
  current_plan: &Option<TreatmentPlan>,
  current_month: Option<i64>,
  total_months: Option<i64>,
  days_since_last: Option<i64>,
  mysql_pool: Option<&sqlx::MySqlPool>,
  sqlite: &SqlitePool,
) -> Vec<PatientAlert> {
  let _ = sqlite; // reserved for future SQLite-side alert queries
  let mut alerts = Vec::new();
  let today = Local::now().date_naive();

  // 1. Overdue dispensing (> 35 days, not yet lost to follow-up)
  if let Some(days) = days_since_last {
    if days > 35 && days <= 60 {
      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: "overdue".to_string(),
        severity: "red".to_string(),
        message: format!("ไม่ได้รับยานาน {} วัน", days),
        details: None,
      });
    }
  }

  // 2. Lost to follow-up (> 60 days)
  if let Some(days) = days_since_last {
    if days > 60 {
      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: "lost_to_followup".to_string(),
        severity: "red".to_string(),
        message: format!("ขาดการติดตาม {} วัน", days),
        details: None,
      });
    }
  }

  // 3. Ethambutol overrun & phase-transition alerts (requires MySQL)
  if let Some(pool) = mysql_pool {
    // 3a. Patient is in continuation phase but E was dispensed recently
    if let Some(plan) = current_plan {
      if plan.phase == "continuation" {
        if let Ok(true) = db::mysql::was_ethambutol_dispensed_recently(pool, hn, 30).await {
          alerts.push(PatientAlert {
            hn: hn.to_string(),
            alert_type: "ethambutol_overrun".to_string(),
            severity: "red".to_string(),
            message: "ได้รับ Ethambutol เกินระยะ Intensive Phase".to_string(),
            details: None,
          });
        }
      }
    }

    // 3b. Still in intensive phase but expected end date has passed
    if let Some(plan) = current_plan {
      if plan.phase == "intensive" {
        if let Some(end_str) = &plan.phase_end_expected {
          if let Ok(end_date) = NaiveDate::parse_from_str(end_str, "%Y-%m-%d") {
            if today > end_date {
              alerts.push(PatientAlert {
                hn: hn.to_string(),
                alert_type: "phase_transition".to_string(),
                severity: "yellow".to_string(),
                message: "ถึงเวลาเปลี่ยนเป็น Continuation Phase".to_string(),
                details: Some(format!("Phase end expected: {}", end_str)),
              });
            }
          }
        }
      }
    }
  }

  // 4. Total treatment duration exceeded
  if let (Some(cur_month), Some(total)) = (current_month, total_months) {
    if cur_month > total {
      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: "treatment_complete".to_string(),
        severity: "yellow".to_string(),
        message: "ครบกำหนดระยะการรักษาแล้ว".to_string(),
        details: None,
      });
    }
  }

  alerts
}

#[tauri::command]
pub async fn discharge_patient(
  sqlite: State<'_, SqlitePool>,
  outcome: crate::models::treatment::OutcomeInput,
) -> Result<(), String> {
  db::sqlite::discharge_patient(&sqlite, &outcome)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_discharged_patients(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
) -> Result<Vec<ActivePatientRow>, String> {
  let patients = db::sqlite::get_discharged_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let mysql_guard = mysql.lock().await;
  let mysql_pool = mysql_guard.as_ref();

  let mut rows = Vec::new();
  for patient in patients {
    let demographics = if let Some(pool) = mysql_pool {
      db::mysql::get_patient_demographics(pool, &patient.hn)
        .await
        .ok()
        .flatten()
    } else {
      None
    };

    let all_plans = db::sqlite::get_all_treatment_plans(&sqlite, &patient.hn)
      .await
      .ok()
      .unwrap_or_default();

    let total_months = Some(all_plans.iter().map(|p| p.duration_months).sum::<i64>());

    rows.push(ActivePatientRow {
      tb_patient: patient,
      demographics,
      current_plan: None,
      current_month: None,
      total_months,
      days_since_last_dispensing: None,
      alerts: vec![],
    });
  }

  Ok(rows)
}
