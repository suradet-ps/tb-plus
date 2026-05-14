export interface TreatmentPlan {
  id: number;
  hn: string;
  regimen: string;
  phase: 'intensive' | 'continuation';
  phase_start: string;
  phase_end_expected: string | null;
  drugs: string; // JSON array string
  duration_months: number;
  is_current: boolean;
  notes: string | null;
  created_at: string;
}

export interface TreatmentPlanUpdate {
  hn: string;
  new_phase: string;
  phase_start: string;
  regimen: string;
  drugs: string;
  duration_months: number;
  notes: string | null;
}

export interface Followup {
  id: number;
  hn: string;
  followup_date: string;
  month_number: number | null;
  weight_kg: number | null;
  sputum_result: 'negative' | 'positive' | 'not_done' | null;
  xray_result: 'improved' | 'stable' | 'worse' | 'not_done' | null;
  side_effects: string | null; // JSON
  adherence: 'good' | 'fair' | 'poor' | null;
  dispensed_drugs: string | null; // JSON
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FollowupInput {
  hn: string;
  followup_date: string;
  month_number: number | null;
  weight_kg: number | null;
  sputum_result: string | null;
  xray_result: string | null;
  side_effects: string[] | null;
  adherence: string | null;
  notes: string | null;
  created_by: string | null;
}

export interface Outcome {
  id: number;
  hn: string;
  outcome: string;
  outcome_date: string;
  treatment_end: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OutcomeInput {
  hn: string;
  outcome: string;
  outcome_date: string;
  treatment_end: string | null;
  notes: string | null;
  created_by: string | null;
}
