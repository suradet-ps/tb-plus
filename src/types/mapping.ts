export interface MappingPatientRow {
  hn: string;
  masked_hn: string;
  masked_name: string;
  tb_status: string;
  tb_type: 'pulmonary' | 'extra_pulmonary' | null;
  enrolled_at: string;
  diagnosis_date: string | null;
  has_address: boolean;
  address_preview: string | null;
  geocode_status: 'pending' | 'success' | 'failed' | 'missing_address' | string;
  geocode_error: string | null;
  lat: number | null;
  lng: number | null;
  geocoded_at: string | null;
}

export interface MappingSummary {
  total_patients: number;
  active_patients: number;
  mapped_patients: number;
  unmapped_patients: number;
  missing_address_patients: number;
}

export interface BatchGeocodeResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}
