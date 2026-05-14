<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useScreeningStore } from '@/stores/screening';
import { useSettingsStore } from '@/stores/settings';

const screeningStore = useScreeningStore();
const settingsStore = useSettingsStore();
const _showEnrollModal = ref(false);

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

function _resetFilters() {
  screeningStore.filters = {
    enrollment_status: 'all',
    page: 1,
    page_size: 50,
    hn_search: undefined,
    name_search: undefined,
  };
  screeningStore.search();
}

function _handleEnrolled() {
  screeningStore.clearSelection();
  screeningStore.search();
}

function _toggleDrugFilter(drug: string) {
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
    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div class="view-header">
      <h1>คัดกรองผู้ป่วย</h1>
      <p>ค้นหาผู้ป่วยที่ได้รับยาวัณโรคจากระบบ HOSxP</p>
    </div>

    <!-- ── Filter card ──────────────────────────────────────────────────────── -->
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

    <!-- ── Selection action bar ─────────────────────────────────────────────── -->
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

    <!-- ── Error banner ─────────────────────────────────────────────────────── -->
    <div v-if="screeningStore.error" class="error-banner" role="alert">
      ⚠️ {{ screeningStore.error }}
    </div>

    <!-- ── Results meta row ─────────────────────────────────────────────────── -->
    <div
      v-if="!screeningStore.isLoading && screeningStore.results.length > 0"
      class="results-meta"
    >
      พบ
      <strong>{{ screeningStore.results.length }}</strong>
      ราย
    </div>

    <!-- ── Table card ───────────────────────────────────────────────────────── -->
    <div class="table-card">
      <PatientTable />
    </div>

    <!-- ── Enroll modal ─────────────────────────────────────────────────────── -->
    <EnrollModal
      v-model="showEnrollModal"
      :patients="screeningStore.selectedRecords"
      @enrolled="handleEnrolled"
    />
  </div>
</template>

<style scoped>
/* ── Root layout ─────────────────────────────────────────────────────────────── */
.view-root {
  padding: 32px 32px 48px;
  max-width: 1200px;
}

/* ── Page header ─────────────────────────────────────────────────────────────── */
.view-header {
  margin-bottom: 24px;
}

.view-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.view-header p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── Filter card ─────────────────────────────────────────────────────────────── */
.filter-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 20px 24px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.filter-group input[type='date'],
.filter-group select {
  padding: 6px 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: var(--font);
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.filter-group input[type='date']:focus,
.filter-group select:focus {
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.1);
}

/* ── Search row (HN + Name) ──────────────────────────────────────────────────── */
.filter-search-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.filter-group-search {
  flex: 1;
  min-width: 180px;
}

.filter-group input[type='text'] {
  padding: 6px 10px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: var(--font);
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.filter-group input[type='text']:focus {
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.1);
}

/* ── Drug class filter ───────────────────────────────────────────────────────── */
.drug-filter {
  flex: 1;
  min-width: 200px;
}

.drug-checkboxes {
  display: flex;
  gap: 8px;
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
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  user-select: none;
}

/* Unchecked: dim the chip */
.drug-check-label input[type='checkbox']:not(:checked) + .drug-chip {
  opacity: 0.35;
}

/* Drug class colour tokens */
.drug-H {
  background: #e8f8f7;
  color: #2a9d99;
}
.drug-R {
  background: #fdf0e8;
  color: #dd5b00;
}
.drug-Z {
  background: #f0ebe6;
  color: #523410;
}
.drug-E {
  background: #e8f2fd;
  color: #0075de;
}

/* ── Filter actions ──────────────────────────────────────────────────────────── */
.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  justify-content: flex-end;
  align-items: center;
}

/* ── Action bar (appears when rows are selected) ─────────────────────────────── */
.action-bar {
  background: #f0f7ff;
  border: 1px solid rgba(0, 117, 222, 0.2);
  border-radius: var(--radius-md);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.selected-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-blue);
}

.action-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Action bar transition ───────────────────────────────────────────────────── */
.action-bar-fade-enter-active,
.action-bar-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.action-bar-fade-enter-from,
.action-bar-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Error banner ────────────────────────────────────────────────────────────── */
.error-banner {
  background: rgba(221, 91, 0, 0.08);
  border: 1px solid rgba(221, 91, 0, 0.25);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  font-size: 13px;
  color: var(--color-orange);
  margin-bottom: 16px;
}

/* ── Results meta ────────────────────────────────────────────────────────────── */
.results-meta {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  padding-left: 2px;
}

.results-meta strong {
  color: var(--color-text-secondary);
  font-weight: 600;
}

/* ── Table card ──────────────────────────────────────────────────────────────── */
.table-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* ── Shared buttons ──────────────────────────────────────────────────────────── */
.btn-ghost {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  transition: background 0.12s, color 0.12s;
}

.btn-ghost:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

.btn-ghost-small {
  background: transparent;
  border: none;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-blue);
  font-family: var(--font);
  transition: background 0.12s;
}

.btn-ghost-small:hover {
  background: rgba(0, 117, 222, 0.08);
}

.btn-primary {
  background: var(--color-blue);
  color: #fff;
  border: none;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  transition: background 0.12s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-blue-active);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Spinner ─────────────────────────────────────────────────────────────────── */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>