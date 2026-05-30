import type {
  ActivePatientRow,
  PatientDemographics,
  PatientDetail,
  PatientDrugRecord,
  SearchFilters,
  TbPatient,
} from '@/types/patient';
import type { Followup, Outcome, TreatmentPlan } from '@/types/treatment';

export function createPatientDrugRecord(
  overrides: Partial<PatientDrugRecord> = {},
): PatientDrugRecord {
  return {
    hn: 'HN00001',
    full_name: 'นาย ทดสอบ ใจดี',
    age: 45,
    sex: 'M',
    first_dispensed: '2025-01-15',
    last_dispensed: '2025-05-20',
    visit_count: 6,
    drug_names: 'Isoniazid, Rifampicin, Ethambutol, Pyrazinamide',
    drug_classes: ['H', 'R', 'E', 'Z'],
    is_enrolled: false,
    ...overrides,
  };
}

export function createSearchFilters(overrides: Partial<SearchFilters> = {}): SearchFilters {
  return {
    date_from: '2024-06-01',
    date_to: '2025-06-01',
    enrollment_status: 'all',
    page: 1,
    page_size: 50,
    ...overrides,
  };
}

export function createTbPatient(overrides: Partial<TbPatient> = {}): TbPatient {
  return {
    id: 1,
    hn: 'HN00001',
    enrolled_at: '2025-01-15',
    enrolled_by: 'คุณหมอใจดี',
    status: 'active',
    tb_type: 'pulmonary',
    diagnosis_date: '2025-01-10',
    notes: null,
    created_at: '2025-01-15T10:00:00',
    updated_at: '2025-05-20T14:00:00',
    ...overrides,
  };
}

export function createPatientDemographics(
  overrides: Partial<PatientDemographics> = {},
): PatientDemographics {
  return {
    hn: 'HN00001',
    full_name: 'นาย ทดสอบ ใจดี',
    age: 45,
    sex: 'M',
    address: '123 หมู่ 4 ต.สระโบสถ์ อ.สระโบสถ์ จ.ลพบุรี',
    phone: '0812345678',
    birthday: '1980-03-15',
    ...overrides,
  };
}

export function createTreatmentPlan(overrides: Partial<TreatmentPlan> = {}): TreatmentPlan {
  return {
    id: 1,
    hn: 'HN00001',
    regimen: '2HRZE/4HR',
    phase: 'intensive',
    phase_start: '2025-01-15',
    phase_end_expected: '2025-03-15',
    drugs: '["1430104","1000265","1600004","1000258"]',
    duration_months: 2,
    is_current: true,
    notes: null,
    created_at: '2025-01-15T10:00:00',
    ...overrides,
  };
}

export function createFollowup(overrides: Partial<Followup> = {}): Followup {
  return {
    id: 1,
    hn: 'HN00001',
    followup_date: '2025-02-15',
    month_number: 1,
    weight_kg: 65.5,
    sputum_result: 'negative',
    xray_result: 'improved',
    side_effects: '["hepatotoxicity","nausea"]',
    adherence: 'good',
    dispensed_drugs: null,
    notes: null,
    created_by: 'คุณหมอใจดี',
    created_at: '2025-02-15T14:00:00',
    ...overrides,
  };
}

export function createOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: 1,
    hn: 'HN00001',
    outcome: 'cured',
    outcome_date: '2025-07-15',
    treatment_end: '2025-07-15',
    notes: null,
    created_by: 'คุณหมอใจดี',
    created_at: '2025-07-15T10:00:00',
    ...overrides,
  };
}

export function createActivePatientRow(
  overrides: Partial<ActivePatientRow> = {},
): ActivePatientRow {
  return {
    tb_patient: createTbPatient(),
    demographics: createPatientDemographics(),
    current_plan: createTreatmentPlan(),
    current_month: 3,
    total_months: 6,
    days_since_last_dispensing: 15,
    outcome_value: null,
    alerts: [],
    ...overrides,
  };
}

export function createPatientDetail(overrides: Partial<PatientDetail> = {}): PatientDetail {
  return {
    patient: createTbPatient(),
    demographics: createPatientDemographics(),
    current_plan: createTreatmentPlan(),
    followups: [createFollowup()],
    outcome: null,
    dispensing_history: [],
    alerts: [],
    mysql_connected: true,
    mysql_error: null,
    ...overrides,
  };
}
