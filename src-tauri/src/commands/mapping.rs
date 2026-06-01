use crate::commands::settings::MySqlState;
use tb_database;
use tb_logic::address::{
  address_preview, build_geocode_queries, has_text, jitter_coordinates, mask_hn, mask_name,
  normalize_address, normalize_address_opt,
};
use tb_models::mapping::{BatchGeocodeResult, MappingPatientRow, MappingSummary};
use tb_models::patient::{PatientDemographics, TbPatient};
use tb_models::settings::GeocodeConfig;

use chrono::Local;
use reqwest::Client;
use serde::Deserialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::State;
use tb_database::SettingsManager;

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
  let patients = tb_database::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let locations = tb_database::sqlite::get_all_patient_locations(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let mysql_pool = mysql.lock().await.clone();
  let demographics = if let Some(pool) = mysql_pool {
    tb_database::mysql::get_patient_demographics_by_hns(&pool, &hns)
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
  let patients = tb_database::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let locations = tb_database::sqlite::get_all_patient_locations(&sqlite)
    .await
    .map_err(|e| e.to_string())?;

  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let mysql_pool = mysql.lock().await.clone();
  let demographics = if let Some(pool) = mysql_pool {
    tb_database::mysql::get_patient_demographics_by_hns(&pool, &hns)
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

  let patient = tb_database::sqlite::get_patient_by_hn(&sqlite, &hn)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("ไม่พบผู้ป่วย HN {}", hn))?;

  let demographics = tb_database::mysql::get_patient_demographics(&mysql_pool, &hn)
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

  let patients = tb_database::sqlite::get_all_tb_patients(&sqlite)
    .await
    .map_err(|e| e.to_string())?;
  let hns = patients
    .iter()
    .map(|patient| patient.hn.clone())
    .collect::<Vec<_>>();
  let demographics = tb_database::mysql::get_patient_demographics_by_hns(&mysql_pool, &hns)
    .await
    .map_err(|e| e.to_string())?;
  let locations = tb_database::sqlite::get_all_patient_locations(&sqlite)
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
  locations: &HashMap<String, tb_models::mapping::TbPatientLocation>,
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
  location: tb_models::mapping::TbPatientLocation,
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
  let existing = tb_database::sqlite::get_patient_location(sqlite, &patient.hn).await?;

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

  tb_database::sqlite::upsert_patient_location(
    sqlite,
    &tb_database::sqlite::UpsertPatientLocationInput {
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

  let location = tb_database::sqlite::get_patient_location(sqlite, &patient.hn)
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
