<script setup lang="ts">
import { Eye, LogOut, PlusCircle } from '@lucide/vue';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import DrugChip from '@/components/shared/DrugChip.vue';
import type { ActivePatientRow } from '@/types/patient';
import AlertBadge from './AlertBadge.vue';
import ProgressBar from './ProgressBar.vue';

function getContinuationDrugsFromRegimen(regimen: string): string[] {
  const parts = regimen.split('/');
  if (parts.length < 2) return ['H', 'R'];
  const contPart = parts[1].replace(/^\d+/, '');
  return (['H', 'R', 'Z', 'E'] as const).filter((d) => contPart.toUpperCase().includes(d));
}

const props = defineProps<{ patient: ActivePatientRow }>();
const emit = defineEmits<{
  'view-detail': [hn: string];
  'add-followup': [hn: string];
  discharge: [hn: string];
}>();

const router = useRouter();

const name = computed(() => props.patient.demographics?.full_name ?? props.patient.tb_patient.hn);
const age = computed(() => props.patient.demographics?.age);

const effectivePhase = computed<'intensive' | 'continuation' | null>(() => {
  const plan = props.patient.current_plan;
  if (!plan) return null;
  if (plan.phase === 'intensive' && plan.phase_end_expected) {
    if (new Date() > new Date(plan.phase_end_expected)) return 'continuation';
  }
  return plan.phase as 'intensive' | 'continuation';
});

const phaseIsStale = computed(
  () => !!props.patient.current_plan && effectivePhase.value !== props.patient.current_plan.phase,
);

const phaseLabel = computed(() => {
  if (effectivePhase.value === 'intensive') return 'Intensive';
  if (effectivePhase.value === 'continuation') return 'Continuation';
  return '-';
});

const phaseColor = computed(() => {
  if (effectivePhase.value === 'intensive') return 'var(--color-phase-intensive)';
  if (effectivePhase.value === 'continuation') return 'var(--color-phase-continuation)';
  return 'var(--color-text-muted)';
});

const tbTypeLabel = computed(() => {
  const t = props.patient.tb_patient.tb_type;
  if (t === 'pulmonary') return 'ปอด';
  if (t === 'extra_pulmonary') return 'นอกปอด';
  return t ?? '-';
});

const hasRedAlert = computed(() => props.patient.alerts.some((a) => a.severity === 'red'));
const hasYellowAlert = computed(() => props.patient.alerts.some((a) => a.severity === 'yellow'));

const sexSymbol = computed(() => {
  const s = props.patient.demographics?.sex;
  if (!s) return null;
  return s === 'M' || s === '1' ? '♂' : '♀';
});

const isOverdue = computed(() => (props.patient.days_since_last_dispensing ?? 0) > 35);

