use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::alert::PatientAlert;
use crate::models::patient::{ActivePatientRow, EnrollmentInput, PatientDetail};
use crate::models::settings::AlertConfig;
use crate::models::treatment::TreatmentPlan;
use crate::settings::SettingsManager;
use chrono::{Datelike, Local, NaiveDate};
use sqlx::SqlitePool;
use std::collections::HashMap;
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
  settings: State<'_, SettingsManager>,
) -> Result<Vec<ActivePatientRow>, String> {
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
      &alert_cfg,
      &all_icodes,
      &class_to_icodes,
    )
    .await;

    rows.push(ActivePatientRow {
      tb_patient: patient,
      demographics,
      current_plan,
      current_month,
      total_months,
      days_since_last_dispensing: days_since_last,
      outcome_value: None,
      alerts,
    });
  }

  Ok(rows)
}

#[tauri::command]
pub async fn get_patient_detail(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
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
  let icode_to_class_map = settings
    .build_icode_to_class()
    .await
    .map_err(|e| e.to_string())?;

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
    match db::mysql::get_dispensing_history(pool, &hn, &all_icodes, &icode_to_class_map).await {
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
    match db::mysql::get_last_dispensing_date(pool, &hn, &all_icodes).await {
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
    &alert_cfg,
    &all_icodes,
    &class_to_icodes,
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
// Shared alert helper — pub(crate) so alerts.rs can call it directly
// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
pub(crate) async fn compute_alerts_for_patient(
  hn: &str,
  current_plan: &Option<TreatmentPlan>,
  current_month: Option<i64>,
  total_months: Option<i64>,
  days_since_last: Option<i64>,
  mysql_pool: Option<&sqlx::MySqlPool>,
  sqlite: &SqlitePool,
  alert_cfg: &AlertConfig,
  _all_icodes: &[String],
  class_to_icodes: &HashMap<String, Vec<String>>,
) -> Vec<PatientAlert> {
  let mut alerts = Vec::new();
  let today = Local::now().date_naive();
  let overdue_days = alert_cfg.overdue_days as i64;
  let lost_days = alert_cfg.lost_followup_days as i64;

  // 1. Overdue dispensing
  if let Some(days) = days_since_last
    && days > overdue_days
    && days <= lost_days
  {
    alerts.push(PatientAlert {
      hn: hn.to_string(),
      alert_type: "overdue".to_string(),
      severity: "red".to_string(),
      message: format!("ไม่ได้รับยานาน {} วัน", days),
      details: None,
    });
  }

  // 2. Lost to follow-up
  if let Some(days) = days_since_last
    && days > lost_days
  {
    alerts.push(PatientAlert {
      hn: hn.to_string(),
      alert_type: "lost_to_followup".to_string(),
      severity: "red".to_string(),
      message: format!("ขาดการติดตาม {} วัน", days),
      details: None,
    });
  }

  // ── Resolve intensive phase end date ───────────────────────────────────────
  // Required for BOTH the E-overrun and phase-transition checks.
  // When the current SQLite plan is still "intensive", use its own end date.
  // When it has been transitioned to "continuation", query the archived
  // intensive plan row (is_current = 0) from SQLite.
  let intensive_end_str: Option<String> = match current_plan {
    Some(plan) if plan.phase == "intensive" => plan.phase_end_expected.clone(),
    _ => db::sqlite::get_intensive_phase_end(sqlite, hn)
      .await
      .ok()
      .flatten(),
  };
  let intensive_end_date = intensive_end_str
    .as_deref()
    .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

  if let Some(pool) = mysql_pool {
    let e_icodes: Vec<String> = class_to_icodes.get("E").cloned().unwrap_or_default();
    let mut ze_icodes: Vec<String> = class_to_icodes.get("Z").cloned().unwrap_or_default();
    if let Some(e_codes) = class_to_icodes.get("E") {
      ze_icodes.extend(e_codes.clone());
    }

    // 3a. Ethambutol overrun
    if let Some(end_date) = intensive_end_date
      && today > end_date
      && let Ok(true) = db::mysql::was_ethambutol_dispensed_recently(
        pool,
        hn,
        alert_cfg.e_overrun_lookback_days as i64,
        &e_icodes,
      )
      .await
    {
      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: "ethambutol_overrun".to_string(),
        severity: "red".to_string(),
        message: "ได้รับ Ethambutol เกินระยะ Intensive Phase".to_string(),
        details: intensive_end_str
          .as_deref()
          .map(|s| format!("ระยะ Intensive สิ้นสุด: {}", s)),
      });
    }

    // 3b. Phase-transition check
    if let Some(plan) = current_plan
      && plan.phase == "intensive"
      && let Some(end_date) = intensive_end_date
      && today > end_date
    {
      let ze_recent = db::mysql::was_ze_dispensed_recently(
        pool,
        hn,
        alert_cfg.phase_transition_lookback_days as i64,
        &ze_icodes,
      )
      .await
      .unwrap_or(true);

      let (alert_type, message) = if ze_recent {
        ("phase_transition", "ถึงเวลาเปลี่ยนเป็น Continuation Phase")
      } else {
        (
          "phase_not_updated",
          "ผู้ป่วยอยู่ในระยะ Continuation แล้ว — กรุณาอัปเดตแผนการรักษาในระบบ",
        )
      };

      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: alert_type.to_string(),
        severity: "yellow".to_string(),
        message: message.to_string(),
        details: intensive_end_str
          .as_deref()
          .map(|s| format!("ระยะ Intensive สิ้นสุด: {}", s)),
      });
    }
  } else {
    // No MySQL — fire phase-transition alert based on date alone (conservative).
    if let Some(plan) = current_plan
      && plan.phase == "intensive"
      && let Some(end_date) = intensive_end_date
      && today > end_date
    {
      alerts.push(PatientAlert {
        hn: hn.to_string(),
        alert_type: "phase_transition".to_string(),
        severity: "yellow".to_string(),
        message: "ถึงเวลาเปลี่ยนเป็น Continuation Phase".to_string(),
        details: intensive_end_str
          .as_deref()
          .map(|s| format!("ระยะ Intensive สิ้นสุด: {}", s)),
      });
    }
  }

  // 4. Total treatment duration exceeded
  if let (Some(cur_month), Some(total)) = (current_month, total_months)
    && cur_month > total
  {
    alerts.push(PatientAlert {
      hn: hn.to_string(),
      alert_type: "treatment_complete".to_string(),
      severity: "yellow".to_string(),
      message: "ครบกำหนดระยะการรักษาแล้ว".to_string(),
      details: None,
    });
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
  _settings: State<'_, SettingsManager>,
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

    let outcome_value = db::sqlite::get_outcome(&sqlite, &patient.hn)
      .await
      .ok()
      .flatten()
      .map(|o| o.outcome);

    rows.push(ActivePatientRow {
      tb_patient: patient,
      demographics,
      current_plan: None,
      current_month: None,
      total_months,
      days_since_last_dispensing: None,
      outcome_value,
      alerts: vec![],
    });
  }

  Ok(rows)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — alert logic (pure date math, no DB required)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;
  use chrono::{Local, NaiveDate};

  // ---------------------------------------------------------------------------
  // Alert helper: mirrors the core logic from compute_alerts_for_patient
  // but works with explicit NaiveDate inputs so we can control the "today"
  // without needing a real database.
  // ---------------------------------------------------------------------------

  fn compute_alert_types(
    current_plan: Option<&TreatmentPlan>,
    current_month: Option<i64>,
    total_months: Option<i64>,
    days_since_last: Option<i64>,
    reference_date: NaiveDate,
  ) -> Vec<&'static str> {
    let cfg = AlertConfig::default();
    let overdue_days = cfg.overdue_days as i64;
    let lost_days = cfg.lost_followup_days as i64;
    let mut types = Vec::new();

    // 1. Overdue
    if let Some(d) = days_since_last {
      if d > overdue_days && d <= lost_days {
        types.push("overdue");
      }
      if d > lost_days {
        types.push("lost_to_followup");
      }
    }

    // 2. Phase transition
    let intensive_end = current_plan
      .filter(|p| p.phase == "intensive")
      .and_then(|p| p.phase_end_expected.as_ref())
      .and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    if let (Some(plan), Some(end)) = (current_plan, intensive_end) {
      if plan.phase == "intensive" && reference_date > end {
        types.push("phase_transition");
      }
    }

    // 3. Treatment complete
    if let (Some(cur), Some(tot)) = (current_month, total_months) {
      if cur > tot {
        types.push("treatment_complete");
      }
    }

    types
  }

  fn make_plan(phase: &str, phase_end: &str, duration: i64) -> TreatmentPlan {
    TreatmentPlan {
      id: 1,
      hn: "HN001".into(),
      regimen: "2HRZE/4HR".into(),
      phase: phase.into(),
      phase_start: "2025-01-01".into(),
      phase_end_expected: Some(phase_end.into()),
      drugs: r#"["H","R","Z","E"]"#.into(),
      duration_months: duration,
      is_current: true,
      notes: None,
      created_at: "2025-01-01T00:00:00".into(),
    }
  }

  // ---------------------------------------------------------------------------
  // No alerts when all is well
  // ---------------------------------------------------------------------------

  #[test]
  fn test_no_overdue_alert_within_35_days() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("intensive", "2026-06-01", 2)),
      Some(3),
      Some(6),
      Some(5),
      today,
    );
    assert!(!types.contains(&"overdue"));
    assert!(!types.contains(&"lost_to_followup"));
  }

  // ---------------------------------------------------------------------------
  // Overdue (> 35, ≤ 60 days) → overdue alert
  // ---------------------------------------------------------------------------

  #[test]
  fn test_overdue_alert_at_36_days() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("intensive", "2026-06-01", 2)),
      Some(2),
      Some(6),
      Some(36),
      today,
    );
    assert!(types.contains(&"overdue"), "36 days should trigger overdue");
  }

  #[test]
  fn test_no_overdue_alert_at_35_days_exactly() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("intensive", "2026-06-01", 2)),
      Some(2),
      Some(6),
      Some(35),
      today,
    );
    assert!(
      !types.contains(&"overdue"),
      "35 days exactly should NOT trigger overdue"
    );
  }

  // ---------------------------------------------------------------------------
  // Lost to follow-up (> 60 days)
  // ---------------------------------------------------------------------------

  #[test]
  fn test_lost_to_followup_at_61_days() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(None, None, None, Some(61), today);
    assert!(
      types.contains(&"lost_to_followup"),
      "61 days should trigger lost_to_followup"
    );
  }

  #[test]
  fn test_no_lost_to_followup_between_35_and_60_days() {
    let today = Local::now().date_naive();
    for days in [36, 45, 59] {
      let types = compute_alert_types(None, None, None, Some(days), today);
      assert!(
        !types.contains(&"lost_to_followup"),
        "days={days} should NOT trigger lost_to_followup"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Treatment complete (> total_months)
  // ---------------------------------------------------------------------------

  #[test]
  fn test_treatment_complete_when_month_exceeds_total() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("continuation", "2026-12-01", 6)),
      Some(8),
      Some(6),
      Some(10),
      today,
    );
    assert!(
      types.contains(&"treatment_complete"),
      "month 8 of 6 should trigger treatment_complete"
    );
  }

  #[test]
  fn test_no_treatment_complete_when_within_duration() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("intensive", "2026-06-01", 2)),
      Some(3),
      Some(6),
      Some(5),
      today,
    );
    assert!(
      !types.contains(&"treatment_complete"),
      "month 3 of 6 should NOT trigger"
    );
  }

  // ---------------------------------------------------------------------------
  // Phase transition — intensive phase end date passed but still intensive
  // ---------------------------------------------------------------------------

  #[test]
  fn test_phase_transition_due_when_intensive_end_passed() {
    let today = Local::now().date_naive();
    let past = (today - chrono::Duration::days(10))
      .format("%Y-%m-%d")
      .to_string();
    let types = compute_alert_types(
      Some(&make_plan("intensive", &past, 2)),
      Some(3),
      Some(6),
      Some(5),
      today,
    );
    assert!(
      types.contains(&"phase_transition"),
      "intensive phase end in past should trigger phase_transition"
    );
  }

  #[test]
  fn test_no_phase_transition_when_continuation() {
    let today = Local::now().date_naive();
    let past = (today - chrono::Duration::days(10))
      .format("%Y-%m-%d")
      .to_string();
    let types = compute_alert_types(
      Some(&make_plan("continuation", &past, 4)),
      Some(3),
      Some(6),
      Some(5),
      today,
    );
    assert!(
      !types.contains(&"phase_transition"),
      "continuation phase should not trigger phase_transition"
    );
  }

  #[test]
  fn test_no_phase_transition_when_intensive_end_in_future() {
    let today = Local::now().date_naive();
    let future = (today + chrono::Duration::days(30))
      .format("%Y-%m-%d")
      .to_string();
    let types = compute_alert_types(
      Some(&make_plan("intensive", &future, 2)),
      Some(1),
      Some(6),
      Some(5),
      today,
    );
    assert!(
      !types.contains(&"phase_transition"),
      "intensive phase end in future should NOT trigger"
    );
  }

  // ---------------------------------------------------------------------------
  // All alert types absent when no data
  // ---------------------------------------------------------------------------

  #[test]
  fn test_no_panic_without_current_plan() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(None, None, None, None, today);
    assert!(!types.contains(&"overdue"));
    assert!(!types.contains(&"lost_to_followup"));
    assert!(!types.contains(&"phase_transition"));
    assert!(!types.contains(&"treatment_complete"));
  }

  // ---------------------------------------------------------------------------
  // Edge: current_month equals total_months exactly → not a violation
  // ---------------------------------------------------------------------------

  #[test]
  fn test_no_treatment_complete_when_month_equals_total() {
    let today = Local::now().date_naive();
    let types = compute_alert_types(
      Some(&make_plan("continuation", "2026-12-01", 6)),
      Some(6),
      Some(6),
      Some(10),
      today,
    );
    assert!(
      !types.contains(&"treatment_complete"),
      "month 6 of 6 exact match should NOT trigger"
    );
  }

  // ---------------------------------------------------------------------------
  // Multiple alerts can coexist
  // ---------------------------------------------------------------------------

  #[test]
  fn test_overdue_and_phase_transition_can_coexist() {
    let today = Local::now().date_naive();
    let past = (today - chrono::Duration::days(10))
      .format("%Y-%m-%d")
      .to_string();
    let types = compute_alert_types(
      Some(&make_plan("intensive", &past, 2)),
      Some(3),
      Some(6),
      Some(40),
      today,
    );
    assert!(types.contains(&"overdue"));
    assert!(types.contains(&"phase_transition"));
  }
}
