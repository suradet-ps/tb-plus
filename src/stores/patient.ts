import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { ActivePatientRow, EnrollmentInput, PatientDetail } from '@/types/patient';

export const usePatientStore = defineStore('patient', () => {
  const activePatients = ref<ActivePatientRow[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentPatient = ref<PatientDetail | null>(null);
  const isLoadingDetail = ref(false);

  const dischargedPatients = ref<ActivePatientRow[]>([]);
  const isLoadingDischarged = ref(false);

  async function fetchActivePatients(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;
      const data = await invoke<ActivePatientRow[]>('get_active_patients');
      activePatients.value = data;
    } catch (e) {
      error.value = String(e);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPatientDetail(hn: string): Promise<void> {
    try {
      isLoadingDetail.value = true;
      error.value = null;
      const data = await invoke<PatientDetail>('get_patient_detail', { hn });
      currentPatient.value = data;
    } catch (e) {
      error.value = String(e);
    } finally {
      isLoadingDetail.value = false;
    }
  }

  async function fetchDischargedPatients(): Promise<void> {
    try {
      isLoadingDischarged.value = true;
      error.value = null;
      const data = await invoke<ActivePatientRow[]>('get_discharged_patients');
      dischargedPatients.value = data;
    } catch (e) {
      error.value = String(e);
    } finally {
      isLoadingDischarged.value = false;
    }
  }

  async function enrollPatient(enrollment: EnrollmentInput): Promise<number> {
    const id = await invoke<number>('enroll_patient', { enrollment });
    await fetchActivePatients();
    return id;
  }

  return {
    activePatients,
    isLoading,
    error,
    currentPatient,
    isLoadingDetail,
    dischargedPatients,
    isLoadingDischarged,
    fetchActivePatients,
    fetchPatientDetail,
    fetchDischargedPatients,
    enrollPatient,
  };
});
