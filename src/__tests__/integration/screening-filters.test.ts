import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScreeningStore } from '@/stores/screening';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

describe('screening search filters → invoke args', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('should pass default filters to invoke', async () => {
    const store = useScreeningStore();
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const callArgs = vi.mocked(invoke).mock.calls[0];
    const filters = (callArgs[1] as { filters: Record<string, unknown> }).filters;

    expect(filters.date_from).toBeTruthy();
    expect(filters.date_to).toBeTruthy();
    expect(filters.enrollment_status).toBe('all');
    expect(filters.page).toBe(1);
    expect(filters.page_size).toBe(50);
  });

  it('should pass date range filters correctly', async () => {
    const store = useScreeningStore();
    store.filters = {
      date_from: '2024-01-01',
      date_to: '2024-12-31',
      enrollment_status: 'all',
      page: 1,
      page_size: 50,
    };
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const filters = (vi.mocked(invoke).mock.calls[0][1] as { filters: Record<string, unknown> })
      .filters;
    expect(filters.date_from).toBe('2024-01-01');
    expect(filters.date_to).toBe('2024-12-31');
  });

  it('should pass enrollment_status filter to invoke', async () => {
    const store = useScreeningStore();
    store.filters.enrollment_status = 'not_enrolled';
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const filters = (vi.mocked(invoke).mock.calls[0][1] as { filters: Record<string, unknown> })
      .filters;
    expect(filters.enrollment_status).toBe('not_enrolled');
  });

  it('should pass pagination params to invoke', async () => {
    const store = useScreeningStore();
    store.filters.page = 3;
    store.filters.page_size = 25;
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const filters = (vi.mocked(invoke).mock.calls[0][1] as { filters: Record<string, unknown> })
      .filters;
    expect(filters.page).toBe(3);
    expect(filters.page_size).toBe(25);
  });

  it('should pass drug class filter to invoke', async () => {
    const store = useScreeningStore();
    store.filters.drug_classes = ['H', 'R'];
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const filters = (vi.mocked(invoke).mock.calls[0][1] as { filters: Record<string, unknown> })
      .filters;
    expect(filters.drug_classes).toEqual(['H', 'R']);
  });

  it('should pass hn_search and name_search to invoke', async () => {
    const store = useScreeningStore();
    store.filters.hn_search = 'HN00';
    store.filters.name_search = 'ทดสอบ';
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();

    const filters = (vi.mocked(invoke).mock.calls[0][1] as { filters: Record<string, unknown> })
      .filters;
    expect(filters.hn_search).toBe('HN00');
    expect(filters.name_search).toBe('ทดสอบ');
  });

  it('should reflect updated filters on subsequent search calls', async () => {
    const store = useScreeningStore();
    vi.mocked(invoke).mockResolvedValue([]);

    await store.search();
    expect(invoke).toHaveBeenCalledTimes(1);

    store.filters.enrollment_status = 'discharged';
    store.filters.page = 2;
    await store.search();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(
      (vi.mocked(invoke).mock.calls[1][1] as { filters: Record<string, unknown> }).filters
        .enrollment_status,
    ).toBe('discharged');
    expect(
      (vi.mocked(invoke).mock.calls[1][1] as { filters: Record<string, unknown> }).filters.page,
    ).toBe(2);
  });
});
