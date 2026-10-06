<script setup lang="ts">
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, UserMinus, Users } from '@lucide/vue';
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '@/components/shared/EmptyState.vue';
import ErrorState from '@/components/shared/ErrorState.vue';
import LoadingState from '@/components/shared/LoadingState.vue';
import { usePatientStore } from '@/stores/patient';
import { outcomeLabel, formatThaiDate as toThaiDate } from '@/utils/format';

const patientStore = usePatientStore();

onMounted(() => {
  patientStore.fetchDischargedPatients();
});

const total = computed(() => patientStore.dischargedPatients.length);

function getOutcomeLabel(p: import('@/types/patient').ActivePatientRow): string {
  return outcomeLabel(p.outcome_value ?? p.tb_patient.status);
}

function getOutcomeColor(p: import('@/types/patient').ActivePatientRow): string {
  const outcome = p.outcome_value ?? p.tb_patient.status;
  switch (outcome) {
    case 'cured':
      return 'var(--color-success)';
    case 'treatment_completed':
      return 'var(--outcome-completed-text)';
    case 'treatment_failed':
      return 'var(--color-warning)';
    case 'died':
      return 'var(--color-text-secondary)';
    case 'lost_to_followup':
      return 'var(--color-warning)';
    case 'transferred_out':
      return 'var(--color-accent)';
    case 'not_evaluated':
      return 'var(--outcome-not-evaluated-text)';
    // Fallback for legacy tb_patients.status values
    case 'completed':
      return 'var(--outcome-completed-text)';
    case 'transferred':
      return 'var(--color-accent)';
    case 'defaulted':
      return 'var(--color-warning)';
    default:
      return 'var(--outcome-not-evaluated-text)';
  }
}

function getOutcomeBg(p: import('@/types/patient').ActivePatientRow): string {
  const outcome = p.outcome_value ?? p.tb_patient.status;
  switch (outcome) {
    case 'cured':
      return 'var(--outcome-cured-bg)';
    case 'treatment_completed':
    case 'completed':
      return 'var(--outcome-completed-bg)';
    case 'treatment_failed':
      return 'var(--outcome-failed-bg)';
    case 'died':
      return 'var(--outcome-died-bg)';
    case 'lost_to_followup':
    case 'defaulted':
      return 'var(--outcome-lost-bg)';
    case 'transferred_out':
    case 'transferred':
      return 'var(--outcome-transferred-bg)';
    default:
      return 'var(--outcome-not-evaluated-bg)';
  }
}

function getTbTypeLabel(tbType: string | null | undefined): string {
  if (tbType === 'pulmonary') return 'วัณโรคปอด';
  if (tbType === 'extra_pulmonary') return 'วัณโรคนอกปอด';
  return '-';
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
    <LoadingState
      v-if="patientStore.isLoadingDischarged && patientStore.dischargedPatients.length === 0"
    />

    <!-- Error state -->
    <ErrorState
      v-else-if="patientStore.dischargedPatientsError && patientStore.dischargedPatients.length === 0"
      :message="patientStore.dischargedPatientsError"
      @retry="patientStore.fetchDischargedPatients()"
    />

    <!-- Empty state -->
    <EmptyState
      v-else-if="!patientStore.isLoadingDischarged && patientStore.dischargedPatients.length === 0"
      title="ยังไม่มีผู้ป่วยที่จำหน่าย"
      subtitle="ผู้ป่วยที่จำหน่ายออกจากคลินิกจะแสดงที่นี่"
    >
      <template #icon>
        <UserMinus :size="44" class="view-state__icon" aria-hidden="true" />
      </template>
    </EmptyState>

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
                  background: getOutcomeBg(p),
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
  letter-spacing: var(--tracking-heading);
  color: var(--color-text);
  margin: 0 0 var(--space-2);
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


/* -- Stats bar -- */
.stats-bar {
  display: flex;
  gap: var(--space-6);
  margin-bottom: var(--space-10);
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
  gap: var(--space-1);
}

.stat-num {
  font-size: var(--text-display);
  font-weight: var(--weight-heading);
  line-height: 1;
  letter-spacing: var(--tracking-tight);
  color: var(--color-text);
}

.stat-num-teal   { color: var(--color-teal); }
.stat-num-orange { color: var(--color-orange); }
.stat-num-gray   { color: var(--color-text-muted); }

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
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
  padding: var(--space-5) var(--space-7);
  text-align: left;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  border-bottom: var(--border-standard);
  white-space: nowrap;
}

.data-row {
  border-bottom: var(--border-standard);
  transition: var(--transition-bg);
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-alt);
}

.discharged-table td {
  padding: var(--table-cell-padding);
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
  font-variant-numeric: tabular-nums;
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
  padding: var(--space-2) var(--space-5);
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
</style>