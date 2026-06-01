use chrono::{Local, NaiveDate};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tb_models::alert::PatientAlert;
use tb_models::settings::AlertConfig;
use tb_models::treatment::TreatmentPlan;

// ---------------------------------------------------------------------------

#[allow(clippy::too_many_arguments)]
pub async fn compute_alerts_for_patient(
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
    _ => tb_database::sqlite::get_intensive_phase_end(sqlite, hn)
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
      && let Ok(true) = tb_database::mysql::was_ethambutol_dispensed_recently(
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
      let ze_recent = tb_database::mysql::was_ze_dispensed_recently(
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
