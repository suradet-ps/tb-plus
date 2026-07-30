import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type {
  ActivePatientRow,
  EnrollmentInput,
  PatientDemographics,
  PatientDetail,
} from '@/types/patient';

const STORAGE_KEY_DEMOGRAPHICS = 'tb_patient_demographics';

function loadDemographicsCache(): Record<string, PatientDemographics> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEMOGRAPHICS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as Record<string, PatientDemographics>;
  } catch {
    return {};
  }
}

function saveDemographicsCache(cache: Record<string, PatientDemographics>): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEMOGRAPHICS, JSON.stringify(cache));
  } catch {
    // silent
  }
}

export const usePatientStore = defineStore('patient', () => {
  const activePatients = ref<ActivePatientRow[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentPatient = ref<PatientDetail | null>(null);
  const isLoadingDetail = ref(false);
  const demographicsSource = ref<'live' | 'cache' | null>(null);

  const dischargedPatients = ref<ActivePatientRow[]>([]);
  const isLoadingDischarged = ref(false);

  // Patient demographics cache — persists across sessions
  const demographicsCache = ref<Record<string, PatientDemographics>>(loadDemographicsCache());

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
      demographicsSource.value = null;
      const data = await invoke<PatientDetail>('get_patient_detail', { hn });

      // If MySQL returned demographics, cache them
      if (data.demographics) {
        demographicsCache.value[hn] = data.demographics;
        saveDemographicsCache(demographicsCache.value);
        demographicsSource.value = 'live';
      } else if (demographicsCache.value[hn]) {
        // MySQL offline — merge cached demographics into the detail
        data.demographics = demographicsCache.value[hn];
        demographicsSource.value = 'cache';
      }

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
    demographicsSource,
    dischargedPatients,
    isLoadingDischarged,
    fetchActivePatients,
    fetchPatientDetail,
    fetchDischargedPatients,
    enrollPatient,
  };
});
