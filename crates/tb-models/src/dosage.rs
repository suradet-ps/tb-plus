use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageDrugCandidate {
  pub class: String,
  pub icode: String,
  pub drug_name: String,
  pub strength: Option<String>,
  pub units: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosagePatientSummary {
  pub hn: String,
  pub full_name: String,
  pub age: Option<i64>,
  pub sex: Option<String>,
  pub birthday: Option<String>,
  pub latest_weight_kg: Option<f64>,
  pub latest_weight_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageAssessmentItem {
  pub class: String,
  pub icode: String,
  pub drug_name: String,
  pub strength: Option<String>,
  pub units: Option<String>,
  pub min_mg_per_kg_day: f64,
  pub max_mg_per_kg_day: f64,
  pub target_min_mg_day: Option<f64>,
  pub target_max_mg_day: Option<f64>,
  pub suggested_units_per_day: Option<u32>,
  pub suggested_daily_dose_mg: Option<f64>,
  pub dose_delta_mg: Option<f64>,
  pub within_target_range: bool,
  pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageAssessmentPhase {
  pub phase: String,
  pub months: u32,
  pub items: Vec<DosageAssessmentItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DosageAssessmentResult {
  pub patient: DosagePatientSummary,
  pub regimen_name: String,
  pub phases: Vec<DosageAssessmentPhase>,
  pub warnings: Vec<String>,
}