function getDisplayDrugs(): string[] {
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

function handleViewDetail() {
  emit('view-detail', props.patient.tb_patient.hn);
  router.push(`/patient/${props.patient.tb_patient.hn}`);
}

function handleAddFollowup() {
  emit('add-followup', props.patient.tb_patient.hn);
}

function handleDischarge() {
  emit('discharge', props.patient.tb_patient.hn);
}
</script>

<template>
  <div
    class="patient-card"
    :class="{
      'patient-card--red': hasRedAlert,
      'patient-card--yellow': hasYellowAlert && !hasRedAlert,
    }"
  >
    <div class="patient-card__header">
      <div class="patient-card__name-block">
        <div class="patient-card__hn">{{ patient.tb_patient.hn }}</div>
        <div class="patient-card__name">{{ name }}</div>
        <div class="patient-card__meta">
          <span v-if="age !== null && age !== undefined">{{ age }} ปี</span>
          <span v-if="sexSymbol" class="patient-card__sex">{{ sexSymbol }}</span>
        </div>
      </div>
      <div class="patient-card__badges">
        <span class="patient-card__type-badge">{{ tbTypeLabel }}</span>
        <span
          class="patient-card__phase-badge"
          :style="{ background: phaseColor + '20', color: phaseColor }"
          :title="phaseIsStale ? 'ระยะนี้อ้างอิงจากวันที่ — แผนการรักษาในระบบยังไม่ได้อัปเดต' : undefined"
        >
          {{ phaseLabel }}
          <span v-if="phaseIsStale" class="patient-card__phase-stale" title="แผนยังไม่ได้อัปเดต">*</span>
        </span>
      </div>
    </div>

    <div class="patient-card__regimen">
      <span class="patient-card__regimen-label">สูตรยา</span>
      <span class="patient-card__regimen-value">{{ patient.current_plan?.regimen ?? '-' }}</span>
      <div class="patient-card__chips" v-if="getDisplayDrugs().length > 0">
        <DrugChip
          v-for="d in getDisplayDrugs()"
          :key="d"
          :drug="d"
          size="sm"
        />
      </div>
    </div>

    <div class="patient-card__progress">
      <ProgressBar
        :current-month="patient.current_month"
        :total-months="patient.total_months"
        :phase="patient.current_plan?.phase ?? null"
      />
    </div>

    <div
      class="patient-card__dispensing"
      v-if="patient.days_since_last_dispensing !== null && patient.days_since_last_dispensing !== undefined"
    >
      <span class="patient-card__dispensing-label">รับยาล่าสุด</span>
      <span
        class="patient-card__dispensing-days"
        :class="{ 'patient-card__dispensing-days--overdue': isOverdue }"
      >
        {{ patient.days_since_last_dispensing }} วันที่แล้ว
      </span>
    </div>

    <div class="patient-card__alerts" v-if="patient.alerts.length > 0">
      <AlertBadge
        v-for="alert in patient.alerts.slice(0, 2)"
        :key="alert.alert_type"
        :alert="alert"
      />
    </div>

    <div class="patient-card__actions">
      <button
        class="patient-card__action patient-card__action--view"
        @click="handleViewDetail"
        :title="`ดูรายละเอียด ${patient.tb_patient.hn}`"
      >
        <Eye :size="13" />
        ดูรายละเอียด
      </button>
      <button
        class="patient-card__action patient-card__action--followup"
        @click="handleAddFollowup"
        :title="`บันทึกการติดตามผล ${patient.tb_patient.hn}`"
      >
        <PlusCircle :size="13" />
        ติดตามผล
      </button>
      <button
        class="patient-card__action patient-card__action--discharge"
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
  background: var(--card-bg);
  border: var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: var(--card-padding);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  transition: var(--transition-card-hover);
}

.patient-card:hover {
  box-shadow: var(--shadow-card-hover);
}

.patient-card--red {
  border-left: 3px solid var(--color-phase-intensive);
}

.patient-card--yellow {
  border-left: 3px solid var(--palette-amber);
}

.patient-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.patient-card__name-block {
  flex: 1;
  min-width: 0;
}

.patient-card__hn {
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-muted);
  letter-spacing: var(--tracking-hn);
  font-family: var(--font-family-mono);
}

.patient-card__name {
  font-size: var(--text-ui);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  line-height: var(--leading-snug);
  margin-top: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patient-card__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: 3px;
}

.patient-card__sex {
  opacity: 0.65;
}

.patient-card__badges {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-end;
  flex-shrink: 0;
}

.patient-card__type-badge {
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  padding: var(--badge-padding-sm);
  border-radius: var(--badge-radius);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.patient-card__phase-badge {
  padding: var(--badge-padding-sm);
  border-radius: var(--badge-radius);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.patient-card__phase-stale {
  font-size: var(--text-xs);
  font-weight: var(--weight-heavy);
  opacity: 0.7;
  margin-left: 1px;
}

.patient-card__regimen {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.patient-card__regimen-label {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.patient-card__regimen-value {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
}

.patient-card__chips {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.patient-card__dispensing {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.patient-card__dispensing-label {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.patient-card__dispensing-days {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-ui);
  color: var(--color-text-secondary);
}

.patient-card__dispensing-days--overdue {
  color: var(--color-warning);
  font-weight: var(--weight-emphasis);
}

.patient-card__alerts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.patient-card__actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding-top: var(--space-2);
  border-top: var(--border-standard);
}

.patient-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--btn-padding-sm);
  font-size: var(--btn-font-size-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  border-radius: var(--btn-radius);
  border: var(--border-standard);
  background: var(--color-surface);
  transition: var(--transition-icon-btn), border-color var(--duration-base) var(--ease-standard);
  white-space: nowrap;
}

.patient-card__action:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.patient-card__action--view {
  flex: 1;
  color: var(--color-accent);
  border-color: var(--border-color-focus);
}

.patient-card__action--view:hover {
  background: var(--color-badge-bg);
}

.patient-card__action--followup {
  flex: 1;
  color: var(--color-info);
  border-color: var(--border-color-teal);
}

.patient-card__action--followup:hover {
  background: var(--tint-teal);
}

.patient-card__action--discharge {
  color: var(--color-text-muted);
  padding: 5px 9px;
  flex-shrink: 0;
}

.patient-card__action--discharge:hover {
  background: var(--color-surface-alt);
  color: var(--color-warning);
  border-color: rgba(221, 91, 0, 0.2);
}
</style>
