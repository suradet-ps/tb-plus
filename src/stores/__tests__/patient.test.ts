import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActivePatientRow,
  createPatientDetail,
  createTbPatient,
} from '@/__tests__/factories/patient';
import { usePatientStore } from '@/stores/patient';
import type { ActivePatientRow, EnrollmentInput, PatientDetail } from '@/types/patient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('patient store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('fetchActivePatients', () => {
    it('should populate activePatients on success', async () => {
      const store = usePatientStore();
      const mockRows: ActivePatientRow[] = [
        createActivePatientRow({ tb_patient: createTbPatient({ hn: 'HN00001' }) }),
        createActivePatientRow({ tb_patient: createTbPatient({ hn: 'HN00002' }) }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockRows);

      await store.fetchActivePatients();

      expect(store.activePatients).toEqual(mockRows);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error on failure', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockRejectedValue(new Error('DB unavailable'));

      await store.fetchActivePatients();

      expect(store.error).toContain('DB unavailable');
      expect(store.isLoading).toBe(false);
    });

    it('should keep existing data on failure', async () => {
      const store = usePatientStore();
      const existing = [createActivePatientRow()];
      store.activePatients = existing;
      vi.mocked(invoke).mockRejectedValue(new Error('fail'));

      await store.fetchActivePatients();

      expect(store.activePatients).toEqual(existing);
    });

    it('should replace data with empty array on success with no results', async () => {
      const store = usePatientStore();
      store.activePatients = [createActivePatientRow()];
      vi.mocked(invoke).mockResolvedValue([]);

      await store.fetchActivePatients();

      expect(store.activePatients).toEqual([]);
    });
  });

  describe('fetchPatientDetail', () => {
    it('should populate currentPatient on success', async () => {
      const store = usePatientStore();
      const detail: PatientDetail = createPatientDetail({
        patient: createTbPatient({ hn: 'HN00005' }),
      });
      vi.mocked(invoke).mockResolvedValue(detail);

      await store.fetchPatientDetail('HN00005');

      expect(store.currentPatient).toEqual(detail);
      expect(store.isLoadingDetail).toBe(false);
    });

    it('should set error on failure', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Not found'));

      await store.fetchPatientDetail('HN00005');

      expect(store.error).toContain('Not found');
      expect(store.isLoadingDetail).toBe(false);
      expect(store.currentPatient).toBeNull();
    });

    it('should pass the HN to the backend command', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockResolvedValue(createPatientDetail());

      await store.fetchPatientDetail('HN99999');

      expect(invoke).toHaveBeenCalledWith('get_patient_detail', { hn: 'HN99999' });
    });

    it('should clear previous error on subsequent success', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockRejectedValueOnce(new Error('timeout'));
      await store.fetchPatientDetail('HN00001');
      expect(store.error).toContain('timeout');

      vi.mocked(invoke).mockResolvedValueOnce(createPatientDetail());
      await store.fetchPatientDetail('HN00001');
      expect(store.error).toBeNull();
    });
  });

  describe('fetchDischargedPatients', () => {
    it('should populate dischargedPatients on success', async () => {
      const store = usePatientStore();
      const mockRows: ActivePatientRow[] = [
        createActivePatientRow({
          tb_patient: createTbPatient({ hn: 'HN00010', status: 'completed' }),
          outcome_value: 'cured',
        }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockRows);

      await store.fetchDischargedPatients();

      expect(store.dischargedPatients).toEqual(mockRows);
      expect(store.isLoadingDischarged).toBe(false);
    });

    it('should set error on failure', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Server error'));

      await store.fetchDischargedPatients();

      expect(store.error).toContain('Server error');
      expect(store.isLoadingDischarged).toBe(false);
    });
  });

  describe('enrollPatient', () => {
    const enrollment: EnrollmentInput = {
      hn: 'HN00003',
      tb_type: 'pulmonary',
      diagnosis_date: '2025-06-01',
      regimen: '2HRZE/4HR',
      treatment_start_date: '2025-06-01',
      enrolled_by: 'คุณหมอใจดี',
      notes: null,
    };

    it('should call enroll_patient and re-fetch active list on success', async () => {
      const store = usePatientStore();
      const enrollResponseId = 42;
      const updatedList: ActivePatientRow[] = [createActivePatientRow()];
      vi.mocked(invoke)
        .mockResolvedValueOnce(enrollResponseId) // enroll_patient
        .mockResolvedValueOnce(updatedList); // get_active_patients

      const id = await store.enrollPatient(enrollment);

      expect(id).toBe(42);
      expect(invoke).toHaveBeenCalledWith('enroll_patient', { enrollment });
      expect(invoke).toHaveBeenCalledWith('get_active_patients');
      expect(store.activePatients).toEqual(updatedList);
    });

    it('should throw if the backend call fails', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Duplicate HN'));

      await expect(store.enrollPatient(enrollment)).rejects.toThrow('Duplicate HN');
    });

    it('should pass all enrollment fields to the backend', async () => {
      const store = usePatientStore();
      vi.mocked(invoke).mockResolvedValueOnce(1).mockResolvedValueOnce([]);

      await store.enrollPatient(enrollment);

      expect(invoke).toHaveBeenCalledWith('enroll_patient', {
        enrollment: expect.objectContaining({
          hn: 'HN00003',
          tb_type: 'pulmonary',
          regimen: '2HRZE/4HR',
        }),
      });
    });
  });

  describe('loading state isolation', () => {
    it('should use separate loading flags for active patients vs detail', async () => {
      const store = usePatientStore();
      let resolveActive: ((v: ActivePatientRow[]) => void) | undefined;
      const activePending = new Promise<ActivePatientRow[]>((resolve) => {
        resolveActive = resolve;
      });
      vi.mocked(invoke).mockReturnValueOnce(activePending);

      const activePromise = store.fetchActivePatients();
      expect(store.isLoading).toBe(true);
      expect(store.isLoadingDetail).toBe(false);

      resolveActive?.([]);
      await activePromise;
      expect(store.isLoading).toBe(false);
    });
  });
});
