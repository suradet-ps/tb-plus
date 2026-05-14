export interface TbPatient {
  id: number;
  hn: string;
  enrolled_at: string;
  enrolled_by: string | null;
  status: 'active' | 'completed' | 'transferred' | 'died' | 'defaulted';
  tb_type: 'pulmonary' | 'extra_pulmonary' | null;
  diagnosis_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientDemographics {
  hn: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  address: string | null;
  phone: string | null;
  birthday: string | null;
}

export interface PatientDrugRecord {
  hn: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  first_dispensed: string | null;
  last_dispensed: string | null;
  visit_count: number;
  drug_names: string | null;
  drug_classes: string[];
  is_enrolled: boolean;
  patient_status?: string | null;
}

export interface EnrollmentInput {
  hn: string;
  tb_type: string;
  diagnosis_date: string | null;
  regimen: string;
  treatment_start_date: string;
  enrolled_by: string | null;
  notes: string | null;
}

export interface PatientDetail {
  patient: TbPatient;
  demographics: PatientDemographics | null;
  current_plan: import('./treatment').TreatmentPlan | null;
  followups: import('./treatment').Followup[];
  outcome: import('./treatment').Outcome | null;
  dispensing_history: import('./dispensing').DispensingRecord[];
  alerts: import('./alert').PatientAlert[];
  mysql_connected: boolean;
  mysql_error: string | null;
}

export interface ActivePatientRow {
  tb_patient: TbPatient;
  demographics: PatientDemographics | null;
  current_plan: import('./treatment').TreatmentPlan | null;
  current_month: number | null;
  total_months: number | null;
  days_since_last_dispensing: number | null;
  outcome_value: string | null;
  alerts: import('./alert').PatientAlert[];
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  drug_classes?: string[];
  enrollment_status?: 'all' | 'enrolled' | 'not_enrolled' | 'discharged';
  page?: number;
  page_size?: number;
  hn_search?: string;
  name_search?: string;
}
