use crate::models::dispensing::DispensingRecord;
use crate::models::patient::{
  AppointmentRecord, PatientDemographics, PatientDrugRecord, SearchFilters,
};
use crate::models::settings::DrugItem;
use anyhow::Result;
use sqlx::{MySqlPool, QueryBuilder};
use std::collections::HashMap;

// ── HOSxP table names (hardcoded defaults, not configurable) ─────────
const TABLE_OPITEMRECE: &str = "opitemrece";
const TABLE_PATIENT: &str = "patient";
const TABLE_DRUGITEMS: &str = "drugitems";
const TABLE_OAPP: &str = "oapp";
const TABLE_CLINIC: &str = "clinic";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

fn icodes_for_classes(
  classes: &[String],
  class_to_icodes: &HashMap<String, Vec<String>>,
) -> Vec<String> {
  let mut out = Vec::new();
  for c in classes {
    if let Some(icodes) = class_to_icodes.get(&c.to_uppercase()) {
      out.extend_from_slice(icodes);
    }
  }
  out
}

/// Convert a comma-separated icode list (from GROUP_CONCAT) into sorted,
/// de-duplicated drug class letters.
fn drug_classes_from_icode_csv(
  csv: &str,
  icode_to_class_map: &HashMap<String, String>,
) -> Vec<String> {
  let mut seen = Vec::new();
  for code in csv.split(',') {
    if let Some(cls) = icode_to_class_map.get(code.trim())
      && !seen.contains(cls)
    {
      seen.push(cls.clone());
    }
  }
  seen.sort();
  seen
}

/// Build a `?, ?, …` placeholder string for an IN clause.
fn in_placeholders(count: usize) -> String {
  (0..count).map(|_| "?").collect::<Vec<_>>().join(", ")
}

// ---------------------------------------------------------------------------
// Intermediate FromRow structs (never serialised to frontend)
// ---------------------------------------------------------------------------

/// Raw row returned by the screening aggregate query.
#[derive(sqlx::FromRow)]
struct ScreeningRow {
  hn: String,
  full_name: String,
  age: Option<i64>,
  sex: Option<String>,
  first_dispensed: Option<String>,
  last_dispensed: Option<String>,
  visit_count: i64,
  /// Comma-separated raw icodes, e.g. "1000258,1000265,1430104"
  icode_list: Option<String>,
  drug_names: Option<String>,
}

