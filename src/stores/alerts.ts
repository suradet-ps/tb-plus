import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { PatientAlert } from '@/types/alert';

export const useAlertStore = defineStore('alerts', () => {
  const alerts = ref<PatientAlert[]>([]);
  const isLoading = ref(false);
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  const redAlerts = computed(() => alerts.value.filter((a) => a.severity === 'red'));
  const yellowAlerts = computed(() => alerts.value.filter((a) => a.severity === 'yellow'));
  const totalCount = computed(() => alerts.value.length);
  const redCount = computed(() => redAlerts.value.length);

  function alertsForPatient(hn: string): PatientAlert[] {
    return alerts.value.filter((a) => a.hn === hn);
  }

  async function refresh(): Promise<void> {
    try {
      isLoading.value = true;
      const data = await invoke<PatientAlert[]>('get_patient_alerts');
      alerts.value = data;
    } catch (e) {
      console.error('Alert refresh failed:', e);
    } finally {
      isLoading.value = false;
    }
  }

  function startAutoRefresh(intervalMs = 30 * 60 * 1000): void {
    refresh();
    refreshInterval = setInterval(refresh, intervalMs);
  }

  function stopAutoRefresh(): void {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  return {
    alerts,
    isLoading,
    redAlerts,
    yellowAlerts,
    totalCount,
    redCount,
    alertsForPatient,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
  };
});
