use std::cmp::Ordering;
use std::collections::HashMap;
use tb_models::dosage::{
  DosageAssessmentItem, DosageAssessmentPhase, DosageAssessmentResult, DosageDrugCandidate,
};
use tb_models::settings::{DosageRule, RegimenEntry, RegimenPhase};

pub fn normalized_regimen_phases(regimen: &RegimenEntry) -> Vec<RegimenPhase> {
  if !regimen.phases.is_empty() {
    return regimen.phases.clone();
  }

  let (intensive_months, continuation_months) = parse_regimen_durations(&regimen.name);
  vec![
    RegimenPhase {
      phase: "intensive".into(),
      months: intensive_months,
      drug_classes: vec!["H".into(), "R".into(), "Z".into(), "E".into()],
    },
    RegimenPhase {
      phase: "continuation".into(),
      months: continuation_months,
      drug_classes: vec!["H".into(), "R".into()],
    },
  ]
}

pub fn parse_regimen_durations(regimen_name: &str) -> (u32, u32) {
  let mut parts = regimen_name.splitn(2, '/');
  let intensive = parts
    .next()
    .and_then(|part| part.chars().next())
    .and_then(|c| c.to_digit(10))
    .unwrap_or(2);
  let continuation = parts
    .next()
    .and_then(|part| part.chars().next())
    .and_then(|c| c.to_digit(10))
    .unwrap_or(4);
  (intensive, continuation)
}

pub fn build_assessment_result(
  patient: tb_models::dosage::DosagePatientSummary,
  regimen: RegimenEntry,
  rules: Vec<DosageRule>,
  configured_drugs: HashMap<String, DosageDrugCandidate>,
) -> DosageAssessmentResult {
  let mut warnings = Vec::new();

  if patient.latest_weight_kg.is_none() {
    warnings.push("ไม่พบน้ำหนักล่าสุดจากตาราง opdscreen จึงยังคำนวณขนาดยาไม่ได้".to_string());
  }

  let weight = patient.latest_weight_kg;
  let regimen_phases = normalized_regimen_phases(&regimen);
  if regimen.phases.is_empty() {
    warnings.push(format!(
      "สูตรยา {} ยังไม่มี phase ที่ตั้งค่าไว้ ระบบจึงใช้การตีความมาตรฐานอัตโนมัติ",
      regimen.name
    ));
  }
  let mut rules_by_class: HashMap<String, Vec<DosageRule>> = HashMap::new();
  for rule in rules {
    rules_by_class
      .entry(rule.class.to_uppercase())
      .or_default()
      .push(rule);
  }

  let mut phases = Vec::new();
  for phase in regimen_phases {
    let mut items = Vec::new();
    for drug_class in phase.drug_classes {
      let class_key = drug_class.to_uppercase();
      let Some(class_rules) = rules_by_class.get(&class_key) else {
        warnings.push(format!("ยังไม่ได้ตั้งค่าขนาดยาสำหรับกลุ่มยา {}", class_key));
        continue;
      };

      for rule in class_rules {
        let candidate = configured_drugs.get(&rule.icode);
        items.push(build_assessment_item(rule, candidate, weight));
      }
    }
    phases.push(DosageAssessmentPhase {
      phase: phase.phase,
      months: phase.months,
      items,
    });
  }

  DosageAssessmentResult {
    patient,
    regimen_name: regimen.name,
    phases,
    warnings,
  }
}

pub fn build_assessment_item(
  rule: &DosageRule,
  candidate: Option<&DosageDrugCandidate>,
  weight: Option<f64>,
) -> DosageAssessmentItem {
  let drug_name = candidate
    .map(|item| item.drug_name.clone())
    .unwrap_or_else(|| rule.drug_name.clone());
  let strength = candidate
    .and_then(|item| item.strength.clone())
    .or_else(|| rule.strength.clone());
  let units = candidate
    .and_then(|item| item.units.clone())
    .or_else(|| rule.units.clone());

  let (
    target_min_mg_day,
    target_max_mg_day,
    suggested_units_per_day,
    suggested_daily_dose_mg,
    dose_delta_mg,
    within_target_range,
    note,
  ) = match weight {
    Some(weight_kg) => {
      let target_min = weight_kg * rule.min_mg_per_kg_day;
      let target_max = weight_kg * rule.max_mg_per_kg_day;
      match choose_dose(target_min, target_max, strength.as_deref()) {
        Some(result) => (
          Some(target_min),
          Some(target_max),
          Some(result.units_per_day),
          Some(result.daily_dose_mg),
          Some(result.delta_mg),
          result.within_target_range,
          Some(result.note),
        ),
        None => (
          Some(target_min),
          Some(target_max),
          None,
          None,
          None,
          false,
          Some("ไม่สามารถอ่านค่า strength เพื่อคำนวณจำนวนเม็ดยาได้".to_string()),
        ),
      }
    }
    None => (
      None,
      None,
      None,
      None,
      None,
      false,
      Some("รอน้ำหนักล่าสุดจาก HOSxP".to_string()),
    ),
  };

  DosageAssessmentItem {
    class: rule.class.to_uppercase(),
    icode: rule.icode.clone(),
    drug_name,
    strength,
    units,
    min_mg_per_kg_day: rule.min_mg_per_kg_day,
    max_mg_per_kg_day: rule.max_mg_per_kg_day,
    target_min_mg_day,
    target_max_mg_day,
    suggested_units_per_day,
    suggested_daily_dose_mg,
    dose_delta_mg,
    within_target_range,
    note,
  }
}