/// Raw row returned by the patient demographics lookup.
#[derive(sqlx::FromRow)]
struct DemographicsRow {
  hn: String,
  full_name: String,
  age: Option<i64>,
  sex: Option<String>,
  address: Option<String>,
  phone: Option<String>,
  birthday: Option<String>,
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/// Search all patients who have ever received any of the 6 TB drug icodes.
///
/// - Optional date-range filter applied on `opitemrece.vstdate`.
/// - Optional drug-class multi-select filter reduces the IN clause.
/// - Optional `hn_search` / `name_search` filters applied as SQL WHERE predicates.
/// - Enrollment-status filter (`"all"` / `"enrolled"` / `"not_enrolled"` / `"discharged"`)
///   is applied in Rust using the pre-fetched `enrolled_map` (hn → status) so that
///   we never need to join against the local SQLite DB inside HOSxP.
/// - Results are paginated; default page size is 50, maximum is 200.
pub async fn search_tb_patients(
  pool: &MySqlPool,
  filters: &SearchFilters,
  enrolled_map: &HashMap<String, String>,
  all_icodes: &[String],
  class_to_icodes: &HashMap<String, Vec<String>>,
  icode_to_class_map: &HashMap<String, String>,
) -> Result<Vec<PatientDrugRecord>> {
  // Resolve which icodes to include based on the drug-class filter
  let icodes: Vec<String> = filters
    .drug_classes
    .as_deref()
    .map(|classes| {
      let v = icodes_for_classes(classes, class_to_icodes);
      if v.is_empty() { all_icodes.to_vec() } else { v }
    })
    .unwrap_or_else(|| all_icodes.to_vec());

  // Build SQL dynamically — IN clause, optional date predicates, optional
  // hn/name search predicates all go into WHERE (before GROUP BY).
  let mut sql = format!(
    "SELECT \
            p.hn, \
            CONCAT(COALESCE(p.pname, ''), p.fname, ' ', p.lname) AS full_name, \
            TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age, \
            p.sex, \
            DATE_FORMAT(MIN(o.vstdate), '%Y-%m-%d') AS first_dispensed, \
            DATE_FORMAT(MAX(o.vstdate), '%Y-%m-%d') AS last_dispensed, \
            COUNT(DISTINCT DATE_FORMAT(o.vstdate, '%Y-%m-%d')) AS visit_count, \
            GROUP_CONCAT(DISTINCT o.icode ORDER BY o.icode SEPARATOR ',') AS icode_list, \
            GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ', ') AS drug_names \
        FROM {TABLE_OPITEMRECE} o \
        JOIN {TABLE_PATIENT} p ON o.hn = p.hn \
        JOIN {TABLE_DRUGITEMS} d ON o.icode = d.icode \
        WHERE o.icode IN ({}) ",
    in_placeholders(icodes.len())
  );

  if filters.date_from.is_some() {
    sql.push_str("AND o.vstdate >= ? ");
  }
  if filters.date_to.is_some() {
    sql.push_str("AND o.vstdate <= ? ");
  }
  // HN search — exact prefix match on the real column (before GROUP BY)
  if filters.hn_search.is_some() {
    sql.push_str("AND p.hn LIKE ? ");
  }
  // Name search — match against the concatenated name expression (before GROUP BY)
  if filters.name_search.is_some() {
    sql.push_str("AND CONCAT(COALESCE(p.pname,''), p.fname, ' ', p.lname) LIKE ? ");
  }

  sql.push_str("GROUP BY p.hn ORDER BY last_dispensed DESC");

  // Pagination
  let page = filters.page.unwrap_or(1).max(1);
  let page_size = filters.page_size.unwrap_or(50).clamp(1, 200);
  let offset = (page - 1) * page_size;
  sql.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));

  // Bind parameters in the same order they appear in the SQL
  let mut q = sqlx::query_as::<_, ScreeningRow>(&sql);
  for icode in &icodes {
    q = q.bind(icode.as_str());
  }
  if let Some(df) = &filters.date_from {
    q = q.bind(df.as_str());
  }
  if let Some(dt) = &filters.date_to {
    q = q.bind(dt.as_str());
  }
  if let Some(hn) = &filters.hn_search {
    q = q.bind(format!("{}%", hn));
  }
  if let Some(name) = &filters.name_search {
    q = q.bind(format!("%{}%", name));
  }

  let rows = q.fetch_all(pool).await?;

  let mut out = Vec::with_capacity(rows.len());
  for row in rows {
    let patient_status = enrolled_map.get(&row.hn).cloned();
    let is_enrolled = patient_status.is_some();

    // Apply enrollment-status filter in Rust (avoids a cross-DB join)
    match filters.enrollment_status.as_deref() {
      Some("enrolled") => match &patient_status {
        Some(s) if s == "active" => {}
        _ => continue,
      },
      Some("not_enrolled") if is_enrolled => continue,
      Some("discharged") => match &patient_status {
        Some(s) if s != "active" => {}
        _ => continue,
      },
      _ => {}
    }

    let drug_classes = row
      .icode_list
      .as_deref()
      .map(|csv| drug_classes_from_icode_csv(csv, icode_to_class_map))
      .unwrap_or_default();

    out.push(PatientDrugRecord {
      hn: row.hn,
      full_name: row.full_name,
      age: row.age,
      sex: row.sex,
      first_dispensed: row.first_dispensed,
      last_dispensed: row.last_dispensed,
      visit_count: row.visit_count,
      drug_names: row.drug_names,
      drug_classes,
      is_enrolled,
      patient_status,
    });
  }

  Ok(out)
}

/// Fetch HOSxP patient demographics for a single HN.
/// Returns `None` when the HN does not exist in the HOSxP `patient` table.
pub async fn get_patient_demographics(
  pool: &MySqlPool,
  hn: &str,
) -> Result<Option<PatientDemographics>> {
  let row = sqlx::query_as::<_, DemographicsRow>(
    "SELECT \
            p.hn, \
            CONCAT(COALESCE(p.pname, ''), p.fname, ' ', p.lname) AS full_name, \
            TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age, \
            p.sex, \
            p.informaddr AS address, \
            p.hometel AS phone, \
            DATE_FORMAT(p.birthday, '%Y-%m-%d') AS birthday \
        FROM patient p \
        WHERE p.hn = ?",
  )
  .bind(hn)
  .fetch_optional(pool)
  .await?;

  Ok(row.map(|r| PatientDemographics {
    hn: r.hn,
    full_name: r.full_name,
    age: r.age,
    sex: r.sex,
    address: r.address,
    phone: r.phone,
    birthday: r.birthday,
  }))
}

