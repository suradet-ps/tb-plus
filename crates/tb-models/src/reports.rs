use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DrugConsumptionRow {
  pub month: String,
  pub drug_class: String,
  pub total_qty: f64,
  pub dispensed_days: i64,
}
