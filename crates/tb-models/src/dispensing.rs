use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DispensingRecord {
  pub vstdate: String,
  pub icode: String,
  pub drug_name: Option<String>,
  pub qty: Option<f64>,
  pub units: Option<String>,
  pub drug_class: Option<String>,
}