pub async fn get_patient_demographics_by_hns(
  pool: &MySqlPool,
  hns: &[String],
) -> Result<HashMap<String, PatientDemographics>> {
  if hns.is_empty() {
    return Ok(HashMap::new());
  }

  let mut query = QueryBuilder::<sqlx::MySql>::new(
    "SELECT \
            p.hn, \
            CONCAT(COALESCE(p.pname, ''), p.fname, ' ', p.lname) AS full_name, \
            TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age, \
            p.sex, \
            p.informaddr AS address, \
            p.hometel AS phone, \
            DATE_FORMAT(p.birthday, '%Y-%m-%d') AS birthday \
        FROM patient p \
        WHERE p.hn IN (",
  );

  let mut separated = query.separated(", ");
  for hn in hns {
    separated.push_bind(hn);
  }
  separated.push_unseparated(")");

  let rows: Vec<DemographicsRow> = query.build_query_as().fetch_all(pool).await?;

  Ok(
    rows
      .into_iter()
      .map(|row| {
        let key = row.hn.clone();
        let value = PatientDemographics {
          hn: row.hn,
          full_name: row.full_name,
          age: row.age,
          sex: row.sex,
          address: row.address,
          phone: row.phone,
          birthday: row.birthday,
        };
        (key, value)
      })
      .collect(),
  )
}

/// Fetch every TB drug dispensing record for one HN from `opitemrece`, newest
/// first.  Drug class (H / R / E / Z) is resolved inline via a SQL CASE
/// expression so that the result maps directly onto `DispensingRecord`.
///
/// Design notes:
/// - Uses `WHERE o.hn = ?` directly (no patient JOIN) — avoids any HN
///   format mismatch between tables and keeps the query simple.
/// - LEFT JOIN drugitems so that rows are returned even when an icode does
///   not have a matching entry in drugitems; drug_name falls back to the
///   raw icode via COALESCE in that case.
/// - `CAST(o.qty AS DOUBLE)` avoids sqlx DECIMAL→f64 mapping issues that
///   silently kill the entire result set with unwrap_or_default().
pub async fn get_dispensing_history(
  pool: &MySqlPool,
  hn: &str,
  all_icodes: &[String],
  icode_to_class_map: &HashMap<String, String>,
) -> Result<Vec<DispensingRecord>> {
  let placeholders = in_placeholders(all_icodes.len());
  let sql = format!(
    "SELECT \
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate, \
            o.icode, \
            TRIM(CONCAT_WS(' ', COALESCE(d.name, o.icode), d.strength)) AS drug_name, \
            CAST(o.qty AS DOUBLE) AS qty, \
            d.units, \
            NULL AS drug_class \
        FROM opitemrece o \
        LEFT JOIN drugitems d ON o.icode = d.icode \
        WHERE o.hn = ? \
          AND o.icode IN ({placeholders}) \
        ORDER BY o.vstdate DESC, o.icode"
  );

  let mut q = sqlx::query_as::<_, DispensingRecord>(&sql);
  q = q.bind(hn);
  for icode in all_icodes {
    q = q.bind(icode.as_str());
  }

  let mut rows: Vec<DispensingRecord> = q.fetch_all(pool).await.map_err(anyhow::Error::from)?;
  for row in &mut rows {
    row.drug_class = icode_to_class_map.get(&row.icode).cloned();
  }
  Ok(rows)
}

/// Return the most recent date on which any TB drug was dispensed to `hn` as
/// `YYYY-MM-DD`, or `None` when no dispensing records exist.
pub async fn get_last_dispensing_date(
  pool: &MySqlPool,
  hn: &str,
  all_icodes: &[String],
) -> Result<Option<String>> {
  let placeholders = in_placeholders(all_icodes.len());
  let sql = format!(
    "SELECT DATE_FORMAT(MAX(vstdate), '%Y-%m-%d') \
         FROM opitemrece \
         WHERE hn = ? \
           AND icode IN ({placeholders})"
  );

  let mut q = sqlx::query_scalar::<_, Option<String>>(&sql);
  q = q.bind(hn);
  for icode in all_icodes {
    q = q.bind(icode.as_str());
  }

  q.fetch_one(pool).await.map_err(anyhow::Error::from)
}

