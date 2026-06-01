use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatientAlert {
  pub hn: String,
  pub alert_type: String,
  pub severity: String,
  pub message: String,
  pub details: Option<String>,
}
