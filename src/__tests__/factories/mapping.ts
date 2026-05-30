import type { BatchGeocodeResult, MappingPatientRow, MappingSummary } from '@/types/mapping';

export function createMappingPatientRow(
  overrides: Partial<MappingPatientRow> = {},
): MappingPatientRow {
  return {
    hn: 'HN00001',
    masked_hn: 'H*****1',
    masked_name: 'นาย ท***** **ดี',
    tb_status: 'active',
    tb_type: 'pulmonary',
    enrolled_at: '2025-01-15',
    diagnosis_date: '2025-01-10',
    has_address: true,
    address_preview: '123 หมู่ 4 ต.สระโบสถ์...',
    geocode_status: 'success',
    geocode_error: null,
    lat: 15.2345,
    lng: 100.3456,
    geocoded_at: '2025-01-15T10:00:00',
    ...overrides,
  };
}

export function createMappingSummary(overrides: Partial<MappingSummary> = {}): MappingSummary {
  return {
    total_patients: 10,
    active_patients: 7,
    mapped_patients: 8,
    unmapped_patients: 2,
    missing_address_patients: 1,
    ...overrides,
  };
}

export function createBatchGeocodeResult(
  overrides: Partial<BatchGeocodeResult> = {},
): BatchGeocodeResult {
  return {
    processed: 10,
    succeeded: 8,
    failed: 1,
    skipped: 1,
    ...overrides,
  };
}
