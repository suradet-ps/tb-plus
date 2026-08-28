import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import type { PatientDrugRecord, SearchFilters } from '@/types/patient';

const STORAGE_KEY_FILTERS = 'tb_screening_filters';
const STORAGE_KEY_LAST_SEARCH = 'tb_screening_last_search';
const STORAGE_KEY_CACHE = 'tb_screening_cache';

interface ScreeningCache {
  results: PatientDrugRecord[];
  filters: SearchFilters;
  cachedAt: string;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadSavedFilters(): SearchFilters | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FILTERS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      date_from: typeof parsed.date_from === 'string' ? parsed.date_from : undefined,
      date_to: typeof parsed.date_to === 'string' ? parsed.date_to : undefined,
      drug_classes: Array.isArray(parsed.drug_classes)
        ? (parsed.drug_classes as string[])
        : undefined,
      enrollment_status:
        typeof parsed.enrollment_status === 'string'
          ? (parsed.enrollment_status as SearchFilters['enrollment_status'])
          : 'all',
      page: typeof parsed.page === 'number' ? parsed.page : 1,
      page_size: typeof parsed.page_size === 'number' ? parsed.page_size : 50,
      hn_search: typeof parsed.hn_search === 'string' ? parsed.hn_search : undefined,
      name_search: typeof parsed.name_search === 'string' ? parsed.name_search : undefined,
    };
  } catch {
    return null;
  }
}

function saveFiltersToStorage(filters: SearchFilters): void {
  try {
    localStorage.setItem(STORAGE_KEY_FILTERS, JSON.stringify(filters));
  } catch {
    // storage full or unavailable - silent
  }
}

function buildDefaultFilters(): SearchFilters {
  const today = new Date();
  const dateTo = formatDate(today);
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return {
    date_from: formatDate(oneYearAgo),
    date_to: dateTo,
    enrollment_status: 'all',
    page: 1,
    page_size: 50,
  };
}

function loadCachedScreening(): ScreeningCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScreeningCache;
    if (!Array.isArray(parsed.results) || typeof parsed.cachedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveScreeningCache(results: PatientDrugRecord[], filters: SearchFilters): void {
  try {
    const cache: ScreeningCache = {
      results,
      filters,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(cache));
  } catch {
    // storage full or unavailable - silent
  }
}

export const useScreeningStore = defineStore('screening', () => {
  const results = ref<PatientDrugRecord[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedHns = ref<Set<string>>(new Set());
  const lastSearchAt = ref<string | null>(localStorage.getItem(STORAGE_KEY_LAST_SEARCH));
  const isStale = ref(false);

  const filters = ref<SearchFilters>(loadSavedFilters() ?? buildDefaultFilters());
  const totalCount = ref(0);

  // Load cached results on init if available
  const cached = loadCachedScreening();
  if (cached) {
    results.value = cached.results;
    isStale.value = true;
  }

  watch(
    filters,
    (val) => {
      saveFiltersToStorage(val);
    },
    { deep: true },
  );

  async function search(): Promise<void> {
    try {
      isLoading.value = true;
      error.value = null;
      const data = await invoke<PatientDrugRecord[]>('search_tb_patients', {
        filters: filters.value,
      });
      results.value = data;
      isStale.value = false;
      saveScreeningCache(data, filters.value);
      const now = new Date().toISOString();
      lastSearchAt.value = now;
      try {
        localStorage.setItem(STORAGE_KEY_LAST_SEARCH, now);
      } catch {
        // silent
      }
    } catch (e) {
      // If we have cached data and MySQL is unreachable, show cached results as stale
      if (results.value.length > 0) {
        isStale.value = true;
        error.value = null;
      } else {
        error.value = String(e);
      }
    } finally {
      isLoading.value = false;
    }
  }

  function toggleSelect(hn: string): void {
    if (selectedHns.value.has(hn)) {
      selectedHns.value.delete(hn);
    } else {
      selectedHns.value.add(hn);
    }
  }

  function clearSelection(): void {
    selectedHns.value.clear();
  }

  function resetFilters(): void {
    filters.value = buildDefaultFilters();
    try {
      localStorage.removeItem(STORAGE_KEY_FILTERS);
    } catch {
      // silent
    }
  }

  const selectedRecords = computed(() =>
    results.value.filter(
      (r) =>
        selectedHns.value.has(r.hn) &&
        (!r.is_enrolled || (r.patient_status && r.patient_status !== 'active')),
    ),
  );

  return {
    results,
    isLoading,
    error,
    selectedHns,
    filters,
    totalCount,
    lastSearchAt,
    isStale,
    selectedRecords,
    search,
    toggleSelect,
    clearSelection,
    resetFilters,
  };
});
