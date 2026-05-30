import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppointmentRecord, useAppointmentsStore } from '@/stores/appointments';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function createAppointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    hn: 'HN00001',
    full_name: 'นาย ทดสอบ ใจดี',
    nextdate: '2025-06-15',
    ...overrides,
  };
}

describe('appointments store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('fetchAppointments', () => {
    it('should populate appointments on success', async () => {
      const store = useAppointmentsStore();
      const mockData: AppointmentRecord[] = [
        createAppointment({ hn: 'A', nextdate: '2025-06-10' }),
        createAppointment({ hn: 'B', nextdate: '2025-06-15' }),
      ];
      vi.mocked(invoke).mockResolvedValue(mockData);

      await store.fetchAppointments();

      expect(store.appointments).toEqual(mockData);
      expect(store.isLoading).toBe(false);
    });

    it('should set error and clear appointments on failure', async () => {
      const store = useAppointmentsStore();
      store.appointments = [createAppointment()];
      vi.mocked(invoke).mockRejectedValue(new Error('DB error'));

      await store.fetchAppointments();

      expect(store.error).toContain('DB error');
      expect(store.appointments).toEqual([]);
      expect(store.isLoading).toBe(false);
    });

    it('should use the provided days parameter', async () => {
      const store = useAppointmentsStore();
      vi.mocked(invoke).mockResolvedValue([]);

      await store.fetchAppointments(7);

      expect(invoke).toHaveBeenCalledWith('get_appointments', { daysAhead: 7 });
    });

    it('should use store daysAhead when no parameter is given', async () => {
      const store = useAppointmentsStore();
      store.daysAhead = 14;
      vi.mocked(invoke).mockResolvedValue([]);

      await store.fetchAppointments();

      expect(invoke).toHaveBeenCalledWith('get_appointments', { daysAhead: 14 });
    });
  });

  describe('todayAppointments', () => {
    it('should filter appointments matching todayISO', () => {
      const store = useAppointmentsStore();
      const today = store.todayISO;
      store.appointments = [
        createAppointment({ hn: 'A', nextdate: today }),
        createAppointment({ hn: 'B', nextdate: '2025-06-20' }),
        createAppointment({ hn: 'C', nextdate: today }),
      ];

      const todayList = store.todayAppointments;

      expect(todayList).toHaveLength(2);
      expect(todayList.every((a) => a.nextdate === today)).toBe(true);
      expect(todayList.map((a) => a.hn)).toEqual(['A', 'C']);
    });

    it('should return empty when no appointments match today', () => {
      const store = useAppointmentsStore();
      store.appointments = [createAppointment({ hn: 'A', nextdate: '2025-06-20' })];

      expect(store.todayAppointments).toEqual([]);
    });
  });

  describe('upcomingAppointments', () => {
    it('should filter appointments with date after today', () => {
      const store = useAppointmentsStore();
      const today = store.todayISO;
      store.appointments = [
        createAppointment({ hn: 'A', nextdate: today }),
        createAppointment({ hn: 'B', nextdate: '2125-06-01' }),
        createAppointment({ hn: 'C', nextdate: today }),
        createAppointment({ hn: 'D', nextdate: '2125-06-10' }),
      ];

      const upcoming = store.upcomingAppointments;
      const isAfterToday = (date: string) => date > today;

      expect(upcoming).toHaveLength(2);
      expect(upcoming.every((a) => isAfterToday(a.nextdate))).toBe(true);
    });

    it('should exclude appointments from today', () => {
      const store = useAppointmentsStore();
      const today = store.todayISO;
      store.appointments = [
        createAppointment({ hn: 'A', nextdate: today }),
        createAppointment({ hn: 'B', nextdate: '2025-06-01' }),
      ];

      const upcoming = store.upcomingAppointments;
      const hasToday = upcoming.some((a) => a.nextdate === today);

      expect(hasToday).toBe(false);
    });
  });

  describe('todayISO', () => {
    it('should be a valid ISO date string', () => {
      const store = useAppointmentsStore();
      expect(store.todayISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should match the current date', () => {
      const store = useAppointmentsStore();
      const expected = new Date().toISOString().split('T')[0];
      expect(store.todayISO).toBe(expected);
    });
  });

  describe('daysAhead', () => {
    it('should default to 30', () => {
      const store = useAppointmentsStore();
      expect(store.daysAhead).toBe(30);
    });
  });
});
