import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { BatchGeocodeResult, MappingPatientRow, MappingSummary } from '@/types/mapping';

export const useMappingStore = defineStore('mapping', () => {
  const patients = ref<MappingPatientRow[]>([]);
  const summary = ref<MappingSummary | null>(null);
  const selectedHn = ref<string | null>(null);
  const isLoading = ref(false);
  const isGeocoding = ref(false);
  const isBatchGeocoding = ref(false);
  const error = ref<string | null>(null);

  const selectedPatient = computed(
    () => patients.value.find((patient) => patient.hn === selectedHn.value) ?? null,
  );

  function summarize(patientRows: MappingPatientRow[]): MappingSummary {
    const total_patients = patientRows.length;
    const active_patients = patientRows.filter((patient) => patient.tb_status === 'active').length;
    const mapped_patients = patientRows.filter(
      (patient) =>
        patient.geocode_status === 'success' && patient.lat !== null && patient.lng !== null,
    ).length;
    const missing_address_patients = patientRows.filter(
      (patient) => patient.geocode_status === 'missing_address',
    ).length;

    return {
      total_patients,
      active_patients,
      mapped_patients,
      unmapped_patients: total_patients - mapped_patients,
      missing_address_patients,
    };
  }

  async function fetchAll(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;
      const patientRows = await invoke<MappingPatientRow[]>('get_mapping_patients');
      patients.value = patientRows;
      summary.value = summarize(patientRows);

      if (selectedHn.value && !patientRows.some((patient) => patient.hn === selectedHn.value)) {
        selectedHn.value = patientRows[0]?.hn ?? null;
      } else if (!selectedHn.value) {
        selectedHn.value = patientRows[0]?.hn ?? null;
      }
    } catch (e) {
      error.value = String(e);
    } finally {
      isLoading.value = false;
    }
  }

  function selectPatient(hn: string): void {
    selectedHn.value = hn;
  }

  async function geocodePatient(hn: string): Promise<MappingPatientRow> {
    try {
      isGeocoding.value = true;
      error.value = null;
      const updated = await invoke<MappingPatientRow>('geocode_patient_address', { hn });
      patients.value = patients.value.map((patient) => (patient.hn === hn ? updated : patient));
      summary.value = summarize(patients.value);
      return updated;
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      isGeocoding.value = false;
    }
  }

  async function batchGeocode(limit = 10): Promise<BatchGeocodeResult> {
    try {
      isBatchGeocoding.value = true;
      error.value = null;
      const result = await invoke<BatchGeocodeResult>('batch_geocode_patients', { limit });
      await fetchAll();
      return result;
    } catch (e) {
      error.value = String(e);
      throw e;
    } finally {
      isBatchGeocoding.value = false;
    }
  }

  return {
    patients,
    summary,
    selectedHn,
    selectedPatient,
    isLoading,
    isGeocoding,
    isBatchGeocoding,
    error,
    fetchAll,
    selectPatient,
    geocodePatient,
    batchGeocode,
  };
});
