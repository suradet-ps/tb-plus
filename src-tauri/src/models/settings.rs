use serde::{Deserialize, Serialize};

/// A single drug item returned from HOSxP `drugitems` search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrugItem {
  pub icode: String,
  pub name: String,
  pub shortname: Option<String>,
  pub units: Option<String>,
}

/// A drug class definition — user assigns a letter (e.g. "H") to one or more icodes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrugClassEntry {
  pub class: String,
  pub icodes: Vec<String>,
  pub name: String,
}

/// One phase within a regimen (e.g. intensive 2 months with H,R,Z,E).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegimenPhase {
  pub phase: String,
  pub months: u32,
  pub drug_classes: Vec<String>,
}

/// A complete treatment regimen — user can define any number of phases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegimenEntry {
  pub name: String,
  pub phases: Vec<RegimenPhase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertConfig {
  pub overdue_days: u32,
  pub lost_followup_days: u32,
  pub e_overrun_lookback_days: u32,
  pub phase_transition_lookback_days: u32,
}

impl Default for AlertConfig {
  fn default() -> Self {
    Self {
      overdue_days: 35,
      lost_followup_days: 60,
      e_overrun_lookback_days: 30,
      phase_transition_lookback_days: 35,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationConfig {
  pub default_page_size: u32,
  pub max_page_size: u32,
}

impl Default for PaginationConfig {
  fn default() -> Self {
    Self {
      default_page_size: 50,
      max_page_size: 200,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HosxpConfig {
  pub clinic_code: String,
  pub table_opitemrece: String,
  pub table_patient: String,
  pub table_drugitems: String,
  pub table_ovst: String,
  pub table_oapp: String,
}

impl Default for HosxpConfig {
  fn default() -> Self {
    Self {
      clinic_code: "009".into(),
      table_opitemrece: "opitemrece".into(),
      table_patient: "patient".into(),
      table_drugitems: "drugitems".into(),
      table_ovst: "ovst".into(),
      table_oapp: "oapp".into(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeocodeConfig {
  pub nominatim_url: String,
  pub country_code: String,
  pub user_agent: String,
  pub http_timeout_seconds: u64,
  pub max_retries: u32,
  pub rate_limit_sleep_ms: u64,
  pub batch_default_limit: u32,
  pub batch_max_limit: u32,
  pub jitter_range_degrees: f64,
}

impl Default for GeocodeConfig {
  fn default() -> Self {
    Self {
      nominatim_url: "https://nominatim.openstreetmap.org/search".into(),
      country_code: "th".into(),
      user_agent: "TBPlusMapping/1.0 (tb-plus)".into(),
      http_timeout_seconds: 15,
      max_retries: 3,
      rate_limit_sleep_ms: 1000,
      batch_default_limit: 25,
      batch_max_limit: 100,
      jitter_range_degrees: 0.005,
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplashMessages {
  pub loading_db: String,
  pub connecting_mysql: String,
  pub connect_ok: String,
  pub connect_fail: String,
  pub connect_timeout: String,
  pub no_config: String,
  pub config_load_fail: String,
}

impl Default for SplashMessages {
  fn default() -> Self {
    Self {
      loading_db: "กำลังโหลดฐานข้อมูล...".into(),
      connecting_mysql: "กำลังเชื่อมต่อ MySQL...".into(),
      connect_ok: "เชื่อมต่อสำเร็จ ✓".into(),
      connect_fail: "เชื่อมต่อล้มเหลว (ใช้งานออฟไลน์ได้)".into(),
      connect_timeout: "เชื่อมต่อหมดเวลา (ใช้งานออฟไลน์ได้)".into(),
      no_config: "พร้อมใช้งาน (ยังไม่ตั้งค่า MySQL)".into(),
      config_load_fail: "โหลดการตั้งค่าล้มเหลว".into(),
    }
  }
}
