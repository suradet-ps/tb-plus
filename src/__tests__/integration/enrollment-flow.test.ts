import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActivePatientRow,
  createPatientDrugRecord,
  createTbPatient,
} from '@/__tests__/factories/patient';
import { usePatientStore } from '@/stores/patient';
import { useScreeningStore } from '@/stores/screening';
import type { ActivePatientRow, EnrollmentInput, PatientDrugRecord } from '@/types/patient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('enrollment flow — screening to patient store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should search screening results, select a patient, and enroll', async () => {
    const screeningStore = useScreeningStore();
    const patientStore = usePatientStore();

    const searchResults: PatientDrugRecord[] = [
      createPatientDrugRecord({
        hn: 'HN00010',
        full_name: 'นาย สมชาย',
        is_enrolled: false,
      }),
      createPatientDrugRecord({
        hn: 'HN00011',
        full_name: 'นาง สมหญิง',
        is_enrolled: false,
      }),
    ];
    vi.mocked(invoke).mockResolvedValueOnce(searchResults);

    await screeningStore.search();

    expect(screeningStore.results).toHaveLength(2);
    expect(screeningStore.selectedHns.size).toBe(0);

    screeningStore.toggleSelect('HN00010');
    expect(screeningStore.selectedHns.has('HN00010')).toBe(true);
    expect(screeningStore.selectedRecords).toHaveLength(1);
    expect(screeningStore.selectedRecords[0].hn).toBe('HN00010');

    const enrollment: EnrollmentInput = {
      hn: 'HN00010',
      tb_type: 'pulmonary',
      diagnosis_date: '2025-06-01',
      regimen: '2HRZE/4HR',
      treatment_start_date: '2025-06-15',
      enrolled_by: 'คุณหมอ',
      notes: null,
    };

    const updatedList: ActivePatientRow[] = [
      createActivePatientRow({
        tb_patient: createTbPatient({ hn: 'HN00010' }),
      }),
    ];
    vi.mocked(invoke).mockResolvedValueOnce(42).mockResolvedValueOnce(updatedList);

    const id = await patientStore.enrollPatient(enrollment);

    expect(id).toBe(42);
    expect(invoke).toHaveBeenCalledWith('enroll_patient', { enrollment });
    expect(invoke).toHaveBeenCalledWith('get_active_patients');
    expect(patientStore.activePatients).toEqual(updatedList);
  });

  it('should skip already-active enrolled patients in selectedRecords', async () => {
    const screeningStore = useScreeningStore();
    const results: PatientDrugRecord[] = [
      createPatientDrugRecord({ hn: 'HN00001', is_enrolled: true, patient_status: 'active' }),
      createPatientDrugRecord({ hn: 'HN00002', is_enrolled: true, patient_status: 'completed' }),
      createPatientDrugRecord({ hn: 'HN00003', is_enrolled: false }),
    ];
    vi.mocked(invoke).mockResolvedValue(results);

    await screeningStore.search();

    screeningStore.toggleSelect('HN00001');
    screeningStore.toggleSelect('HN00002');
    screeningStore.toggleSelect('HN00003');

    const selected = screeningStore.selectedRecords;
    expect(selected).toHaveLength(2);
    expect(selected.map((r) => r.hn)).toEqual(['HN00002', 'HN00003']);
  });

  it('should re-enroll a previously discharged patient', async () => {
    const screeningStore = useScreeningStore();
    const patientStore = usePatientStore();
    const results: PatientDrugRecord[] = [
      createPatientDrugRecord({ hn: 'HN00020', is_enrolled: true, patient_status: 'defaulted' }),
    ];
    vi.mocked(invoke).mockResolvedValue(results);

    await screeningStore.search();
    screeningStore.toggleSelect('HN00020');

    expect(screeningStore.selectedRecords).toHaveLength(1);
    expect(screeningStore.selectedRecords[0].hn).toBe('HN00020');

    vi.mocked(invoke).mockResolvedValueOnce(99).mockResolvedValueOnce([]);

    const id = await patientStore.enrollPatient({
      hn: 'HN00020',
      tb_type: 'pulmonary',
      diagnosis_date: null,
      regimen: '2HRZE/4HR',
      treatment_start_date: '2025-07-01',
      enrolled_by: 'หมอ',
      notes: null,
    });

    expect(id).toBe(99);
    expect(invoke).toHaveBeenCalledWith('enroll_patient', {
      enrollment: expect.objectContaining({ hn: 'HN00020' }),
    });
  });

  it('should clear selection after enrollment', async () => {
    const screeningStore = useScreeningStore();
    const patientStore = usePatientStore();
    vi.mocked(invoke).mockResolvedValue([createPatientDrugRecord({ hn: 'HN00030' })]);

    await screeningStore.search();
    screeningStore.toggleSelect('HN00030');
    expect(screeningStore.selectedHns.size).toBe(1);

    vi.mocked(invoke).mockResolvedValueOnce(1).mockResolvedValueOnce([]);

    await patientStore.enrollPatient({
      hn: 'HN00030',
      tb_type: 'pulmonary',
      diagnosis_date: null,
      regimen: '2HRZE/4HR',
      treatment_start_date: '2025-07-01',
      enrolled_by: null,
      notes: null,
    });

    screeningStore.clearSelection();
    expect(screeningStore.selectedHns.size).toBe(0);
    expect(screeningStore.selectedRecords).toHaveLength(0);
  });

  it('should propagate enrollment errors without crashing the stores', async () => {
    const patientStore = usePatientStore();
    vi.mocked(invoke).mockRejectedValue(new Error('Duplicate enrollment'));

    await expect(
      patientStore.enrollPatient({
        hn: 'HN99999',
        tb_type: 'pulmonary',
        diagnosis_date: null,
        regimen: '2HRZE/4HR',
        treatment_start_date: '2025-07-01',
        enrolled_by: null,
        notes: null,
      }),
    ).rejects.toThrow('Duplicate enrollment');

    expect(patientStore.activePatients).toEqual([]);
    expect(patientStore.isLoading).toBe(false);
  });
});
