<script setup lang="ts">
import { AlertCircle, Calendar, CalendarDays, RefreshCw } from '@lucide/vue';
import { onMounted } from 'vue';
import { useAppointmentsStore } from '@/stores/appointments';
import { useSettingsStore } from '@/stores/settings';

const store = useAppointmentsStore();
const settingsStore = useSettingsStore();

const todayISO = store.todayISO;
const daysOptions = [7, 14, 30, 60];

function toThaiDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  try {
    const [y, m, d] = isoDate.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
  } catch {
    return '-';
  }
}

function setDays(days: number) {
  store.daysAhead = days;
  store.fetchAppointments(days);
}

onMounted(() => {
  if (settingsStore.isConnected) {
    store.fetchAppointments();
  }
});
</script>

<template>
  <div class="view-root">
    <!-- Page Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="page-title">การนัดหมาย TB Plus</h1>
        <p class="page-subtitle">ตารางนัดหมายจากระบบ HOSxP</p>
      </div>
      <button
        class="btn-refresh"
        :disabled="store.isLoading || !settingsStore.isConnected"
        title="รีเฟรชข้อมูล"
        @click="store.fetchAppointments()"
      >
        <RefreshCw :size="13" :class="{ spin: store.isLoading }" stroke-width="2" />
        รีเฟรช
      </button>
    </div>

    <!-- Days-ahead Filter Chips -->
    <div class="filter-row">
      <span class="filter-label">แสดงนัดล่วงหน้า</span>
      <div class="day-chips">
        <button
          v-for="d in daysOptions"
          :key="d"
          class="day-chip"
          :class="{ 'day-chip--active': store.daysAhead === d }"
          @click="setDays(d)"
        >
          {{ d }} วัน
        </button>
      </div>
    </div>

    <!-- Not Connected State -->
    <div v-if="!settingsStore.isConnected" class="state-box state-box--warn">
      <AlertCircle :size="28" class="state-icon" stroke-width="1.75" />
      <div class="state-text">
        <p class="state-title">ยังไม่ได้เชื่อมต่อ HOSxP</p>
        <p class="state-sub">กรุณาตั้งค่าการเชื่อมต่อฐานข้อมูลที่เมนู "ตั้งค่า" ก่อนใช้งาน</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="store.error && !store.isLoading" class="state-box state-box--error">
      <AlertCircle :size="28" class="state-icon" stroke-width="1.75" />
      <div class="state-text">
        <p class="state-title">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        <p class="state-sub">{{ store.error }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <template v-else>

      <!-- Today's Appointments Highlight Card -->
      <div v-if="!store.isLoading && store.todayAppointments.length > 0" class="today-card">
        <div class="today-card-header">
          <CalendarDays :size="15" class="today-icon" stroke-width="2" />
          <span class="today-title">นัดวันนี้</span>
          <span class="today-count-badge">{{ store.todayAppointments.length }} ราย</span>
        </div>
        <div class="today-rows">
          <div
            v-for="a in store.todayAppointments"
            :key="a.hn"
            class="today-row"
          >
            <span class="today-hn">{{ a.hn }}</span>
            <span class="today-name">{{ a.full_name ?? '-' }}</span>
          </div>
        </div>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="store.isLoading" class="table-card">
        <div class="skeleton-thead" />
        <div v-for="i in 7" :key="i" class="skeleton-row">
          <div class="skeleton-cell" style="width: 100px" />
          <div class="skeleton-cell" style="width: 76px" />
          <div class="skeleton-cell" style="width: 172px" />
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="store.appointments.length === 0" class="empty-state">
        <Calendar :size="36" class="empty-icon" stroke-width="1.5" />
        <p class="empty-title">ไม่มีการนัดหมาย</p>
        <p class="empty-sub">ไม่พบข้อมูลนัดหมายในช่วง {{ store.daysAhead }} วันข้างหน้า</p>
      </div>

      <!-- Appointments Table -->
      <div v-else class="table-card">
        <table class="appt-table">
          <thead>
            <tr>
              <th>วันที่นัด</th>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in store.appointments"
              :key="a.hn + '_' + a.nextdate"
              :class="{ 'row-today': a.nextdate === todayISO }"
            >
              <td class="date-cell">
                <span :class="{ 'date-today': a.nextdate === todayISO }">
                  {{ toThaiDate(a.nextdate) }}
                </span>
                <span v-if="a.nextdate === todayISO" class="today-pill">วันนี้</span>
              </td>
              <td class="hn-cell">{{ a.hn }}</td>
              <td class="name-cell">{{ a.full_name ?? '-' }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Table footer: row count summary -->
        <div class="table-footer">
          พบ {{ store.appointments.length }} รายการนัด · ล่วงหน้า {{ store.daysAhead }} วัน
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* -- Page Root -- */
.view-root {
  padding: var(--page-root-padding);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* -- Header -- */
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-8);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.03em;
  color: var(--color-text);
  line-height: var(--leading-tight);
}

.page-subtitle {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
  line-height: var(--leading-body);
}

/* -- Refresh Button -- */
.btn-refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--btn-padding);
  border-radius: var(--radius-sm);
  border: var(--border-standard);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-ui);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    background 0.12s,
    color 0.12s;
}

