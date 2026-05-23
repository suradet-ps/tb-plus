export interface DosagePatientSummary {
  hn: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  birthday: string | null;
  latest_weight_kg: number | null;
  latest_weight_date: string | null;
}

export interface DosageAssessmentItem {
  class: string;
  icode: string;
  drug_name: string;
  strength: string | null;
  units: string | null;
  min_mg_per_kg_day: number;
  max_mg_per_kg_day: number;
  target_min_mg_day: number | null;
  target_max_mg_day: number | null;
  suggested_units_per_day: number | null;
  suggested_daily_dose_mg: number | null;
  dose_delta_mg: number | null;
  within_target_range: boolean;
  note: string | null;
}

export interface DosageAssessmentPhase {
  phase: string;
  months: number;
  items: DosageAssessmentItem[];
}

export interface DosageAssessmentResult {
  patient: DosagePatientSummary;
  regimen_name: string;
  phases: DosageAssessmentPhase[];
  warnings: string[];
}
