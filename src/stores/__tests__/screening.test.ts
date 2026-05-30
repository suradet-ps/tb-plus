import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientDrugRecord } from '@/__tests__/factories/patient';
import { useScreeningStore } from '@/stores/screening';
import type { PatientDrugRecord } from '@/types/patient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function makeRecords(count: number, baseHn = 'HN'): PatientDrugRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createPatientDrugRecord({
      hn: `${baseHn}${String(i + 1).padStart(6, '0')}`,
      full_name: `นาย ผู้ป่วย ${i + 1}`,
    }),
  );
}

describe('screening store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should populate results and clear loading on success', async () => {
      const store = useScreeningStore();
      const mockResults = makeRecords(3);
      vi.mocked(invoke).mockResolvedValue(mockResults);

      await store.search();

      expect(store.results).toEqual(mockResults);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error and clear loading on failure', async () => {
      const store = useScreeningStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Connection refused'));

      await store.search();

      expect(store.isLoading).toBe(false);
      expect(store.error).toContain('Connection refused');
      expect(store.results).toEqual([]);
    });

    it('should set isLoading to true while request is in flight', async () => {
      const store = useScreeningStore();
      let resolveInvoke: ((v: PatientDrugRecord[]) => void) | undefined;
      const pending = new Promise<PatientDrugRecord[]>((resolve) => {
        resolveInvoke = resolve;
      });
      vi.mocked(invoke).mockReturnValue(pending);

      const searchPromise = store.search();
      expect(store.isLoading).toBe(true);

      resolveInvoke?.(makeRecords(1));
      await searchPromise;
      expect(store.isLoading).toBe(false);
    });

    it('should pass current filters to the backend command', async () => {
      const store = useScreeningStore();
      store.filters = {
        date_from: '2025-01-01',
        date_to: '2025-06-01',
        enrollment_status: 'not_enrolled',
        page: 2,
        page_size: 25,
      };
      vi.mocked(invoke).mockResolvedValue([]);

      await store.search();

      expect(invoke).toHaveBeenCalledWith('search_tb_patients', {
        filters: store.filters,
      });
    });

    it('should clear previous error on subsequent successful search', async () => {
      const store = useScreeningStore();
      vi.mocked(invoke).mockRejectedValueOnce(new Error('fail'));
      await store.search();
      expect(store.error).toContain('fail');

      vi.mocked(invoke).mockResolvedValueOnce(makeRecords(1));
      await store.search();
      expect(store.error).toBeNull();
    });
  });

  describe('toggleSelect', () => {
    it('should add an HN to the selection set', () => {
      const store = useScreeningStore();
      store.toggleSelect('HN00001');
      expect(store.selectedHns.has('HN00001')).toBe(true);
    });

    it('should remove an HN when toggled again', () => {
      const store = useScreeningStore();
      store.toggleSelect('HN00001');
      store.toggleSelect('HN00001');
      expect(store.selectedHns.has('HN00001')).toBe(false);
    });

    it('should allow selecting multiple different HNs', () => {
      const store = useScreeningStore();
      store.toggleSelect('HN00001');
      store.toggleSelect('HN00002');
      store.toggleSelect('HN00003');
      expect(store.selectedHns.size).toBe(3);
    });
  });

  describe('clearSelection', () => {
    it('should empty the entire selection set', () => {
      const store = useScreeningStore();
      store.toggleSelect('HN00001');
      store.toggleSelect('HN00002');
      expect(store.selectedHns.size).toBe(2);

      store.clearSelection();
      expect(store.selectedHns.size).toBe(0);
    });
  });

  describe('selectedRecords', () => {
    function setupStoreWithResults(overrides: Partial<PatientDrugRecord>[] = []) {
      const store = useScreeningStore();
      const base = makeRecords(3);
      const records = base.map((r, i) => ({ ...r, ...overrides[i] }));
      vi.mocked(invoke).mockResolvedValue(records);
      return { store, records };
    }

    it('should return selected records that are not currently active enrolled', async () => {
      const { store, records } = setupStoreWithResults([
        { is_enrolled: false },
        { is_enrolled: true, patient_status: 'active' },
        { is_enrolled: false },
      ]);

      await store.search();
      store.toggleSelect(records[0].hn);
      store.toggleSelect(records[1].hn);
      store.toggleSelect(records[2].hn);

      const selected = store.selectedRecords;
      expect(selected).toHaveLength(2);
      expect(selected.map((r) => r.hn)).toEqual([records[0].hn, records[2].hn]);
    });

    it('should include discharged patients in selected records', async () => {
      const { store, records } = setupStoreWithResults([
        { is_enrolled: true, patient_status: 'completed' },
        { is_enrolled: true, patient_status: 'defaulted' },
        { is_enrolled: true, patient_status: 'died' },
      ]);

      await store.search();
      store.toggleSelect(records[0].hn);
      store.toggleSelect(records[1].hn);
      store.toggleSelect(records[2].hn);

      expect(store.selectedRecords).toHaveLength(3);
    });

    it('should return empty array when no HNs are selected', async () => {
      const { store } = setupStoreWithResults();
      await store.search();
      expect(store.selectedRecords).toEqual([]);
    });

    it('should exclude selected HNs that are not in results', async () => {
      const store = useScreeningStore();
      const records = [createPatientDrugRecord({ hn: 'HN00001' })];
      vi.mocked(invoke).mockResolvedValue(records);
      await store.search();

      store.toggleSelect('HN00001');
      store.toggleSelect('HN99999'); // not in results

      expect(store.selectedRecords).toHaveLength(1);
      expect(store.selectedRecords[0].hn).toBe('HN00001');
    });
  });

  describe('default filters', () => {
    it('should default to the last year date range', () => {
      const store = useScreeningStore();
      expect(store.filters.date_from).toBeTruthy();
      expect(store.filters.date_to).toBeTruthy();
      // date_from should be roughly one year before date_to
      const dateFrom = store.filters.date_from ?? '';
      const dateTo = store.filters.date_to ?? '';
      const fromYear = Number.parseInt(dateFrom.split('-')[0], 10);
      const toYear = Number.parseInt(dateTo.split('-')[0], 10);
      expect(toYear - fromYear).toBe(1);
    });

    it("should default enrollment_status to 'all'", () => {
      const store = useScreeningStore();
      expect(store.filters.enrollment_status).toBe('all');
    });

    it('should default page to 1 and page_size to 50', () => {
      const store = useScreeningStore();
      expect(store.filters.page).toBe(1);
      expect(store.filters.page_size).toBe(50);
    });
  });
});
