<script setup lang="ts">
import { Loader2, RotateCcw, Search, UserPlus } from '@lucide/vue';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import EnrollModal from '@/components/screening/EnrollModal.vue';
import PatientTable from '@/components/screening/PatientTable.vue';
import { useScreeningStore } from '@/stores/screening';
import { useSettingsStore } from '@/stores/settings';

const screeningStore = useScreeningStore();
const settingsStore = useSettingsStore();
const showEnrollModal = ref(false);

onMounted(() => {
  // Only auto-search if MySQL is already connected.
  // If the background auto-connect in Rust hasn't finished yet (race condition
  // between webview JS startup and lib.rs async task), the watcher below will
  // trigger the search as soon as isConnected flips to true.
  if (settingsStore.isConnected) {
    screeningStore.search();
  }
});

// Watch for MySQL coming online after mount (handles the splash-screen
// race condition where Vue mounts before lib.rs finishes auto-connecting).
// Only fires on false → true transitions and only when there are no
// results yet, so manual searches or reconnects don't double-fire.
const stopConnectionWatch = watch(
  () => settingsStore.isConnected,
  (connected, wasConnected) => {
    if (connected && !wasConnected && screeningStore.results.length === 0) {
      screeningStore.search();
    }
  },
);

onUnmounted(() => {
  stopConnectionWatch();
});

function resetFilters() {
  screeningStore.filters = {
    page: 1,
    page_size: 50,
    hn_search: undefined,
    name_search: undefined,
  };
  screeningStore.search();
}

function handleEnrolled() {
  screeningStore.search();
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
          </button>
        </div>
      </div>
    </Transition>

    <!-- Error banner -->
    <div v-if="screeningStore.error" class="error-banner" role="alert">
      ⚠️ {{ screeningStore.error }}
    </div>

    <!-- Results meta row -->
    <div
      v-if="!screeningStore.isLoading && screeningStore.results.length > 0"
      class="results-meta"
    >
      พบ
      <strong>{{ screeningStore.results.length }}</strong>
      ราย
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
  max-width: 1200px;
}

/* -- Page header -- */
.view-header {
  margin-bottom: var(--space-12);
}

.view-header h1 {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
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
  gap: 6px;
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
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px var(--tint-blue);
}

/* -- Search row (HN + Name) -- */
.filter-search-row {
  display: flex;
  gap: var(--space-8);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
  padding-bottom: 12px;
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
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px var(--tint-blue);
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
  gap: 4px;
  cursor: pointer;
}

/* Hide the real checkbox; the chip acts as the toggle indicator */
.drug-check-label input[type='checkbox'] {
  display: none;
}

.drug-chip {
  padding: 3px 12px;
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
  margin-top: 16px;
  justify-content: flex-end;
  align-items: center;
}

/* -- Action bar (appears when rows are selected) -- */
.action-bar {
  background: var(--tint-selected);
  border: 1px solid rgba(0, 117, 222, 0.2);
  border-radius: var(--radius-md);
  padding: 12px 20px;
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
  background: var(--alert-error-bg);
  border: 1px solid rgba(221, 91, 0, 0.25);
  border-radius: var(--radius-md);
  padding: var(--alert-padding);
  font-size: var(--text-body-sm);
  color: var(--color-orange);
  margin-bottom: var(--space-8);
}

/* -- Results meta -- */
.results-meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
  padding-left: 2px;
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

/* -- Shared buttons -- */
.btn-ghost {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: var(--btn-padding);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-family);
  transition: var(--transition-icon-btn);
}

.btn-ghost:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.btn-ghost-small {
  background: transparent;
  border: none;
  padding: 5px 10px;
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

.btn-primary {
  background: var(--color-blue);
  color: var(--color-text-inverse);
  border: none;
  padding: var(--btn-padding);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-family);
  transition: var(--transition-btn);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-blue-active);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* -- Spinner -- */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>