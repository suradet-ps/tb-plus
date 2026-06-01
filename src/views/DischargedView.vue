<script setup lang="ts">
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, UserMinus, Users } from '@lucide/vue';
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { usePatientStore } from '@/stores/patient';

const patientStore = usePatientStore();

onMounted(() => {
  patientStore.fetchDischargedPatients();
});

const total = computed(() => patientStore.dischargedPatients.length);

function getOutcomeLabel(p: import('@/types/patient').ActivePatientRow): string {
  const outcome = p.outcome_value ?? p.tb_patient.status;
  switch (outcome) {
    case 'cured':
      return 'หาย';
    case 'treatment_completed':
      return 'รักษาครบ';
    case 'treatment_failed':
      return 'รักษาล้มเหลว';
    case 'died':
      return 'เสียชีวิต';
    case 'lost_to_followup':
      return 'ขาดการรักษา';
    case 'transferred_out':
      return 'ส่งต่อ';
    case 'not_evaluated':
      return 'ไม่ได้ประเมิน';
    // Fallback for legacy tb_patients.status values
    case 'completed':
      return 'รักษาครบ';
    case 'transferred':
      return 'ส่งต่อ';
    case 'defaulted':
      return 'ขาดการรักษา';
    default:
      return outcome;
  }
}

function getOutcomeColor(p: import('@/types/patient').ActivePatientRow): string {
  const outcome = p.outcome_value ?? p.tb_patient.status;
  switch (outcome) {
    case 'cured':
      return 'var(--color-success)';
    case 'treatment_completed':
      return '#2a9d99';
    case 'treatment_failed':
      return 'var(--color-warning)';
    case 'died':
      return 'var(--color-text-secondary)';
    case 'lost_to_followup':
      return 'var(--color-warning)';
    case 'transferred_out':
      return 'var(--color-accent)';
    case 'not_evaluated':
      return '#a39e98';
    // Fallback for legacy tb_patients.status values
    case 'completed':
      return '#2a9d99';
    case 'transferred':
      return 'var(--color-accent)';
    case 'defaulted':
      return 'var(--color-warning)';
    default:
      return '#a39e98';
  }
}

function toThaiDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
  } catch {
    return iso ?? '—';
  }
}

function getTbTypeLabel(tbType: string | null | undefined): string {
  if (tbType === 'pulmonary') return 'วัณโรคปอด';
  if (tbType === 'extra_pulmonary') return 'วัณโรคนอกปอด';
  return '—';
}
</script>

<template>
  <div class="view-root">
    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="header-title">การจำหน่ายผู้ป่วย</h1>
        <p class="header-sub">
          ผู้ป่วย TB ที่จำหน่ายออกจากคลินิกแล้ว
          <strong>{{ total }}</strong> ราย
        </p>
      </div>
      <div class="header-right">
        <button
          class="btn-ghost"
          @click="patientStore.fetchDischargedPatients()"
          :disabled="patientStore.isLoadingDischarged"
          title="รีเฟรชข้อมูล"
        >
          <Loader2 v-if="patientStore.isLoadingDischarged" :size="14" class="spin" />
          <RefreshCw v-else :size="14" />
          รีเฟรช
        </button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-blue">
          <Users :size="15" />
        </div>
        <div class="stat-body">
          <div class="stat-num">{{ total }}</div>
          <div class="stat-label">จำหน่ายทั้งหมด</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-teal">
          <CheckCircle :size="15" />
        </div>
        <div class="stat-body">
          <div class="stat-num stat-num-teal">
            {{ patientStore.dischargedPatients.filter(p => {
              const o = p.outcome_value ?? p.tb_patient.status
              return o === 'cured' || o === 'treatment_completed' || o === 'completed'
            }).length }}
          </div>
          <div class="stat-label">รักษาครบ</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-orange">
          <AlertTriangle :size="15" />
        </div>
        <div class="stat-body">
          <div class="stat-num stat-num-orange">
            {{ patientStore.dischargedPatients.filter(p => {
              const o = p.outcome_value ?? p.tb_patient.status
              return o === 'died' || o === 'lost_to_followup' || o === 'treatment_failed' || o === 'not_evaluated' || o === 'defaulted'
            }).length }}
          </div>
          <div class="stat-label">ขาดยา/เสียชีวิต</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-gray">
          <UserMinus :size="15" />
        </div>
        <div class="stat-body">
          <div class="stat-num stat-num-gray">
            {{ patientStore.dischargedPatients.filter(p => {
              const o = p.outcome_value ?? p.tb_patient.status
              return o === 'transferred_out' || o === 'transferred'
            }).length }}
          </div>
          <div class="stat-label">ส่งต่อ</div>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div
      v-if="patientStore.isLoadingDischarged && patientStore.dischargedPatients.length === 0"
      class="state-container"
    >
      <div class="loading-state">
        <Loader2 :size="28" class="spin loading-icon" />
        <span class="state-title">กำลังโหลดข้อมูล...</span>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!patientStore.isLoadingDischarged && patientStore.dischargedPatients.length === 0"
      class="state-container"
    >
      <div class="empty-state">
        <UserMinus :size="44" class="empty-icon" />
        <span class="state-title">ยังไม่มีผู้ป่วยที่จำหน่าย</span>
        <span class="state-sub">ผู้ป่วยที่จำหน่ายออกจากคลินิกจะแสดงที่นี่</span>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="table-card">
      <table class="discharged-table">
        <thead>
          <tr>
            <th>HN</th>
            <th>ชื่อ-สกุล</th>
            <th>ประเภท TB</th>
            <th>วันลงทะเบียน</th>
            <th>วันอัปเดต</th>
            <th>สถานะ</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in patientStore.dischargedPatients"
            :key="p.tb_patient.hn"
            class="data-row"
          >
            <td class="td-hn">{{ p.tb_patient.hn }}</td>
            <td class="td-name">
              {{ p.demographics?.full_name ?? p.tb_patient.hn }}
            </td>
            <td class="td-type">{{ getTbTypeLabel(p.tb_patient.tb_type) }}</td>
            <td class="td-date">{{ toThaiDate(p.tb_patient.enrolled_at) }}</td>
            <td class="td-date">{{ toThaiDate(p.tb_patient.updated_at?.substring(0, 10)) }}</td>
            <td class="td-status">
              <span
                class="outcome-badge"
                :style="{
                  background: getOutcomeColor(p) + '18',
                  color: getOutcomeColor(p),
                }"
              >
                {{ getOutcomeLabel(p) }}
              </span>
            </td>
            <td class="td-action">
              <RouterLink
                :to="`/patient/${p.tb_patient.hn}`"
                class="btn-view"
              >
                ดูรายละเอียด
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.view-root {
  padding: var(--page-root-padding);
  max-width: 1200px;
}

