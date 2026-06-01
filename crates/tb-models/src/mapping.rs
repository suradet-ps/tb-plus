use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct TbPatientLocation {
  pub hn: String,
  pub raw_address: String,
  pub normalized_address: Option<String>,
  pub lat: Option<f64>,
  pub lng: Option<f64>,
  pub jittered_lat: Option<f64>,
  pub jittered_lng: Option<f64>,
  pub geocode_status: String,
  pub geocode_error: Option<String>,
  pub geocode_attempts: i64,
  pub geocoded_at: Option<String>,
  pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingPatientRow {
  pub hn: String,
  pub masked_hn: String,
  pub masked_name: String,
  pub tb_status: String,
  pub tb_type: Option<String>,
  pub enrolled_at: String,
  pub diagnosis_date: Option<String>,
  pub has_address: bool,
  pub address_preview: Option<String>,
  pub geocode_status: String,
  pub geocode_error: Option<String>,
  pub lat: Option<f64>,
  pub lng: Option<f64>,
  pub geocoded_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingSummary {
  pub total_patients: i64,
  pub active_patients: i64,
  pub mapped_patients: i64,
  pub unmapped_patients: i64,
  pub missing_address_patients: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchGeocodeResult {
  pub processed: i64,
  pub succeeded: i64,
  pub failed: i64,
  pub skipped: i64,
}