pub struct DoseChoice {
  units_per_day: u32,
  daily_dose_mg: f64,
  delta_mg: f64,
  within_target_range: bool,
  note: String,
}

pub fn choose_dose(
  target_min: f64,
  target_max: f64,
  strength_text: Option<&str>,
) -> Option<DoseChoice> {
  let strength_mg = parse_strength_mg(strength_text?)?;
  let midpoint = (target_min + target_max) / 2.0;
  let max_units = ((target_max / strength_mg).ceil() as u32)
    .saturating_add(2)
    .max(1);

  let best = (1..=max_units).min_by(|left, right| {
    compare_candidates(*left, *right, strength_mg, target_min, target_max, midpoint)
  })?;

  let daily_dose_mg = f64::from(best) * strength_mg;
  let within_target_range = daily_dose_mg >= target_min && daily_dose_mg <= target_max;
  let delta_mg = (daily_dose_mg - midpoint).abs();
  let note = if within_target_range {
    format!("แนะนำ {} หน่วย/วัน อยู่ในช่วงเป้าหมาย", best)
  } else {
    format!("แนะนำ {} หน่วย/วัน เป็นค่าที่ใกล้ช่วงเป้าหมายที่สุด", best)
  };

  Some(DoseChoice {
    units_per_day: best,
    daily_dose_mg,
    delta_mg,
    within_target_range,
    note,
  })
}

pub fn compare_candidates(
  left_units: u32,
  right_units: u32,
  strength_mg: f64,
  target_min: f64,
  target_max: f64,
  midpoint: f64,
) -> Ordering {
  let left_dose = f64::from(left_units) * strength_mg;
  let right_dose = f64::from(right_units) * strength_mg;
  let left_in_range = left_dose >= target_min && left_dose <= target_max;
  let right_in_range = right_dose >= target_min && right_dose <= target_max;

  match (left_in_range, right_in_range) {
    (true, false) => Ordering::Less,
    (false, true) => Ordering::Greater,
    _ => {
      let left_delta = (left_dose - midpoint).abs();
      let right_delta = (right_dose - midpoint).abs();
      left_delta
        .partial_cmp(&right_delta)
        .unwrap_or(Ordering::Equal)
        .then(left_units.cmp(&right_units))
    }
  }
}

pub fn parse_strength_mg(strength_text: &str) -> Option<f64> {
  let lower = strength_text.to_lowercase();
  let mut token = String::new();
  let mut values = Vec::new();

  for ch in lower.chars() {
    if ch.is_ascii_digit() || ch == '.' {
      token.push(ch);
    } else if !token.is_empty() {
      if let Ok(value) = token.parse::<f64>() {
        values.push(value);
      }
      token.clear();
    }
  }

  if !token.is_empty()
    && let Ok(value) = token.parse::<f64>()
  {
    values.push(value);
  }

  values.into_iter().find(|value| *value > 0.0)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parse_strength_reads_first_numeric_token() {
    assert_eq!(parse_strength_mg("300 mg/tab"), Some(300.0));
    assert_eq!(parse_strength_mg("50mg/5ml"), Some(50.0));
  }

  #[test]
  fn choose_dose_prefers_range_match() {
    let dose = choose_dose(150.0, 300.0, Some("100 mg")).unwrap();
    assert!(dose.within_target_range);
    assert_eq!(dose.units_per_day, 2);
  }

  #[test]
  fn normalized_regimen_phases_falls_back_from_regimen_name() {
    let regimen = RegimenEntry {
      name: "2HRZE/4HR".into(),
      phases: vec![],
    };

    let phases = normalized_regimen_phases(&regimen);

    assert_eq!(phases.len(), 2);
    assert_eq!(phases[0].phase, "intensive");
    assert_eq!(phases[0].months, 2);
    assert_eq!(phases[0].drug_classes, vec!["H", "R", "Z", "E"]);
    assert_eq!(phases[1].phase, "continuation");
    assert_eq!(phases[1].months, 4);
    assert_eq!(phases[1].drug_classes, vec!["H", "R"]);
  }
}
