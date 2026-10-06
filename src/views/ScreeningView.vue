<script setup lang="ts">
import { CheckCircle, Clock, Loader2, RotateCcw, Search, UserPlus, X } from '@lucide/vue';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import EnrollModal from '@/components/screening/EnrollModal.vue';
import PatientTable from '@/components/screening/PatientTable.vue';
import { useScreeningStore } from '@/stores/screening';
import { useSettingsStore } from '@/stores/settings';

const screeningStore = useScreeningStore();
const settingsStore = useSettingsStore();
const showEnrollModal = ref(false);
const enrollSuccessMessage = ref<string | null>(null);
let enrollSuccessTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  if (settingsStore.isConnected) {
    screeningStore.search();
  }
});

const stopConnectionWatch = watch(
  () => settingsStore.isConnected,
  (connected, wasConnected) => {
    if (connected && !wasConnected && screeningStore.results.length === 0) {
      screeningStore.search();
    }
  },
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (screeningStore.selectedHns.size > 0) {
      screeningStore.clearSelection();
      e.preventDefault();
    }
  }
  if (e.key === 'Enter' && screeningStore.selectedHns.size > 0) {
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'INPUT' &&
      target.tagName !== 'SELECT' &&
      target.tagName !== 'TEXTAREA'
    ) {
      showEnrollModal.value = true;
      e.preventDefault();
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  stopConnectionWatch();
  document.removeEventListener('keydown', onKeydown);
  if (enrollSuccessTimer) {
    clearTimeout(enrollSuccessTimer);
    enrollSuccessTimer = null;
  }
});

function resetFilters() {
  screeningStore.resetFilters();
  screeningStore.search();
}

function handleEnrolled(count: number) {
  // The enrolled patients no longer appear in the selectable results, so the
  // selection must be dropped or the action bar would stay stuck.
  screeningStore.clearSelection();
  enrollSuccessMessage.value = `ลงทะเบียนสำเร็จ ${count} ราย`;
  if (enrollSuccessTimer) {
    clearTimeout(enrollSuccessTimer);
  }
  enrollSuccessTimer = setTimeout(() => {
    enrollSuccessMessage.value = null;
    enrollSuccessTimer = null;
  }, 4000);
  screeningStore.search();
}

function dismissEnrollSuccess() {
  enrollSuccessMessage.value = null;
  if (enrollSuccessTimer) {
    clearTimeout(enrollSuccessTimer);
    enrollSuccessTimer = null;
  }
}

function toggleDrugFilter(drug: string) {
  const classes = screeningStore.filters.drug_classes ?? [];
  const idx = classes.indexOf(drug);
  if (idx >= 0) {
    screeningStore.filters.drug_classes = classes.filter((d) => d !== drug);
  } else {
    screeningStore.filters.drug_classes = [...classes, drug];
  }
}

