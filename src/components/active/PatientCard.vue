<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { ActivePatientRow } from '@/types/patient';

/** Parse regimen string "2HRZE/4HR" → continuation drug letters ["H","R"] */
function getContinuationDrugsFromRegimen(regimen: string): string[] {
  const parts = regimen.split('/');
  if (parts.length < 2) return ['H', 'R'];
  const contPart = parts[1].replace(/^\d+/, ''); // strip leading digit e.g. "4HR" → "HR"
  return (['H', 'R', 'Z', 'E'] as const).filter((d) => contPart.toUpperCase().includes(d));
}

const props = defineProps<{ patient: ActivePatientRow }>();
const emit = defineEmits<{
  'view-detail': [hn: string];
  'add-followup': [hn: string];
  discharge: [hn: string];
}>();

const router = useRouter();

const _name = computed(() => props.patient.demographics?.full_name ?? props.patient.tb_patient.hn);
const _age = computed(() => props.patient.demographics?.age);

// Derives the "real" current phase from the date, not just the SQLite record.
// If the intensive phase end date has passed but the plan was never updated,
// we still show "Continuation" so staff see the correct clinical picture.
const effectivePhase = computed<'intensive' | 'continuation' | null>(() => {
  const plan = props.patient.current_plan;
  if (!plan) return null;
  if (plan.phase === 'intensive' && plan.phase_end_expected) {
    if (new Date() > new Date(plan.phase_end_expected)) return 'continuation';
  }
  return plan.phase as 'intensive' | 'continuation';
});

// True when the SQLite plan record hasn't been updated yet but the phase has
// effectively changed based on the expected end date.
const phaseIsStale = computed(
  () => !!props.patient.current_plan && effectivePhase.value !== props.patient.current_plan.phase,
);

const _phaseLabel = computed(() => {
  if (effectivePhase.value === 'intensive') return 'Intensive';
  if (effectivePhase.value === 'continuation') return 'Continuation';
  return '-';
});

const _phaseColor = computed(() => {
  if (effectivePhase.value === 'intensive') return '#dd5b00';
  if (effectivePhase.value === 'continuation') return '#2a9d99';
  return '#a39e98';
});

const _tbTypeLabel = computed(() => {
  const t = props.patient.tb_patient.tb_type;
  if (t === 'pulmonary') return 'ปอด';
  if (t === 'extra_pulmonary') return 'นอกปอด';
  return t ?? '-';
});

const _hasRedAlert = computed(() => props.patient.alerts.some((a) => a.severity === 'red'));
const _hasYellowAlert = computed(() => props.patient.alerts.some((a) => a.severity === 'yellow'));

const _sexSymbol = computed(() => {
  const s = props.patient.demographics?.sex;
  if (!s) return null;
  return s === 'M' || s === '1' ? '♂' : '♀';
});

const _isOverdue = computed(() => (props.patient.days_since_last_dispensing ?? 0) > 35);

// Returns drug letters to display.
// When the plan is stale (still says "intensive" but end date passed), derive
// the expected continuation drugs from the regimen string.
function _getDisplayDrugs(): string[] {
  const plan = props.patient.current_plan;
  if (!plan) return [];
  if (phaseIsStale.value) {
    return getContinuationDrugsFromRegimen(plan.regimen);
  }
  try {
    const drugs = JSON.parse(plan.drugs ?? '[]');
    return Array.isArray(drugs) ? drugs : [];
  } catch {
    return [];
  }
}

function _handleViewDetail() {
  emit('view-detail', props.patient.tb_patient.hn);
  router.push(`/patient/${props.patient.tb_patient.hn}`);
}

function _handleAddFollowup() {
  emit('add-followup', props.patient.tb_patient.hn);
}

function _handleDischarge() {
  emit('discharge', props.patient.tb_patient.hn);
}
</script>

