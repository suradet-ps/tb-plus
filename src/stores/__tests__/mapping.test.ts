import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBatchGeocodeResult, createMappingPatientRow } from '@/__tests__/factories/mapping';
import { useMappingStore } from '@/stores/mapping';
import type { BatchGeocodeResult, MappingPatientRow } from '@/types/mapping';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('mapping store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('summarize', () => {
    it('should compute correct summary via fetchAll on mixed patient rows', async () => {
      const store = useMappingStore();
      const rows: MappingPatientRow[] = [
        createMappingPatientRow({
          hn: 'A',
          tb_status: 'active',
          geocode_status: 'success',
          lat: 15,
          lng: 100,
        }),
        createMappingPatientRow({
          hn: 'B',
          tb_status: 'active',
          geocode_status: 'success',
          lat: 15,
          lng: 101,
        }),
        createMappingPatientRow({
          hn: 'C',
          tb_status: 'completed',
          geocode_status: 'success',
          lat: 15,
          lng: 102,
        }),
        createMappingPatientRow({ hn: 'D', tb_status: 'active', geocode_status: 'failed' }),
        createMappingPatientRow({ hn: 'E', tb_status: 'died', geocode_status: 'missing_address' }),
      ];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.summary).toEqual({
        total_patients: 5,
        active_patients: 3,
        mapped_patients: 3,
        unmapped_patients: 2,
        missing_address_patients: 1,
      });
    });

    it('should return zero counts for empty array via fetchAll', async () => {
      const store = useMappingStore();
      vi.mocked(invoke).mockResolvedValue([]);

      await store.fetchAll();

      expect(store.summary).toEqual({
        total_patients: 0,
        active_patients: 0,
        mapped_patients: 0,
        unmapped_patients: 0,
        missing_address_patients: 0,
      });
    });

    it('should count patients with lat=null or lng=null as unmapped via fetchAll', async () => {
      const store = useMappingStore();
      const rows: MappingPatientRow[] = [
        createMappingPatientRow({ hn: 'A', geocode_status: 'success', lat: null, lng: 100 }),
        createMappingPatientRow({ hn: 'B', geocode_status: 'success', lat: 15, lng: null }),
        createMappingPatientRow({ hn: 'C', geocode_status: 'success', lat: null, lng: null }),
      ];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.summary?.total_patients).toBe(3);
      expect(store.summary?.mapped_patients).toBe(0);
      expect(store.summary?.unmapped_patients).toBe(3);
    });
  });

  describe('fetchAll', () => {
    it('should populate patients and summary on success', async () => {
      const store = useMappingStore();
      const rows: MappingPatientRow[] = [
        createMappingPatientRow({ hn: 'A', tb_status: 'active' }),
        createMappingPatientRow({ hn: 'B', tb_status: 'active' }),
      ];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.patients).toEqual(rows);
      expect(store.summary).toEqual({
        total_patients: 2,
        active_patients: 2,
        mapped_patients: 2,
        unmapped_patients: 0,
        missing_address_patients: 0,
      });
      expect(store.isLoading).toBe(false);
    });

    it('should auto-select the first patient when none is selected', async () => {
      const store = useMappingStore();
      const rows: MappingPatientRow[] = [createMappingPatientRow({ hn: 'FIRST' })];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.selectedHn).toBe('FIRST');
    });

    it('should fall back to first patient when the previously selected HN is gone', async () => {
      const store = useMappingStore();
      store.selectedHn = 'OLD_HN';
      const rows: MappingPatientRow[] = [
        createMappingPatientRow({ hn: 'NEW_A' }),
        createMappingPatientRow({ hn: 'NEW_B' }),
      ];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.selectedHn).toBe('NEW_A');
    });

    it('should keep the selected HN when it still exists in results', async () => {
      const store = useMappingStore();
      store.selectedHn = 'KEEP_ME';
      const rows: MappingPatientRow[] = [
        createMappingPatientRow({ hn: 'OTHER_A' }),
        createMappingPatientRow({ hn: 'KEEP_ME' }),
      ];
      vi.mocked(invoke).mockResolvedValue(rows);

      await store.fetchAll();

      expect(store.selectedHn).toBe('KEEP_ME');
    });

    it('should set selectedHn to null when results are empty', async () => {
      const store = useMappingStore();
      store.selectedHn = 'SOMETHING';
      vi.mocked(invoke).mockResolvedValue([]);

      await store.fetchAll();

      expect(store.selectedHn).toBeNull();
    });

    it('should set error on fetch failure', async () => {
      const store = useMappingStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Network error'));

      await store.fetchAll();

      expect(store.error).toContain('Network error');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('selectedPatient', () => {
    it('should return the patient matching selectedHn', () => {
      const store = useMappingStore();
      store.patients = [createMappingPatientRow({ hn: 'A' }), createMappingPatientRow({ hn: 'B' })];
      store.selectedHn = 'B';

      expect(store.selectedPatient).toEqual(store.patients[1]);
    });

    it('should return null when no match is found', () => {
      const store = useMappingStore();
      store.patients = [createMappingPatientRow({ hn: 'A' })];
      store.selectedHn = 'NONEXISTENT';

      expect(store.selectedPatient).toBeNull();
    });
  });

  describe('selectPatient', () => {
    it('should set selectedHn', () => {
      const store = useMappingStore();
      store.selectPatient('ABC');
      expect(store.selectedHn).toBe('ABC');
    });
  });

  describe('geocodePatient', () => {
    it('should update the matched patient in the list and recalculate summary', async () => {
      const store = useMappingStore();
      store.patients = [
        createMappingPatientRow({ hn: 'A', geocode_status: 'pending', lat: null, lng: null }),
        createMappingPatientRow({ hn: 'B', geocode_status: 'pending', lat: null, lng: null }),
      ];
      const updated: MappingPatientRow = createMappingPatientRow({
        hn: 'A',
        geocode_status: 'success',
        lat: 14.0,
        lng: 101.0,
        geocoded_at: '2025-06-01T10:00:00',
      });
      vi.mocked(invoke).mockResolvedValue(updated);

      const result = await store.geocodePatient('A');

      expect(result).toEqual(updated);
      expect(store.patients[0]).toEqual(updated);
      expect(store.patients[1].geocode_status).toBe('pending'); // unchanged
      expect(store.summary?.mapped_patients).toBe(1);
    });

    it('should set error on failure', async () => {
      const store = useMappingStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Geocoding failed'));

      await expect(store.geocodePatient('A')).rejects.toThrow('Geocoding failed');
      expect(store.error).toContain('Geocoding failed');
      expect(store.isGeocoding).toBe(false);
    });
  });

  describe('batchGeocode', () => {
    it('should call backend, re-fetch all data, and return the batch result', async () => {
      const store = useMappingStore();
      const batchResult: BatchGeocodeResult = createBatchGeocodeResult();
      const refreshedRows: MappingPatientRow[] = [createMappingPatientRow({ hn: 'A' })];
      vi.mocked(invoke)
        .mockResolvedValueOnce(batchResult) // batch_geocode_patients
        .mockResolvedValueOnce(refreshedRows); // get_mapping_patients

      const result = await store.batchGeocode(5);

      expect(result).toEqual(batchResult);
      expect(invoke).toHaveBeenCalledWith('batch_geocode_patients', { limit: 5 });
      expect(store.patients).toEqual(refreshedRows);
    });

    it('should default limit to 10 when not specified', async () => {
      const store = useMappingStore();
      vi.mocked(invoke).mockResolvedValueOnce(createBatchGeocodeResult()).mockResolvedValueOnce([]);

      await store.batchGeocode();

      expect(invoke).toHaveBeenCalledWith('batch_geocode_patients', { limit: 10 });
    });

    it('should set error and throw on failure', async () => {
      const store = useMappingStore();
      vi.mocked(invoke).mockRejectedValue(new Error('API down'));

      await expect(store.batchGeocode()).rejects.toThrow('API down');
      expect(store.error).toContain('API down');
      expect(store.isBatchGeocoding).toBe(false);
    });
  });
});