function formatLastSearch(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
</script>

<template>
  <div class="view-root">
    <!-- Page header -->
    <div class="view-header">
      <h1>คัดกรองผู้ป่วย</h1>
      <p>ค้นหาผู้ป่วยที่ได้รับยาวัณโรคจากระบบ HOSxP</p>
    </div>

    <!-- Filter card -->
    <div class="filter-card">
      <!-- Search row (HN + Name) -->
      <div class="filter-search-row">
        <div class="filter-group filter-group-search">
          <label for="hnSearch">ค้นหา HN</label>
          <input
            id="hnSearch"
            type="text"
            placeholder="เช่น 12345..."
            v-model="screeningStore.filters.hn_search"
            @keydown.enter="screeningStore.search()"
          />
        </div>
        <div class="filter-group filter-group-search">
          <label for="nameSearch">ค้นหาชื่อ</label>
          <input
            id="nameSearch"
            type="text"
            placeholder="ชื่อหรือนามสกุล..."
            v-model="screeningStore.filters.name_search"
            @keydown.enter="screeningStore.search()"
          />
        </div>
      </div>
      <div class="filter-row">
        <!-- Date from -->
        <div class="filter-group">
          <label for="dateFrom">วันที่จ่ายยา (ตั้งแต่)</label>
          <input
            id="dateFrom"
            type="date"
            v-model="screeningStore.filters.date_from"
          />
        </div>

        <!-- Date to -->
        <div class="filter-group">
          <label for="dateTo">ถึง</label>
          <input
            id="dateTo"
            type="date"
            v-model="screeningStore.filters.date_to"
          />
        </div>

        <!-- Enrollment status -->
        <div class="filter-group">
          <label for="enrollStatus">สถานะ</label>
          <select
            id="enrollStatus"
            v-model="screeningStore.filters.enrollment_status"
          >
            <option value="all">ทั้งหมด</option>
            <option value="not_enrolled">ยังไม่ได้ลงทะเบียน</option>
            <option value="enrolled">ลงทะเบียนแล้ว</option>
            <option value="discharged">จำหน่ายแล้ว</option>
          </select>
        </div>

        <!-- Drug class filter -->
        <div class="filter-group drug-filter">
          <label>ยาที่ได้รับ</label>
          <div class="drug-checkboxes">
            <label
              v-for="drug in ['H', 'R', 'Z', 'E']"
              :key="drug"
              class="drug-check-label"
              :title="{ H: 'Isoniazid', R: 'Rifampicin', Z: 'Pyrazinamide', E: 'Ethambutol' }[drug]"
            >
              <input
                class="sr-only"
                type="checkbox"
                :value="drug"
                :checked="screeningStore.filters.drug_classes?.includes(drug)"
                @change="toggleDrugFilter(drug)"
              />
              <span :class="`drug-chip drug-${drug}`">{{ drug }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Filter actions -->
      <div class="filter-actions">
        <button class="btn-ghost" type="button" @click="resetFilters">
          <RotateCcw :size="14" />
          ล้างตัวกรอง
        </button>
        <button
          class="btn-primary"
          type="button"
          :disabled="screeningStore.isLoading"
          @click="screeningStore.search()"
        >
          <Loader2 v-if="screeningStore.isLoading" :size="14" class="spin" />
          <Search v-else :size="14" />
          ค้นหา
        </button>
      </div>
    </div>

    <!-- Selection action bar -->
    <Transition name="action-bar-fade">
      <div v-if="screeningStore.selectedHns.size > 0" class="action-bar">
        <span class="selected-count">
          เลือก {{ screeningStore.selectedHns.size }} ราย
        </span>
        <div class="action-bar-right">
          <button
            class="btn-ghost-small"
            type="button"
            @click="screeningStore.clearSelection()"
          >
            ยกเลิกการเลือก
          </button>
          <button
            class="btn-primary"
            type="button"
            @click="showEnrollModal = true"
          >
            <UserPlus :size="14" />
            นำเข้าคลินิก
            <span class="kbd-hint">⏎</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Error banner -->
    <div v-if="screeningStore.error" class="error-banner" role="alert">
      <span>⚠️ {{ screeningStore.error }}</span>
      <button type="button" class="error-banner__retry" @click="screeningStore.search()">
        ลองใหม่
      </button>
    </div>

    <!-- Enrollment success banner -->
    <Transition name="action-bar-fade">
      <div v-if="enrollSuccessMessage" class="success-banner" role="status">
        <CheckCircle :size="15" aria-hidden="true" />
        <span>{{ enrollSuccessMessage }}</span>
        <button
          type="button"
          class="success-banner__close"
          aria-label="ปิด"
          @click="dismissEnrollSuccess"
        >
          <X :size="14" aria-hidden="true" />
        </button>
      </div>
    </Transition>

    <!-- Results meta row -->
    <div
      v-if="!screeningStore.isLoading && screeningStore.results.length > 0"
      class="results-meta"
    >
      พบ
      <strong>{{ screeningStore.results.length }}</strong>
      ราย
      <span v-if="screeningStore.isStale" class="stale-badge">
        <Clock :size="11" />
        ข้อมูลอาจไม่เป็นปัจจุบัน
      </span>
      <span v-if="screeningStore.lastSearchAt" class="last-search-badge">
        <Clock :size="11" />
        ค้นหาล่าสุด {{ formatLastSearch(screeningStore.lastSearchAt) }}
      </span>
    </div>

    <!-- Table card -->
    <div class="table-card">
      <PatientTable />
    </div>

    <!-- Enroll modal -->
    <EnrollModal
      v-model="showEnrollModal"
      :patients="screeningStore.selectedRecords"
      @enrolled="handleEnrolled"
    />
  </div>
</template>

<style scoped>
/* -- Root layout -- */
.view-root {
  padding: var(--page-root-padding);
  max-width: var(--page-max-lg);
}

/* -- Page header -- */
.view-header {
  margin-bottom: var(--space-12);
}

.view-header h1 {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-heading);
  color: var(--color-text);
  margin: 0 0 var(--space-2);
}

.view-header p {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  margin: 0;
}

/* -- Filter card -- */
.filter-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--filter-card-padding);
  margin-bottom: var(--space-8);
}