.btn-refresh:hover:not(:disabled) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.btn-refresh:disabled {
  opacity: 0.45;
  cursor: default;
}

/* -- Filter Row -- */
.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.filter-label {
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.day-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.day-chip {
  padding: 4px 14px;
  border-radius: var(--radius-pill);
  border: var(--border-standard);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: var(--font-family);
  font-size: var(--text-sm);
  font-weight: var(--weight-ui);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    border-color 0.12s;
}

.day-chip:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.day-chip--active {
  background: var(--tint-blue);
  border-color: rgba(0, 117, 222, 0.3);
  color: var(--color-blue);
  font-weight: var(--weight-emphasis);
}

/* -- State Boxes -- */
.state-box {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--filter-card-padding);
  border-radius: var(--radius-card);
  border: var(--border-standard);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.state-box--warn {
  border-color: rgba(221, 91, 0, 0.2);
  background: rgba(221, 91, 0, 0.04);
}

.state-box--error {
  border-color: rgba(221, 91, 0, 0.2);
  background: rgba(221, 91, 0, 0.04);
}

.state-box--warn .state-icon,
.state-box--error .state-icon {
  color: var(--color-orange);
  flex-shrink: 0;
}

.state-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.state-title {
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
}

.state-sub {
  font-size: 12.5px;
  color: var(--color-text-muted);
}

/* -- Today Highlight Card -- */
.today-card {
  border-radius: var(--radius-card);
  border: 1px solid rgba(42, 157, 153, 0.22);
  border-left: 3px solid var(--color-teal);
  background: var(--tint-teal);
  overflow: hidden;
}

.today-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 10px 16px;
  border-bottom: 1px solid rgba(42, 157, 153, 0.14);
}

.today-icon {
  color: var(--color-teal);
  flex-shrink: 0;
}

.today-title {
  flex: 1;
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-teal);
}

.today-count-badge {
  font-size: var(--text-caption);
  font-weight: var(--weight-heading);
  color: var(--color-surface);
  background: var(--color-teal);
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  line-height: var(--leading-normal);
}

.today-rows {
  padding: 4px 0;
}

.today-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: 7px 16px;
}

.today-hn {
  font-family: var(--font-family-mono-simple);
  font-size: 12.5px;
  font-weight: var(--weight-heading);
  color: var(--color-text);
  min-width: 84px;
}

.today-name {
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
}

/* -- Table Card -- */
.table-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* -- Appointments Table -- */
.appt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-sm);
}

.appt-table thead {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: var(--z-sticky);
}

.appt-table thead th {
  padding: 10px 16px;
  text-align: left;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  border-bottom: var(--border-standard);
  white-space: nowrap;
}

.appt-table tbody tr {
  border-bottom: var(--border-standard);
  transition: background 0.1s;
}

.appt-table tbody tr:last-child {
  border-bottom: none;
}

.appt-table tbody tr:hover {
  background: var(--color-surface-alt);
}

.appt-table tbody tr.row-today {
  background: rgba(42, 157, 153, 0.05);
}

.appt-table tbody tr.row-today:hover {
  background: var(--status-completed-bg);
}

.appt-table td {
  padding: 10px 16px;
  vertical-align: middle;
}

/* -- Table Cells -- */
.date-cell {
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 7px;
}

.date-today {
  font-weight: var(--weight-emphasis);
  color: var(--color-teal);
}

.today-pill {
  font-size: var(--text-xs);
  font-weight: var(--weight-heading);
  color: var(--color-teal);
  background: rgba(42, 157, 153, 0.12);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(42, 157, 153, 0.22);
  white-space: nowrap;
}

.hn-cell {
  font-family: var(--font-family-mono-simple);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  white-space: nowrap;
}

.name-cell {
  font-size: var(--text-body-sm);
  color: var(--color-text);
}

/* -- Table Footer -- */
.table-footer {
  padding: 9px 16px;
  font-size: 11.5px;
  color: var(--color-text-muted);
  border-top: var(--border-standard);
  background: var(--color-surface-alt);
}

/* -- Skeleton Loading -- */
.skeleton-thead {
  height: 38px;
  border-bottom: var(--border-standard);
  background: var(--color-surface);
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 11px 16px;
  border-bottom: var(--border-standard);
}

.skeleton-row:last-child {
  border-bottom: none;
}

.skeleton-cell {
  height: 13px;
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--skeleton-color-1) 25%, var(--skeleton-color-2) 50%, var(--skeleton-color-1) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* -- Empty State -- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 24px;
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  color: var(--color-text-muted);
  text-align: center;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: var(--space-2);
}

.empty-title {
  font-size: var(--text-ui);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
}

.empty-sub {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
}

/* -- Spin Animation -- */
.spin {
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>