/// Return `true` if Ethambutol (icode 1600004 **or** 1000129) was dispensed
/// to `hn` within the last `days` calendar days.
///
/// Used by the alert engine to detect Ethambutol-overrun during the
/// continuation phase.
pub async fn was_ethambutol_dispensed_recently(
  pool: &MySqlPool,
  hn: &str,
  days: i64,
  e_icodes: &[String],
) -> Result<bool> {
  let placeholders = in_placeholders(e_icodes.len());
  let sql = format!(
    "SELECT COUNT(*) \
         FROM opitemrece \
         WHERE hn = ? \
           AND icode IN ({placeholders}) \
           AND vstdate >= CURDATE() - INTERVAL ? DAY"
  );

  let mut q = sqlx::query_scalar::<_, i64>(&sql);
  q = q.bind(hn);
  for icode in e_icodes {
    q = q.bind(icode.as_str());
  }
  q = q.bind(days);

  let count = q.fetch_one(pool).await?;
  Ok(count > 0)
}

/// Return `true` if Pyrazinamide (Z) OR Ethambutol (E) was dispensed to `hn`
/// within the last `days` calendar days.
pub async fn was_ze_dispensed_recently(
  pool: &MySqlPool,
  hn: &str,
  days: i64,
  ze_icodes: &[String],
) -> Result<bool> {
  let placeholders = in_placeholders(ze_icodes.len());
  let sql = format!(
    "SELECT COUNT(*) \
         FROM opitemrece \
         WHERE hn = ? \
           AND icode IN ({placeholders}) \
           AND vstdate >= CURDATE() - INTERVAL ? DAY"
  );

  let mut q = sqlx::query_scalar::<_, i64>(&sql);
  q = q.bind(hn);
  for icode in ze_icodes {
    q = q.bind(icode.as_str());
  }
  q = q.bind(days);

  let count = q.fetch_one(pool).await?;
  Ok(count > 0)
}

/// Fetch upcoming TB clinic appointments from HOSxP `oapp` (clinic code `009`).
///
/// Returns every appointment whose `nextdate` falls between today and
/// `today + days_ahead` days (inclusive), ordered by date ascending.
///
/// Join with `patient` to provide the human-readable name.
pub async fn get_tb_appointments(
  pool: &MySqlPool,
  days_ahead: i64,
  clinic_code: &str,
) -> Result<Vec<AppointmentRecord>> {
  let sql = format!(
    "SELECT \
            a.hn, \
            CONCAT(COALESCE(p.pname, ''), p.fname, ' ', p.lname) AS full_name, \
            DATE_FORMAT(a.nextdate, '%Y-%m-%d') AS nextdate \
        FROM {TABLE_OAPP} a \
        JOIN {TABLE_PATIENT} p ON a.hn = p.hn \
        WHERE a.clinic = ? \
          AND a.nextdate BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY) \
        ORDER BY a.nextdate ASC",
  );

  sqlx::query_as::<_, AppointmentRecord>(&sql)
    .bind(clinic_code)
    .bind(days_ahead)
    .fetch_all(pool)
    .await
    .map_err(anyhow::Error::from)
}

/// Search for TB clinics in HOSxP `clinic` table by name or code.
/// Used in settings to let users find their TB clinic code.
#[derive(sqlx::FromRow)]
pub struct ClinicRow {
  pub clinic: String,
  pub name: Option<String>,
}

pub async fn search_clinics(pool: &MySqlPool, query: &str, limit: u32) -> Result<Vec<ClinicRow>> {
  let sql = format!(
    "SELECT clinic, name \
         FROM {TABLE_CLINIC} \
         WHERE clinic LIKE ? OR name LIKE ? \
         ORDER BY clinic \
         LIMIT ?",
  );
  let pattern = format!("%{}%", query);
  sqlx::query_as::<_, ClinicRow>(&sql)
    .bind(&pattern)
    .bind(&pattern)
    .bind(limit as i64)
    .fetch_all(pool)
    .await
    .map_err(anyhow::Error::from)
}

/// Search for drugs in HOSxP `drugitems` by name, icode, or shortname.
/// Used during setup wizard to let users find icodes for drug class configuration.
/// Returns up to `limit` results, ordered by name.
#[derive(sqlx::FromRow)]
struct DrugItemRow {
  icode: String,
  name: String,
  units: Option<String>,
}