.filter-row {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filter-group label {
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.filter-group input[type='date'],
.filter-group select {
  padding: var(--input-padding);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-family: var(--font-family);
  color: var(--color-text);
  background: var(--color-surface);
  outline: none;
  transition: var(--transition-input);
}

.filter-group input[type='date']:focus,
.filter-group select:focus {
  border-color: var(--color-focus-ring);
  box-shadow: var(--shadow-focus-input);
}

/* -- Search row (HN + Name) -- */
.filter-search-row {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.filter-group-search {
  flex: 1;
  min-width: 180px;
}

.filter-group input[type='text'] {
  padding: var(--input-padding);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-family: var(--font-family);
  color: var(--color-text);
  background: var(--color-surface);
  outline: none;
  width: 100%;
  transition: var(--transition-input);
}

.filter-group input[type='text']:focus {
  border-color: var(--color-focus-ring);
  box-shadow: var(--shadow-focus-input);
}

/* -- Drug class filter -- */
.drug-filter {
  flex: 1;
  min-width: 200px;
}

.drug-checkboxes {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-wrap: wrap;
}

.drug-check-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

/* Visually hide the real checkbox; the chip acts as the toggle indicator */
.drug-check-label input[type='checkbox']:focus-visible + .drug-chip {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.drug-chip {
  padding: var(--space-3) var(--space-6);
  border-radius: 9999px;
  font-size: var(--text-sm);
  font-weight: var(--weight-heading);
  cursor: pointer;
  transition: opacity var(--duration-base) var(--ease-standard);
  user-select: none;
}

/* Unchecked: dim the chip */
.drug-check-label input[type='checkbox']:not(:checked) + .drug-chip {
  opacity: 0.35;
}

/* Drug class colour tokens */
.drug-H {
  background: var(--drug-H-bg);
  color: var(--color-info);
}
.drug-R {
  background: var(--drug-R-bg);
  color: var(--color-warning);
}
.drug-Z {
  background: var(--drug-Z-bg);
  color: var(--drug-Z);
}
.drug-E {
  background: var(--drug-E-bg);
  color: var(--color-accent);
}

/* -- Filter actions -- */
.filter-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-8);
  justify-content: flex-end;
  align-items: center;
}

/* -- Action bar (appears when rows are selected) -- */
.action-bar {
  background: var(--tint-selected);
  border: 1px solid rgba(0, 117, 222, 0.2);
  border-radius: var(--radius-md);
  padding: var(--space-6) var(--space-10);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-8);
}

.selected-count {
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  color: var(--color-blue);
}

.action-bar-right {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

/* -- Action bar transition -- */
.action-bar-fade-enter-active,
.action-bar-fade-leave-active {
  transition: var(--transition-fade-slide);
}

.action-bar-fade-enter-from,
.action-bar-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* -- Error banner -- */
.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  background: var(--alert-error-bg);
  border: 1px solid rgba(221, 91, 0, 0.25);
  border-radius: var(--radius-md);
  padding: var(--alert-padding);
  font-size: var(--text-body-sm);
  color: var(--color-orange);
  margin-bottom: var(--space-8);
}

.error-banner__retry {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-6);
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  cursor: pointer;
}

.error-banner__retry:hover {
  background: rgba(221, 91, 0, 0.08);
}

/* -- Enrollment success banner -- */
.success-banner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--alert-success-bg);
  border: 1px solid var(--border-color-green);
  border-radius: var(--radius-md);
  padding: var(--alert-padding);
  font-size: var(--text-body-sm);
  color: var(--color-success);
  margin-bottom: var(--space-8);
}

.success-banner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  color: inherit;
  cursor: pointer;
}

.success-banner__close:hover {
  background: var(--status-active-bg);
}

/* -- Results meta -- */
.results-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
  padding-left: var(--space-1);
}

.results-meta strong {
  color: var(--color-text-secondary);
  font-weight: var(--weight-emphasis);
}

/* -- Table card -- */
.table-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}


.btn-ghost-small {
  background: transparent;
  border: none;
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-blue);
  font-family: var(--font-family);
  transition: var(--transition-btn);
}

.btn-ghost-small:hover {
  background: var(--tint-blue-hover);
}


/* -- Spinner -- */
/* -- Last search badge -- */
.last-search-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: var(--space-4);
  font-size: var(--text-xs);
  font-weight: var(--weight-body);
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  padding: var(--space-1) var(--space-4);
  border-radius: 9999px;
}

/* -- Stale data badge -- */
.stale-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: var(--space-4);
  font-size: var(--text-xs);
  font-weight: var(--weight-emphasis);
  color: var(--palette-orange-dark);
  background: var(--tint-orange);
  padding: var(--space-1) var(--space-4);
  border-radius: 9999px;
}

/* -- Keyboard shortcut hint -- */
.kbd-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  padding: 0 var(--space-2);
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  font-weight: var(--weight-heading);
  line-height: 1;
}
</style>