<template>
  <div
    class="patient-card"
    :class="{
      'card-alert-red': hasRedAlert,
      'card-alert-yellow': hasYellowAlert && !hasRedAlert,
    }"
  >
    <!-- Header: HN + name + badges -->
    <div class="card-header">
      <div class="card-name-block">
        <div class="card-hn">{{ patient.tb_patient.hn }}</div>
        <div class="card-name">{{ name }}</div>
        <div class="card-meta">
          <span v-if="age !== null && age !== undefined">{{ age }} ปี</span>
          <span v-if="sexSymbol" class="sex-dot">{{ sexSymbol }}</span>
        </div>
      </div>
      <div class="card-badges">
        <span class="tb-type-badge">{{ tbTypeLabel }}</span>
        <span
          class="phase-badge"
          :style="{ background: phaseColor + '20', color: phaseColor }"
          :title="phaseIsStale ? 'ระยะนี้อ้างอิงจากวันที่ — แผนการรักษาในระบบยังไม่ได้อัปเดต' : undefined"
        >
          {{ phaseLabel }}
          <span v-if="phaseIsStale" class="phase-stale-dot" title="แผนยังไม่ได้อัปเดต">*</span>
        </span>
      </div>
    </div>

    <!-- Regimen + drug chips -->
    <div class="card-regimen">
      <span class="regimen-label">สูตรยา</span>
      <span class="regimen-value">{{ patient.current_plan?.regimen ?? '-' }}</span>
      <div class="drug-chips" v-if="getDisplayDrugs().length > 0">
        <DrugChip
          v-for="d in getDisplayDrugs()"
          :key="d"
          :drug="d"
          size="sm"
        />
      </div>
    </div>

    <!-- Treatment progress bar -->
    <div class="card-progress">
      <ProgressBar
        :current-month="patient.current_month"
        :total-months="patient.total_months"
        :phase="patient.current_plan?.phase ?? null"
      />
    </div>

    <!-- Days since last dispensing -->
    <div
      class="card-dispensing"
      v-if="patient.days_since_last_dispensing !== null && patient.days_since_last_dispensing !== undefined"
    >
      <span class="dispensing-label">รับยาล่าสุด</span>
      <span
        class="dispensing-days"
        :class="{ 'days-overdue': isOverdue }"
      >
        {{ patient.days_since_last_dispensing }} วันที่แล้ว
      </span>
    </div>

    <!-- Alert badges (up to 2) -->
    <div class="card-alerts" v-if="patient.alerts.length > 0">
      <AlertBadge
        v-for="alert in patient.alerts.slice(0, 2)"
        :key="alert.alert_type"
        :alert="alert"
      />
    </div>

    <!-- Action buttons -->
    <div class="card-actions">
      <button
        class="action-btn action-view"
        @click="handleViewDetail"
        :title="`ดูรายละเอียด ${patient.tb_patient.hn}`"
      >
        <Eye :size="13" />
        ดูรายละเอียด
      </button>
      <button
        class="action-btn action-followup"
        @click="handleAddFollowup"
        :title="`บันทึกการติดตามผล ${patient.tb_patient.hn}`"
      >
        <PlusCircle :size="13" />
        ติดตามผล
      </button>
      <button
        class="action-btn action-discharge"
        @click="handleDischarge"
        title="จำหน่ายผู้ป่วย"
      >
        <LogOut :size="13" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.patient-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow 0.2s;
}

.patient-card:hover {
  box-shadow:
    rgba(0, 0, 0, 0.08) 0px 6px 24px,
    rgba(0, 0, 0, 0.04) 0px 2px 8px;
}

.card-alert-red {
  border-left: 3px solid #dd5b00;
}

.card-alert-yellow {
  border-left: 3px solid #f5a623;
}

/* ── Header ── */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-name-block {
  flex: 1;
  min-width: 0;
}

.card-hn {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
  font-family: 'SF Mono', 'Roboto Mono', 'Fira Code', monospace;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  font-size: 12px;
  color: var(--color-text-muted);
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 3px;
}

.sex-dot {
  opacity: 0.65;
}

.card-badges {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  flex-shrink: 0;
}

.tb-type-badge {
  background: var(--color-bg-alt);
  color: var(--color-text-secondary);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-badge {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-stale-dot {
  font-size: 10px;
  font-weight: 800;
  opacity: 0.7;
  margin-left: 1px;
}

/* ── Regimen ── */
.card-regimen {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.regimen-label {
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.regimen-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.drug-chips {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

/* ── Last dispensing ── */
.card-dispensing {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dispensing-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.dispensing-days {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.days-overdue {
  color: var(--color-orange);
  font-weight: 600;
}

/* ── Alerts ── */
.card-alerts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* ── Actions ── */
.card-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-top: 4px;
  border-top: var(--border);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  border: var(--border);
  background: var(--color-bg);
  transition:
    background 0.15s,
    border-color 0.15s;
  white-space: nowrap;
}

.action-btn:focus-visible {
  outline: 2px solid var(--color-blue);
  outline-offset: 2px;
}

.action-view {
  flex: 1;
  color: var(--color-blue);
  border-color: rgba(0, 117, 222, 0.25);
}

.action-view:hover {
  background: var(--color-badge-bg);
}

.action-followup {
  flex: 1;
  color: var(--color-teal);
  border-color: rgba(42, 157, 153, 0.25);
}

.action-followup:hover {
  background: rgba(42, 157, 153, 0.06);
}

.action-discharge {
  color: var(--color-text-muted);
  padding: 5px 9px;
  flex-shrink: 0;
}

.action-discharge:hover {
  background: var(--color-bg-alt);
  color: var(--color-orange);
  border-color: rgba(221, 91, 0, 0.2);
}
</style>