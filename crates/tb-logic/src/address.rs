use std::hash::{Hash, Hasher};

pub fn normalize_address(raw_address: &str) -> String {
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

pub fn normalize_address_opt(raw_address: Option<&str>) -> String {
  raw_address.map(normalize_address).unwrap_or_default()
}

pub fn build_geocode_queries(address: &str) -> Vec<String> {
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

pub fn push_unique_query(queries: &mut Vec<String>, candidate: String) {
  let trimmed = candidate.trim();
  if trimmed.is_empty() {
    return;
  }

  if !queries.iter().any(|existing| existing == trimmed) {
    queries.push(trimmed.to_string());
  }
}

pub fn expand_thai_address_tokens(address: &str) -> String {
  address
    .replace("ต.", "ตำบล")
    .replace("อ.", "อำเภอ")
    .replace("จ.", "จังหวัด")
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ")
}

pub fn extract_admin_segment(address: &str, prefixes: &[&str]) -> Option<String> {
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

pub fn strip_house_number_prefix(address: &str) -> Option<String> {
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

pub fn jitter_coordinates(lat: f64, lng: f64, key: &str, jitter_range: f64) -> (f64, f64) {
  let lat_offset = deterministic_offset(&(key.to_string() + "-lat"), jitter_range);
  let lng_offset = deterministic_offset(&(key.to_string() + "-lng"), jitter_range);
  (
    (lat + lat_offset).clamp(-90.0, 90.0),
    (lng + lng_offset).clamp(-180.0, 180.0),
  )
}

pub fn deterministic_offset(key: &str, jitter_range: f64) -> f64 {
  let mut hasher = std::collections::hash_map::DefaultHasher::new();
  key.hash(&mut hasher);
  let hash = hasher.finish();
  let normalized = (hash % 10_001) as f64 / 10_000.0;
  (normalized - 0.5) * jitter_range * 2.0
}

pub fn has_text(value: Option<&str>) -> bool {
  value.map(|text| !text.trim().is_empty()).unwrap_or(false)
}

pub fn mask_hn(hn: &str) -> String {
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

pub fn mask_name(full_name: &str) -> String {
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

pub fn address_preview(raw_address: &str) -> String {
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
