import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRedAlert, createYellowAlert } from '@/__tests__/factories/alert';
import { useAlertStore } from '@/stores/alerts';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('alert store — full integration path', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    useAlertStore().stopAutoRefresh();
  });

  it('should populate alerts, compute derived stats, and filter by patient', async () => {
    const store = useAlertStore();
    const alerts = [
      createRedAlert({ hn: 'HN00001', alert_type: 'overdue' }),
      createRedAlert({ hn: 'HN00001', alert_type: 'ethambutol_overrun' }),
      createYellowAlert({ hn: 'HN00002', alert_type: 'phase_transition' }),
      createRedAlert({ hn: 'HN00003', alert_type: 'lost_to_followup' }),
      createYellowAlert({ hn: 'HN00003', alert_type: 'treatment_complete' }),
    ];
    vi.mocked(invoke).mockResolvedValue(alerts);

    await store.refresh();

    expect(store.totalCount).toBe(5);
    expect(store.redCount).toBe(3);
    expect(store.yellowAlerts).toHaveLength(2);

    expect(store.alertsForPatient('HN00001')).toHaveLength(2);
    expect(store.alertsForPatient('HN00002')).toHaveLength(1);
    expect(store.alertsForPatient('HN00003')).toHaveLength(2);
    expect(store.alertsForPatient('HN99999')).toHaveLength(0);
  });

  it('should update all computed values when refresh replaces data', async () => {
    const store = useAlertStore();
    vi.mocked(invoke).mockResolvedValue([createRedAlert()]);
    await store.refresh();
    expect(store.redCount).toBe(1);

    vi.mocked(invoke).mockResolvedValue([createYellowAlert(), createYellowAlert()]);
    await store.refresh();
    expect(store.redCount).toBe(0);
    expect(store.totalCount).toBe(2);
  });

  it('should preserve empty state across refresh cycles', async () => {
    const store = useAlertStore();
    vi.mocked(invoke).mockResolvedValue([]);
    await store.refresh();
    expect(store.totalCount).toBe(0);
    expect(store.redAlerts).toEqual([]);
    expect(store.yellowAlerts).toEqual([]);

    vi.mocked(invoke).mockResolvedValue([createRedAlert()]);
    await store.refresh();
    expect(store.totalCount).toBe(1);
  });
});