pub async fn search_drugs(pool: &MySqlPool, query: &str, limit: u32) -> Result<Vec<DrugItem>> {
  let sql = format!(
    "SELECT icode, name, units \
         FROM {TABLE_DRUGITEMS} \
         WHERE name LIKE ? OR icode LIKE ? \
         ORDER BY name \
         LIMIT ?",
  );
  let pattern = format!("%{}%", query);
  let rows: Vec<DrugItemRow> = sqlx::query_as(&sql)
    .bind(&pattern)
    .bind(&pattern)
    .bind(limit as i64)
    .fetch_all(pool)
    .await?;
  Ok(
    rows
      .into_iter()
      .map(|r| DrugItem {
        icode: r.icode,
        name: r.name,
        shortname: None,
        units: r.units,
      })
      .collect(),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — pure helper functions (no DB required)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
  use super::*;

  fn default_class_map() -> HashMap<String, Vec<String>> {
    let mut m = HashMap::new();
    m.insert("H".into(), vec!["1430104".into()]);
    m.insert("R".into(), vec!["1000265".into(), "1000264".into()]);
    m.insert("E".into(), vec!["1600004".into(), "1000129".into()]);
    m.insert("Z".into(), vec!["1000258".into()]);
    m
  }

  fn default_icode_map() -> HashMap<String, String> {
    let mut m = HashMap::new();
    m.insert("1430104".into(), "H".into());
    m.insert("1000265".into(), "R".into());
    m.insert("1000264".into(), "R".into());
    m.insert("1600004".into(), "E".into());
    m.insert("1000129".into(), "E".into());
    m.insert("1000258".into(), "Z".into());
    m
  }

  // ---------------------------------------------------------------------------
  // icodes_for_classes
  // ---------------------------------------------------------------------------

  #[test]
  fn test_icodes_for_classes_empty_returns_empty() {
    let map = default_class_map();
    let result = icodes_for_classes(&[], &map);
    assert!(result.is_empty());
  }

  #[test]
  fn test_icodes_for_classes_h() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("H")], &map);
    assert_eq!(result, vec!["1430104"]);
  }

  #[test]
  fn test_icodes_for_classes_r_both_codes() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("R")], &map);
    assert_eq!(result, vec!["1000265", "1000264"]);
  }

  #[test]
  fn test_icodes_for_classes_e_both_codes() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("E")], &map);
    assert_eq!(result, vec!["1600004", "1000129"]);
  }

  #[test]
  fn test_icodes_for_classes_z() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("Z")], &map);
    assert_eq!(result, vec!["1000258"]);
  }

  #[test]
  fn test_icodes_for_classes_case_insensitive() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("h"), String::from("r")], &map);
    assert!(result.contains(&"1430104".to_string()));
    assert!(result.contains(&"1000265".to_string()));
  }

  #[test]
  fn test_icodes_for_classes_unknown_class_ignored() {
    let map = default_class_map();
    let result = icodes_for_classes(&[String::from("X"), String::from("H")], &map);
    assert_eq!(result, vec!["1430104"]);
  }

  // ---------------------------------------------------------------------------
  // drug_classes_from_icode_csv
  // ---------------------------------------------------------------------------

  #[test]
  fn test_drug_classes_single_class() {
    let map = default_icode_map();
    assert_eq!(
      drug_classes_from_icode_csv("1430104", &map),
      vec![String::from("H")]
    );
  }

  #[test]
  fn test_drug_classes_all_classes_deduplicated() {
    let map = default_icode_map();
    let result = drug_classes_from_icode_csv("1430104,1000265,1600004,1000258", &map);
    assert_eq!(result, vec!["E", "H", "R", "Z"]);
  }

  #[test]
  fn test_drug_classes_duplicate_r_deduplicated() {
    let map = default_icode_map();
    let result = drug_classes_from_icode_csv("1000265,1000264,1430104,1000265", &map);
    assert_eq!(result, vec!["H", "R"]);
  }

  #[test]
  fn test_drug_classes_unknown_ignored() {
    let map = default_icode_map();
    let result = drug_classes_from_icode_csv("9999999,1430104,8888888", &map);
    assert_eq!(result, vec![String::from("H")]);
  }

  #[test]
  fn test_drug_classes_empty_csv() {
    let map = default_icode_map();
    assert!(drug_classes_from_icode_csv("", &map).is_empty());
  }

  #[test]
  fn test_drug_classes_whitespace_trimmed() {
    let map = default_icode_map();
    let result = drug_classes_from_icode_csv(" 1430104 , 1000265 ", &map);
    assert_eq!(result, vec!["H", "R"]);
  }

  // ---------------------------------------------------------------------------
  // in_placeholders
  // ---------------------------------------------------------------------------

  #[test]
  fn test_in_placeholders_zero() {
    assert_eq!(in_placeholders(0), "");
  }

  #[test]
  fn test_in_placeholders_one() {
    assert_eq!(in_placeholders(1), "?");
  }

  #[test]
  fn test_in_placeholders_five() {
    assert_eq!(in_placeholders(5), "?, ?, ?, ?, ?");
  }
}