/* -- Header -- */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-12);
  gap: var(--space-8);
}

.header-title {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.3px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.header-sub {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  margin: 0;
}

.header-sub strong {
  font-weight: var(--weight-heading);
  color: var(--color-text);
}

/* -- Refresh button -- */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 7px 13px;
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface-alt);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* -- Stats bar -- */
.stats-bar {
  display: flex;
  gap: var(--space-6);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  padding: var(--stat-padding);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  box-shadow: var(--shadow-card);
  min-width: 140px;
}

.stat-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon-blue   { background: var(--tint-blue);  color: var(--color-blue); }
.stat-icon-teal   { background: var(--status-completed-bg); color: var(--color-teal); }
.stat-icon-orange { background: var(--status-defaulted-bg);   color: var(--color-orange); }
.stat-icon-gray   { background: var(--btn-secondary-bg);     color: var(--color-text-muted); }

.stat-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-num {
  font-size: var(--text-display);
  font-weight: var(--weight-heading);
  line-height: 1;
  letter-spacing: -0.5px;
  color: var(--color-text);
}

.stat-num-teal   { color: var(--color-teal); }
.stat-num-orange { color: var(--color-orange); }
.stat-num-gray   { color: var(--color-text-muted); }

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 1px;
}

/* -- Loading / empty states -- */
.state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--color-text-muted);
  text-align: center;
}

.loading-icon {
  color: var(--color-blue);
  opacity: 0.7;
  margin-bottom: var(--space-2);
}

.empty-icon {
  opacity: 0.2;
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
}

.state-title {
  font-size: var(--text-ui);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
}

.state-sub {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
  max-width: 320px;
}

/* -- Table card -- */
.table-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.discharged-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-sm);
}

.discharged-table thead {
  background: var(--color-surface-alt);
  position: sticky;
  top: 0;
}

.discharged-table thead th {
  padding: 10px 14px;
  text-align: left;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  border-bottom: var(--border-standard);
  white-space: nowrap;
}

.data-row {
  border-bottom: var(--border-standard);
  transition: background 0.1s;
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-alt);
}

.discharged-table td {
  padding: 10px 14px;
  vertical-align: middle;
}

.td-hn {
  font-weight: var(--weight-emphasis);
  font-family: 'SF Mono', 'Roboto Mono', monospace;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.td-name {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-ui);
  color: var(--color-text);
}

.td-type {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.td-date {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.outcome-badge {
  padding: var(--badge-padding);
  border-radius: 9999px;
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.btn-view {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-blue);
  background: var(--color-badge-bg);
  border: 1px solid rgba(0, 117, 222, 0.2);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: var(--transition-btn);
}

.btn-view:hover {
  background: rgba(0, 117, 222, 0.12);
}

/* -- Spinner -- */
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>