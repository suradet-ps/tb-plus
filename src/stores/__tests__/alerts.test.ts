import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAlert, createRedAlert, createYellowAlert } from '@/__tests__/factories/alert';
import { useAlertStore } from '@/stores/alerts';
import type { PatientAlert } from '@/types/alert';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('alert store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    const store = useAlertStore();
    store.stopAutoRefresh();
  });

  describe('refresh', () => {
    it('should populate alerts on successful fetch', async () => {
      const store = useAlertStore();
      const mockAlerts: PatientAlert[] = [
        createRedAlert({ hn: 'HN00001' }),
        createYellowAlert({ hn: 'HN00002' }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockAlerts);

      await store.refresh();

      expect(store.alerts).toEqual(mockAlerts);
      expect(store.isLoading).toBe(false);
    });

    it('should keep empty array when backend returns no alerts', async () => {
      const store = useAlertStore();
      vi.mocked(invoke).mockResolvedValue([]);

      await store.refresh();

      expect(store.alerts).toEqual([]);
    });

    it('should not crash when the backend call fails', async () => {
      const store = useAlertStore();
      vi.mocked(invoke).mockRejectedValue(new Error('timeout'));

      await store.refresh();

      expect(store.isLoading).toBe(false);
      expect(store.alerts).toEqual([]);
    });

    it('should set isLoading to true during fetch', async () => {
      const store = useAlertStore();
      let resolveInvoke: ((v: unknown) => void) | undefined;
      const pending = new Promise<unknown>((resolve) => {
        resolveInvoke = resolve;
      });
      vi.mocked(invoke).mockReturnValue(pending);

      const refreshPromise = store.refresh();
      expect(store.isLoading).toBe(true);

      resolveInvoke?.([]);
      await refreshPromise;
      expect(store.isLoading).toBe(false);
    });
  });

  describe('redAlerts', () => {
    it("should filter only alerts with severity 'red'", () => {
      const store = useAlertStore();
      store.alerts = [
        createAlert({ severity: 'red', hn: 'A', alert_type: 'overdue' }),
        createAlert({ severity: 'yellow', hn: 'B', alert_type: 'phase_transition' }),
        createAlert({ severity: 'red', hn: 'C', alert_type: 'ethambutol_overrun' }),
      ];

      expect(store.redAlerts).toHaveLength(2);
      expect(store.redAlerts.every((a) => a.severity === 'red')).toBe(true);
    });

    it('should return empty array when no red alerts exist', () => {
      const store = useAlertStore();
      store.alerts = [createAlert({ severity: 'yellow', hn: 'A', alert_type: 'phase_transition' })];

      expect(store.redAlerts).toEqual([]);
    });
  });

  describe('yellowAlerts', () => {
    it("should filter only alerts with severity 'yellow'", () => {
      const store = useAlertStore();
      store.alerts = [
        createAlert({ severity: 'yellow', hn: 'A', alert_type: 'phase_transition' }),
        createAlert({ severity: 'yellow', hn: 'B', alert_type: 'treatment_complete' }),
        createAlert({ severity: 'red', hn: 'C', alert_type: 'overdue' }),
      ];

      expect(store.yellowAlerts).toHaveLength(2);
      expect(store.yellowAlerts.every((a) => a.severity === 'yellow')).toBe(true);
    });
  });

  describe('totalCount', () => {
    it('should return the total number of alerts', () => {
      const store = useAlertStore();
      store.alerts = [createAlert({ hn: 'A' }), createAlert({ hn: 'B' }), createAlert({ hn: 'C' })];
      expect(store.totalCount).toBe(3);
    });

    it('should return 0 when no alerts exist', () => {
      const store = useAlertStore();
      expect(store.totalCount).toBe(0);
    });
  });

  describe('redCount', () => {
    it('should return count of red-severity alerts', () => {
      const store = useAlertStore();
      store.alerts = [
        createAlert({ severity: 'red', hn: 'A' }),
        createAlert({ severity: 'red', hn: 'B' }),
        createAlert({ severity: 'yellow', hn: 'C' }),
      ];
      expect(store.redCount).toBe(2);
    });
  });

  describe('alertsForPatient', () => {
    it('should return only alerts for the given HN', () => {
      const store = useAlertStore();
      store.alerts = [
        createAlert({ hn: 'HN00001' }),
        createAlert({ hn: 'HN00001', alert_type: 'ethambutol_overrun' }),
        createAlert({ hn: 'HN00002' }),
      ];

      const result = store.alertsForPatient('HN00001');
      expect(result).toHaveLength(2);
      expect(result.every((a) => a.hn === 'HN00001')).toBe(true);
    });

    it('should return empty array when no alerts match the HN', () => {
      const store = useAlertStore();
      store.alerts = [createAlert({ hn: 'HN00001' })];
      expect(store.alertsForPatient('HN99999')).toEqual([]);
    });
  });

  describe('startAutoRefresh', () => {
    it('should call refresh immediately and set an interval', async () => {
      vi.useFakeTimers();
      const store = useAlertStore();
      vi.mocked(invoke).mockResolvedValue([]);

      store.startAutoRefresh();

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith('get_patient_alerts');

      vi.advanceTimersByTime(30 * 60 * 1000);
      expect(invoke).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(30 * 60 * 1000);
      expect(invoke).toHaveBeenCalledTimes(3);

      store.stopAutoRefresh();
      vi.useRealTimers();
    });

    it('should accept a custom refresh interval', async () => {
      vi.useFakeTimers();
      const store = useAlertStore();
      vi.mocked(invoke).mockResolvedValue([]);

      store.startAutoRefresh(5000);

      expect(invoke).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000);
      expect(invoke).toHaveBeenCalledTimes(2);

      store.stopAutoRefresh();
      vi.useRealTimers();
    });
  });

  describe('stopAutoRefresh', () => {
    it('should stop the refresh interval', async () => {
      vi.useFakeTimers();
      const store = useAlertStore();
      vi.mocked(invoke).mockResolvedValue([]);

      store.startAutoRefresh();
      expect(invoke).toHaveBeenCalledTimes(1);

      store.stopAutoRefresh();

      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(invoke).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should handle multiple calls safely', () => {
      const store = useAlertStore();
      expect(() => {
        store.stopAutoRefresh();
        store.stopAutoRefresh();
      }).not.toThrow();
    });
  });
});
