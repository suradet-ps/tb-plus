use crate::commands::settings::MySqlState;
use crate::db;
use crate::models::mapping::{BatchGeocodeResult, MappingPatientRow, MappingSummary};
use crate::models::patient::{PatientDemographics, TbPatient};
use crate::models::settings::GeocodeConfig;
use crate::settings::SettingsManager;
use chrono::Local;
use reqwest::Client;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::OnceLock;
use std::time::Duration;
use tauri::State;

fn geocode_lock() -> &'static tokio::sync::Mutex<()> {
  static GEOCODE_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
  GEOCODE_LOCK.get_or_init(|| tokio::sync::Mutex::new(()))
}

#[derive(Debug, Deserialize)]
struct NominatimResult {
  lat: String,
  lon: String,
}

#[tauri::command]
pub async fn get_mapping_patients(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  _settings: State<'_, SettingsManager>,
) -> Result<Vec<MappingPatientRow>, String> {
  let patients = db::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let locations = db::sqlite::get_all_patient_locations(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let mysql_pool = mysql.lock().await.clone();
  let demographics = if let Some(pool) = mysql_pool {
    db::mysql::get_patient_demographics_by_hns(&pool, &hns)
      .await
      .map_err(|e| e.to_string())?
  } else {
    HashMap::new()
  };

  Ok(build_mapping_rows(&patients, &locations, &demographics))
}

#[tauri::command]
pub async fn get_mapping_summary(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  _settings: State<'_, SettingsManager>,
) -> Result<MappingSummary, String> {
  let patients = db::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let locations = db::sqlite::get_all_patient_locations(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let mysql_pool = mysql.lock().await.clone();
  let demographics = if let Some(pool) = mysql_pool {
    db::mysql::get_patient_demographics_by_hns(&pool, &hns)
      .await
      .map_err(|e| e.to_string())?
  } else {
    HashMap::new()
  };

  let rows = build_mapping_rows(&patients, &locations, &demographics);

  let total_patients = rows.len() as i64;
  let active_patients = rows.iter().filter(|row| row.tb_status == "active").count() as i64;
  let mapped_patients = rows
    .iter()
    .filter(|row| row.geocode_status == "success" && row.lat.is_some() && row.lng.is_some())
    .count() as i64;
  let missing_address_patients = rows.iter().filter(|row| !row.has_address).count() as i64;

  Ok(MappingSummary {
    total_patients,
    active_patients,
    mapped_patients,
    unmapped_patients: total_patients - mapped_patients,
    missing_address_patients,
  })
}

#[tauri::command]
pub async fn geocode_patient_address(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  hn: String,
) -> Result<MappingPatientRow, String> {
  let mysql_pool = mysql
    .lock()
    .await
    .clone()
    .ok_or_else(|| "ยังไม่ได้เชื่อมต่อ HOSxP จึงไม่สามารถอ่านที่อยู่เพื่อทำแผนที่ได้".to_string())?;

  let patient = db::sqlite::get_patient_by_hn(&sqlite, &hn)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("ไม่พบผู้ป่วย HN {}", hn))?;

  let demographics = db::mysql::get_patient_demographics(&mysql_pool, &hn)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("ไม่พบข้อมูลผู้ป่วย HN {} ใน HOSxP", hn))?;

  let geocode_cfg = settings
    .get_geocode_config()
    .await
    .map_err(|e| e.to_string())?;

  geocode_patient_core(&sqlite, &patient, &demographics, &geocode_cfg)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn batch_geocode_patients(
  sqlite: State<'_, SqlitePool>,
  mysql: State<'_, MySqlState>,
  settings: State<'_, SettingsManager>,
  limit: Option<usize>,
) -> Result<BatchGeocodeResult, String> {
  let mysql_pool = mysql
    .lock()
    .await
    .clone()
    .ok_or_else(|| "ยังไม่ได้เชื่อมต่อ HOSxP จึงไม่สามารถอ่านที่อยู่เพื่อทำแผนที่ได้".to_string())?;

  let patients = db::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let demographics = db::mysql::get_patient_demographics_by_hns(&mysql_pool, &hns)
    .await
    .map_err(|e| e.to_string())?;
  let locations = db::sqlite::get_all_patient_locations(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let geocode_cfg = settings
    .get_geocode_config()
    .await
    .map_err(|e| e.to_string())?;

  let mut processed = 0_i64;
  let mut succeeded = 0_i64;
  let mut failed = 0_i64;
  let mut skipped = 0_i64;
  let capped_limit = limit
    .unwrap_or(geocode_cfg.batch_default_limit as usize)
    .clamp(1, geocode_cfg.batch_max_limit as usize);

  for patient in patients {
    if processed >= capped_limit as i64 {
      break;
    }

    let Some(demographics_row) = demographics.get(&patient.hn) else {
      skipped += 1;
      continue;
    };

    let has_cached_success = locations
      .get(&patient.hn)
      .map(|location| {
        location.geocode_status == "success"
          && location.lat.is_some()
          && location.lng.is_some()
          && normalize_address(&location.raw_address)
            == normalize_address_opt(demographics_row.address.as_deref())
      })
      .unwrap_or(false);

    if has_cached_success {
      skipped += 1;
      continue;
    }

    processed += 1;
    match geocode_patient_core(&sqlite, &patient, demographics_row, &geocode_cfg).await {
      Ok(_) => succeeded += 1,
      Err(_) => failed += 1,
    }
  }

  Ok(BatchGeocodeResult {
    processed,
    succeeded,
    failed,
    skipped,
  })
}

fn build_mapping_rows(
  patients: &[TbPatient],
  locations: &HashMap<String, crate::models::mapping::TbPatientLocation>,
  demographics: &HashMap<String, PatientDemographics>,
) -> Vec<MappingPatientRow> {
  patients
    .iter()
    .map(|patient| {
      let demographics_row = demographics.get(&patient.hn);
      let location = locations.get(&patient.hn);
      let live_address = demographics_row.and_then(|row| row.address.as_deref());
      let cached_address = location.map(|item| item.raw_address.as_str());
      let effective_address = live_address.or(cached_address);
      let address_changed = match (live_address, location) {
        (Some(address), Some(location_row)) => {
          normalize_address(address) != normalize_address(&location_row.raw_address)
        }
        _ => false,
      };

      let geocode_status = if !has_text(effective_address) {
        "missing_address".to_string()
      } else if address_changed {
        "pending".to_string()
      } else {
        location
          .map(|item| item.geocode_status.clone())
          .unwrap_or_else(|| "pending".to_string())
      };

      MappingPatientRow {
        hn: patient.hn.clone(),
        masked_hn: mask_hn(&patient.hn),
        masked_name: demographics_row
          .map(|row| mask_name(&row.full_name))
          .unwrap_or_else(|| "ไม่ระบุชื่อ".to_string()),
        tb_status: patient.status.clone(),
        tb_type: patient.tb_type.clone(),
        enrolled_at: patient.enrolled_at.clone(),
        diagnosis_date: patient.diagnosis_date.clone(),
        has_address: has_text(effective_address),
        address_preview: effective_address.map(address_preview),
        geocode_status,
        geocode_error: if address_changed {
          None
        } else {
          location.and_then(|item| item.geocode_error.clone())
        },
        lat: if address_changed {
          None
        } else {
          location.and_then(|item| item.jittered_lat.or(item.lat))
        },
        lng: if address_changed {
          None
        } else {
          location.and_then(|item| item.jittered_lng.or(item.lng))
        },
        geocoded_at: location.and_then(|item| item.geocoded_at.clone()),
      }
    })
    .collect()
}

fn build_single_mapping_row(
  patient: &TbPatient,
  location: crate::models::mapping::TbPatientLocation,
  demographics: PatientDemographics,
) -> Result<MappingPatientRow, anyhow::Error> {
  build_mapping_rows(
    std::slice::from_ref(patient),
    &HashMap::from([(patient.hn.clone(), location)]),
    &HashMap::from([(patient.hn.clone(), demographics)]),
  )
  .into_iter()
  .next()
  .ok_or_else(|| anyhow::anyhow!("ไม่สามารถสร้างข้อมูลแผนที่ของผู้ป่วยได้"))
}

async fn geocode_patient_core(
  sqlite: &SqlitePool,
  patient: &TbPatient,
  demographics: &PatientDemographics,
  geocode_cfg: &GeocodeConfig,
) -> Result<MappingPatientRow, anyhow::Error> {
  let raw_address = demographics
    .address
    .as_deref()
    .filter(|address| has_text(Some(address)))
    .ok_or_else(|| anyhow::anyhow!("ผู้ป่วยรายนี้ไม่มีข้อมูลที่อยู่ใน HOSxP"))?
    .trim()
    .to_string();

  let normalized_address = normalize_address(&raw_address);
  let existing = db::sqlite::get_patient_location(sqlite, &patient.hn).await?;

  if let Some(location) = &existing
    && location.geocode_status == "success"
    && location.lat.is_some()
    && location.lng.is_some()
    && location.normalized_address.as_deref() == Some(normalized_address.as_str())
  {
    return build_single_mapping_row(patient, location.clone(), demographics.clone());
  }

  let previous_attempts = existing
    .as_ref()
    .map(|item| item.geocode_attempts)
    .unwrap_or(0);
  let geocode_result = geocode_address_with_rate_limit(&normalized_address, geocode_cfg).await;

  let (lat, lng, jittered_lat, jittered_lng, geocode_status, geocode_error, geocoded_at) =
    match geocode_result {
      Ok((lat, lng)) => {
        let (j_lat, j_lng) =
          jitter_coordinates(lat, lng, &patient.hn, geocode_cfg.jitter_range_degrees);
        (
          Some(lat),
          Some(lng),
          Some(j_lat),
          Some(j_lng),
          "success".to_string(),
          None,
          Some(Local::now().format("%Y-%m-%dT%H:%M:%S").to_string()),
        )
      }
      Err(error) => (
        None,
        None,
        None,
        None,
        "failed".to_string(),
        Some(error.to_string()),
        None,
      ),
    };

  db::sqlite::upsert_patient_location(
    sqlite,
    &db::sqlite::UpsertPatientLocationInput {
      hn: patient.hn.clone(),
      raw_address: raw_address.clone(),
      normalized_address: Some(normalized_address),
      lat,
      lng,
      jittered_lat,
      jittered_lng,
      geocode_status,
      geocode_error,
      geocode_attempts: previous_attempts + 1,
      geocoded_at,
    },
  )
  .await?;

  let location = db::sqlite::get_patient_location(sqlite, &patient.hn)
    .await?
    .ok_or_else(|| anyhow::anyhow!("บันทึกตำแหน่งผู้ป่วยไม่สำเร็จ"))?;

  build_single_mapping_row(patient, location, demographics.clone())
}

async fn geocode_address_with_rate_limit(
  address: &str,
  cfg: &GeocodeConfig,
) -> Result<(f64, f64), anyhow::Error> {
  let _guard = geocode_lock().lock().await;
  let client = Client::builder()
    .timeout(Duration::from_secs(cfg.http_timeout_seconds))
    .user_agent(&cfg.user_agent)
    .build()?;

  let mut last_error: Option<anyhow::Error> = None;
  let candidates = build_geocode_queries(address);

  for candidate in candidates {
    for attempt in 0..cfg.max_retries {
      tokio::time::sleep(Duration::from_millis(cfg.rate_limit_sleep_ms)).await;

      let url_with_params = reqwest::Url::parse_with_params(
        &cfg.nominatim_url,
        &[
          ("q", candidate.as_str()),
          ("format", "jsonv2"),
          ("limit", "1"),
          ("countrycodes", &cfg.country_code),
        ],
      )?;
      let response = client.get(url_with_params).send().await;

      match response {
        Ok(result) => {
          let result = result.error_for_status()?;
          let rows = result.json::<Vec<NominatimResult>>().await?;
          if let Some(first) = rows.first() {
            let lat = first.lat.parse::<f64>()?;
            let lng = first.lon.parse::<f64>()?;
            return Ok((lat, lng));
          }
          last_error = Some(anyhow::anyhow!("ไม่พบพิกัดจากที่อยู่นี้"));
        }
        Err(error) => {
          last_error = Some(anyhow::anyhow!(error));
        }
      }

      if attempt < 2 {
        tokio::time::sleep(Duration::from_secs(1_u64 << attempt)).await;
      }
    }
  }

  Err(last_error.unwrap_or_else(|| anyhow::anyhow!("ไม่สามารถแปลงที่อยู่เป็นพิกัดได้")))
}

fn normalize_address(raw_address: &str) -> String {
  let collapsed = raw_address
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
    .replace(',', " ");
  let collapsed = collapsed
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
    .trim()
    .to_string();

  if collapsed.is_empty()
    || collapsed.contains("ประเทศไทย")
    || collapsed.to_lowercase().contains("thailand")
  {
    collapsed
  } else {
    format!("{collapsed} ประเทศไทย")
  }
}

fn normalize_address_opt(raw_address: Option<&str>) -> String {
  raw_address.map(normalize_address).unwrap_or_default()
}

fn build_geocode_queries(address: &str) -> Vec<String> {
  let normalized = normalize_address(address);
  let raw_without_country = normalized
    .strip_suffix(" ประเทศไทย")
    .unwrap_or(&normalized)
    .trim()
    .to_string();
  let expanded = expand_thai_address_tokens(&raw_without_country);

  let mut queries = Vec::new();
  push_unique_query(&mut queries, normalized);

  if expanded != raw_without_country {
    push_unique_query(&mut queries, normalize_address(&expanded));
  }

  let subdistrict = extract_admin_segment(&expanded, &["ตำบล", "ต."]);
  let district = extract_admin_segment(&expanded, &["อำเภอ", "อ."]);
  let province = extract_admin_segment(&expanded, &["จังหวัด", "จ."]);

  if let (Some(subdistrict), Some(district), Some(province)) = (
    subdistrict.as_deref(),
    district.as_deref(),
    province.as_deref(),
  ) {
    push_unique_query(
      &mut queries,
      normalize_address(&format!("{subdistrict} {district} {province}")),
    );
    push_unique_query(
      &mut queries,
      normalize_address(&format!(
        "ตำบล{subdistrict} อำเภอ{district} จังหวัด{province}"
      )),
    );
  }

  if let (Some(district), Some(province)) = (district.as_deref(), province.as_deref()) {
    push_unique_query(
      &mut queries,
      normalize_address(&format!("{district} {province}")),
    );
    push_unique_query(
      &mut queries,
      normalize_address(&format!("อำเภอ{district} จังหวัด{province}")),
    );
  }

  if let Some(stripped) = strip_house_number_prefix(&expanded) {
    push_unique_query(&mut queries, normalize_address(&stripped));
  }

  queries
}

fn push_unique_query(queries: &mut Vec<String>, candidate: String) {
  let trimmed = candidate.trim();
  if trimmed.is_empty() {
    return;
  }

  if !queries.iter().any(|existing| existing == trimmed) {
    queries.push(trimmed.to_string());
  }
}

fn expand_thai_address_tokens(address: &str) -> String {
  address
    .replace("ต.", "ตำบล")
    .replace("อ.", "อำเภอ")
    .replace("จ.", "จังหวัด")
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
}

fn extract_admin_segment(address: &str, prefixes: &[&str]) -> Option<String> {
  for token in address.split_whitespace() {
    for prefix in prefixes {
      if token.starts_with(prefix) {
        let suffix = token.trim_start_matches(prefix).trim();
        if !suffix.is_empty() {
          return Some(suffix.to_string());
        }
      }
    }
  }

  None
}

fn strip_house_number_prefix(address: &str) -> Option<String> {
  let tokens = address.split_whitespace().collect::<Vec<_>>();
  let mut start_index = 0;

  while start_index < tokens.len() {
    let token = tokens[start_index];
    let is_house_number = token.chars().any(|ch| ch.is_ascii_digit())
      && !token.starts_with("ตำบล")
      && !token.starts_with("อำเภอ");
    let is_moo_marker = token == "หมู่" || token.starts_with("หมู่");

    if is_house_number || is_moo_marker {
      start_index += 1;
      continue;
    }

    break;
  }

  if start_index >= tokens.len() {
    None
  } else {
    Some(tokens[start_index..].join(" "))
  }
}

fn jitter_coordinates(lat: f64, lng: f64, key: &str, jitter_range: f64) -> (f64, f64) {
  let lat_offset = deterministic_offset(&(key.to_string() + "-lat"), jitter_range);
  let lng_offset = deterministic_offset(&(key.to_string() + "-lng"), jitter_range);
  (
    (lat + lat_offset).clamp(-90.0, 90.0),
    (lng + lng_offset).clamp(-180.0, 180.0),
  )
}

fn deterministic_offset(key: &str, jitter_range: f64) -> f64 {
  let mut hasher = std::collections::hash_map::DefaultHasher::new();
  key.hash(&mut hasher);
  let hash = hasher.finish();
  let normalized = (hash % 10_001) as f64 / 10_000.0;
  (normalized - 0.5) * jitter_range * 2.0
}

fn has_text(value: Option<&str>) -> bool {
  value.map(|text| !text.trim().is_empty()).unwrap_or(false)
}

fn mask_hn(hn: &str) -> String {
  let suffix = hn
    .chars()
    .rev()
    .take(4)
    .collect::<Vec<_>>()
    .into_iter()
    .rev()
    .collect::<String>();
  format!("HN ••••{suffix}")
}

fn mask_name(full_name: &str) -> String {
  let compact = full_name.trim();
  if compact.is_empty() {
    return "ไม่ระบุชื่อ".to_string();
  }

  let parts = compact.split_whitespace().collect::<Vec<_>>();
  if parts.len() >= 2 {
    let first = parts[0].chars().take(1).collect::<String>();
    let second = parts[1].chars().take(1).collect::<String>();
    return format!("{first}•• {second}••");
  }

  let head = compact.chars().take(2).collect::<String>();
  format!("{head}••")
}

fn address_preview(raw_address: &str) -> String {
  let compact = raw_address.split_whitespace().collect::<Vec<_>>().join(" ");
  if compact.chars().count() <= 40 {
    compact
  } else {
    format!("{}...", compact.chars().take(40).collect::<String>())
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — pure helper functions (no DB, no network required)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  // ---------------------------------------------------------------------------
  // normalize_address
  // ---------------------------------------------------------------------------

  #[test]
  fn test_normalize_already_has_thailand() {
    let addr = "123 ถนนสุขุม ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี ประเทศไทย";
    assert!(normalize_address(addr).ends_with("ประเทศไทย"));
    assert!(!normalize_address(addr).ends_with("ประเทศไทย ประเทศไทย"));
  }

  #[test]
  fn test_normalize_adds_thailand_suffix() {
    let addr = "123 ถนนสุขุม ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี";
    assert_eq!(
      normalize_address(addr),
      "123 ถนนสุขุม ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี ประเทศไทย"
    );
  }

  #[test]
  fn test_normalize_english_thailand() {
    let addr = "123 Sukhum Rd Thailand";
    assert_eq!(normalize_address(addr), addr);
  }

  #[test]
  fn test_normalize_empty_string() {
    assert_eq!(normalize_address(""), "");
  }

  #[test]
  fn test_normalize_collapse_whitespace() {
    let addr = "123   ถนน   สุขุม   ตำบล  ในเมือง";
    assert!(!normalize_address(addr).contains("  "));
  }

  #[test]
  fn test_normalize_collapse_comma() {
    let addr = "123, ถนนสุขุม, ตำบลในเมือง";
    assert!(!normalize_address(addr).contains(','));
  }

  // ---------------------------------------------------------------------------
  // expand_thai_address_tokens
  // ---------------------------------------------------------------------------

  #[test]
  fn test_expand_thai_address_tokens_full() {
    let input = "123 หมู่ 5 ต.ในเมือง อ.เมือง จ.สระบุรี";
    let expanded = expand_thai_address_tokens(input);
    assert!(expanded.contains("ตำบล"));
    assert!(expanded.contains("อำเภอ"));
    assert!(expanded.contains("จังหวัด"));
  }

  #[test]
  fn test_expand_thai_address_tokens_no_change() {
    let input = "123 ถนนสุขุม ตำบลในเมือง";
    let expanded = expand_thai_address_tokens(input);
    assert_eq!(expanded, "123 ถนนสุขุม ตำบลในเมือง");
  }

  #[test]
  fn test_expand_thai_address_tokens_already_expanded() {
    let input = "ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี";
    let expanded = expand_thai_address_tokens(input);
    assert!(expanded.contains("ตำบล"));
    assert!(expanded.contains("อำเภอ"));
    assert!(expanded.contains("จังหวัด"));
  }

  // ---------------------------------------------------------------------------
  // extract_admin_segment
  // ---------------------------------------------------------------------------

  #[test]
  fn test_extract_admin_segment_tambon() {
    let result = extract_admin_segment("123 ตำบลในเมือง อำเภอ", &["ตำบล", "ต."]);
    assert_eq!(result, Some(String::from("ในเมือง")));
  }

  #[test]
  fn test_extract_admin_segment_abbrev() {
    let result = extract_admin_segment("456 ต.ในเมือง อ.", &["ตำบล", "ต."]);
    assert_eq!(result, Some(String::from("ในเมือง")));
  }

  #[test]
  fn test_extract_admin_segment_not_found() {
    let result = extract_admin_segment("789 ถนนสุขุม", &["ตำบล", "ต."]);
    assert_eq!(result, None);
  }

  #[test]
  fn test_extract_admin_segment_empty_suffix() {
    // "ต." → suffix is "" (empty), but the function returns None for empty suffix
    let result = extract_admin_segment("ต.", &["ตำบล", "ต."]);
    // Implementation returns None for empty suffix (guards `!suffix.is_empty()`)
    assert_eq!(result, None);
  }

  // ---------------------------------------------------------------------------
  // strip_house_number_prefix
  // ---------------------------------------------------------------------------

  #[test]
  fn test_strip_house_number_prefix_numeric() {
    let input = "123 ถนนสุขุม ตำบลในเมือง";
    assert_eq!(
      strip_house_number_prefix(input),
      Some(String::from("ถนนสุขุม ตำบลในเมือง"))
    );
  }

  #[test]
  fn test_strip_house_number_prefix_moo() {
    let input = "หมู่ 5 บ้านใหม่ ตำบลในเมือง";
    assert_eq!(
      strip_house_number_prefix(input),
      Some(String::from("บ้านใหม่ ตำบลในเมือง"))
    );
  }

  #[test]
  fn test_strip_house_number_prefix_no_strip_when_no_leading_prefix() {
    let input = "ตำบลในเมือง อำเภอเมือง";
    // Function returns full address when first token is not a house-number or "หมู่" prefix
    // (since the loop breaks immediately at start_index=0)
    let result = strip_house_number_prefix(input);
    assert_eq!(result, Some(input.to_string()));
  }

  #[test]
  fn test_strip_house_number_prefix_all_numeric() {
    let input = "123 456 789";
    assert_eq!(strip_house_number_prefix(input), None);
  }

  // ---------------------------------------------------------------------------
  // jitter_coordinates (deterministic)
  // ---------------------------------------------------------------------------

  const TEST_JITTER_RANGE: f64 = 0.005;

  #[test]
  fn test_jitter_is_deterministic() {
    let (lat1, lng1) = jitter_coordinates(13.7563, 100.5018, "HN0001", TEST_JITTER_RANGE);
    let (lat2, lng2) = jitter_coordinates(13.7563, 100.5018, "HN0001", TEST_JITTER_RANGE);
    assert_eq!(lat1, lat2);
    assert_eq!(lng1, lng2);
  }

  #[test]
  fn test_jitter_different_keys_different_offsets() {
    let (lat1, _) = jitter_coordinates(13.7563, 100.5018, "HN0001", TEST_JITTER_RANGE);
    let (lat2, _) = jitter_coordinates(13.7563, 100.5018, "HN9999", TEST_JITTER_RANGE);
    assert_ne!(lat1, lat2);
  }

  #[test]
  fn test_jitter_stays_in_valid_range() {
    for key in &["A", "B", "C"] {
      let (lat, lng) = jitter_coordinates(0.0, 0.0, key, TEST_JITTER_RANGE);
      assert!((-90.0..=90.0).contains(&lat), "lat out of range: {lat}");
      assert!((-180.0..=180.0).contains(&lng), "lng out of range: {lng}");
    }
  }

  #[test]
  fn test_jitter_at_extreme_latitudes() {
    let (lat, _) = jitter_coordinates(89.5, 0.0, "HN001", TEST_JITTER_RANGE);
    assert!(lat <= 90.0);
    let (lat, _) = jitter_coordinates(-89.5, 0.0, "HN002", TEST_JITTER_RANGE);
    assert!(lat >= -90.0);
  }

  // ---------------------------------------------------------------------------
  // deterministic_offset
  // ---------------------------------------------------------------------------

  #[test]
  fn test_deterministic_offset_same_input_same_output() {
    let a = deterministic_offset("test-key", TEST_JITTER_RANGE);
    let b = deterministic_offset("test-key", TEST_JITTER_RANGE);
    assert_eq!(a, b);
  }

  #[test]
  fn test_deterministic_offset_different_inputs() {
    let a = deterministic_offset("key-a", TEST_JITTER_RANGE);
    let b = deterministic_offset("key-b", TEST_JITTER_RANGE);
    assert_ne!(a, b);
  }

  // ---------------------------------------------------------------------------
  // mask_hn
  // ---------------------------------------------------------------------------

  #[test]
  fn test_mask_hn_shows_last_4() {
    let result = mask_hn("00012345");
    assert!(result.contains("2345"));
    assert!(result.starts_with("HN ••••"));
  }

  #[test]
  fn test_mask_hn_short_hn() {
    let result = mask_hn("1234");
    assert!(result.starts_with("HN ••••"));
  }

  #[test]
  fn test_mask_hn_very_short() {
    let result = mask_hn("1");
    assert!(result.starts_with("HN ••••"));
  }

  // ---------------------------------------------------------------------------
  // mask_name
  // ---------------------------------------------------------------------------

  #[test]
  fn test_mask_name_two_words() {
    let result = mask_name("สมชาย ใจดี");
    assert!(result.contains("••"));
    assert!(!result.contains("สม"));
  }

  #[test]
  fn test_mask_name_three_words() {
    let result = mask_name("นาย สมชาย ใจดี");
    assert!(result.contains("••"));
  }

  #[test]
  fn test_mask_name_single_word() {
    let result = mask_name("สมชาย");
    assert!(result.ends_with("••"));
  }

  #[test]
  fn test_mask_name_empty() {
    assert_eq!(mask_name(""), "ไม่ระบุชื่อ");
  }

  #[test]
  fn test_mask_name_whitespace_only() {
    assert_eq!(mask_name("   "), "ไม่ระบุชื่อ");
  }

  // ---------------------------------------------------------------------------
  // address_preview
  // ---------------------------------------------------------------------------

  #[test]
  fn test_address_preview_short_unchanged() {
    let addr = "123 ถนนสุขุม ตำบลในเมือง";
    assert_eq!(address_preview(addr), addr);
  }

  #[test]
  fn test_address_preview_long_truncated() {
    let addr = "123 ถนนสุขุมมากมาย ซอย 5 หมู่บ้านรุ่งเรือง ถนนเทศบาล ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี";
    let result = address_preview(addr);
    assert!(result.ends_with("..."));
    // Original address has Thai chars which are 2+ bytes; "..." is 3 bytes
    // The function joins by space, so char count vs byte count differ.
    // We verify it ends with ... and is not the full address.
    assert!(
      result.len() < addr.len(),
      "should be shorter than original {} chars",
      addr.len()
    );
  }

  // ---------------------------------------------------------------------------
  // build_geocode_queries
  // ---------------------------------------------------------------------------

  #[test]
  fn test_build_geocode_queries_deduplicates() {
    let queries = build_geocode_queries("123 ถนนสุขุม ตำบลในเมือง อำเภอเมือง จังหวัดสระบุรี ประเทศไทย");
    assert!(!queries.is_empty());
    // No duplicate entries
    let unique: std::collections::HashSet<_> = queries.iter().collect();
    assert_eq!(unique.len(), queries.len());
  }

  #[test]
  fn test_build_geocode_queries_includes_abbreviated() {
    let queries = build_geocode_queries("123 ถนน ต.ในเมือง อ.เมือง จ.สระบุรี");
    assert!(!queries.is_empty());
    // Should include expanded version
    let has_expanded = queries
      .iter()
      .any(|q| q.contains("ตำบล") && q.contains("อำเภอ"));
    assert!(has_expanded);
  }

  #[test]
  fn test_build_geocode_queries_empty_address() {
    let queries = build_geocode_queries("");
    assert!(queries.is_empty());
  }

  // ---------------------------------------------------------------------------
  // normalize_address_opt
  // ---------------------------------------------------------------------------

  #[test]
  fn test_normalize_address_opt_some() {
    let result = normalize_address_opt(Some("123 ถนนสุขุม ตำบลในเมือง"));
    assert!(result.contains("ประเทศไทย"));
  }

  #[test]
  fn test_normalize_address_opt_none() {
    let result = normalize_address_opt(None);
    assert_eq!(result, "");
  }

  // ---------------------------------------------------------------------------
  // has_text
  // ---------------------------------------------------------------------------

  #[test]
  fn test_has_text_some_with_content() {
    assert!(has_text(Some("   hello ")));
    assert!(has_text(Some("x")));
  }

  #[test]
  fn test_has_text_some_empty() {
    assert!(!has_text(Some("")));
    assert!(!has_text(Some("   ")));
    assert!(!has_text(Some("\t")));
  }

  #[test]
  fn test_has_text_none() {
    assert!(!has_text(None));
  }
}
