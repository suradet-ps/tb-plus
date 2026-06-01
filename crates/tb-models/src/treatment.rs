use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TreatmentPlan {
  pub id: i64,
  pub hn: String,
  pub regimen: String,
  pub phase: String,
  pub phase_start: String,
  pub phase_end_expected: Option<String>,
  pub drugs: String,
  pub duration_months: i64,
  pub is_current: bool,
  pub notes: Option<String>,
  pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreatmentPlanUpdate {
  pub hn: String,
  pub new_phase: String,
  pub phase_start: String,
  pub regimen: String,
  pub drugs: String,
  pub duration_months: i64,
  pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Followup {
  pub id: i64,
  pub hn: String,
  pub followup_date: String,
  pub month_number: Option<i64>,
  pub weight_kg: Option<f64>,
  pub sputum_result: Option<String>,
  pub xray_result: Option<String>,
  pub side_effects: Option<String>,
  pub adherence: Option<String>,
  pub dispensed_drugs: Option<String>,
  pub notes: Option<String>,
  pub created_by: Option<String>,
  pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FollowupInput {
  pub hn: String,
  pub followup_date: String,
  pub month_number: Option<i64>,
  pub weight_kg: Option<f64>,
  pub sputum_result: Option<String>,
  pub xray_result: Option<String>,
  pub side_effects: Option<Vec<String>>,
  pub adherence: Option<String>,
  pub notes: Option<String>,
  pub created_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct Outcome {
  pub id: i64,
  pub hn: String,
  pub outcome: String,
  pub outcome_date: String,
  pub treatment_end: Option<String>,
  pub notes: Option<String>,
  pub created_by: Option<String>,
  pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutcomeInput {
  pub hn: String,
  pub outcome: String,
  pub outcome_date: String,
  pub treatment_end: Option<String>,
  pub notes: Option<String>,
  pub created_by: Option<String>,
}
