<script setup lang="ts">
import { AlertTriangle, CheckCircle } from '@lucide/vue';
import { computed } from 'vue';
import DrugChip from '@/components/shared/DrugChip.vue';
import type { Followup, TreatmentPlan } from '@/types/treatment';

// -- Props --

const props = defineProps<{
  followups: Followup[];
  currentPlan: TreatmentPlan | null;
}>();

// -- Side effect definitions --

interface SideEffectDef {
  key: string;
  labelTh: string;
  labelEn: string;
  isPriority?: boolean;
}

interface DrugGroup {
  drug: string;
  effects: SideEffectDef[];
}

const DRUG_GROUPS: DrugGroup[] = [
  {
    drug: 'H',
    effects: [
      {
        key: 'ชาปลายมือเท้า',
        labelTh: 'ชาปลายมือเท้า',
        labelEn: 'Peripheral neuropathy',
      },
      {
        key: 'ตับอักเสบ',
        labelTh: 'ตับอักเสบ',
        labelEn: 'Hepatotoxicity',
      },
    ],
  },
  {
    drug: 'R',
    effects: [
      {
        key: 'ตับอักเสบ',
        labelTh: 'ตับอักเสบ',
        labelEn: 'Hepatotoxicity',
      },
      {
        key: 'ไข้หนาวสั่น',
        labelTh: 'ไข้หนาวสั่น',
        labelEn: 'Flu-like syndrome',
      },
      {
        key: 'เลือดออกผิดปกติ',
        labelTh: 'เลือดออกผิดปกติ',
        labelEn: 'Thrombocytopenia',
      },
    ],
  },
  {
    drug: 'E',
    effects: [
      {
        key: 'ตาพร่า/ตาบอดสี',
        labelTh: 'ตาพร่า / ตาบอดสี',
        labelEn: 'Optic neuritis (visual disturbance)',
        isPriority: true,
      },
    ],
  },
  {
    drug: 'Z',
    effects: [
      {
        key: 'ข้อเจ็บ/เก๊าท์',
        labelTh: 'ข้อเจ็บ / เก๊าท์',
        labelEn: 'Hyperuricemia (Gout)',
      },
      {
        key: 'ตับอักเสบ',
        labelTh: 'ตับอักเสบ',
        labelEn: 'Hepatotoxicity',
      },
    ],
  },
];

// -- Aggregate side-effect counts across all followups --

const sideEffectCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const f of props.followups) {
    if (!f.side_effects) continue;
    try {
      const effects = JSON.parse(f.side_effects) as string[];
      if (!Array.isArray(effects)) continue;
      for (const e of effects) {
        counts[e] = (counts[e] ?? 0) + 1;
      }
    } catch {
      // skip malformed JSON
    }
  }
  return counts;
});

function getCount(key: string): number {
  return sideEffectCounts.value[key] ?? 0;
}

/** Total unique side-effect occurrences across all followups */
const totalReported = computed(() =>
  Object.values(sideEffectCounts.value).reduce((a, b) => a + b, 0),
);

/** Distinct side-effect types reported (any count > 0) */
const distinctReported = computed(
  () => Object.values(sideEffectCounts.value).filter((c) => c > 0).length,
);

// -- E-related optic neuritis alert logic --

const hasOpticNeuritis = computed(() => getCount('ตาพร่า/ตาบอดสี') > 0);

/** True if E is present in the current treatment plan's drug list */
const isCurrentlyOnE = computed<boolean>(() => {
  if (!props.currentPlan) return false;
  try {
    const drugs = JSON.parse(props.currentPlan.drugs ?? '[]') as string[];
    return Array.isArray(drugs) && drugs.map((d) => d.toUpperCase()).includes('E');
  } catch {
    return false;
  }
});

const showEPriorityAlert = computed(() => hasOpticNeuritis.value && isCurrentlyOnE.value);

// -- Active drugs in current plan --

/** Set of uppercase drug letters in the current plan (for dimming inactive drugs) */
const activeDrugLetters = computed<Set<string>>(() => {
  if (!props.currentPlan) {
    // no plan info — show all drugs as potentially active
    return new Set(['H', 'R', 'Z', 'E']);
  }
  try {
    const drugs = JSON.parse(props.currentPlan.drugs ?? '[]') as string[];
    return new Set(drugs.map((d) => d.toUpperCase()));
  } catch {
    return new Set(['H', 'R', 'Z', 'E']);
  }
});

function isDrugActive(drug: string): boolean {
  return activeDrugLetters.value.has(drug.toUpperCase());
}

// -- Drug-specific color helper (for count badge tints) --

interface DrugColor {
  bg: string;
  text: string;
  border: string;
}

const DRUG_COLORS: Record<string, DrugColor> = {
  H: {
    bg: 'var(--drug-H-bg-tint)',
    text: 'var(--drug-H-text)',
    border: 'var(--drug-H-border-tint)',
  },
  R: {
    bg: 'var(--drug-R-bg-tint)',
    text: 'var(--drug-R-text)',
    border: 'var(--drug-R-border-tint)',
  },
  E: {
    bg: 'var(--drug-E-bg-tint)',
    text: 'var(--drug-E-text)',
    border: 'var(--drug-E-border-tint)',
  },
  Z: {
    bg: 'var(--drug-Z-bg-tint)',
    text: 'var(--drug-Z-text)',
    border: 'var(--drug-Z-border-tint)',
  },
};

function drugColor(drug: string): DrugColor {
  return (
    DRUG_COLORS[drug.toUpperCase()] ?? {
      bg: 'rgba(0,0,0,0.06)',
      text: 'var(--color-text-secondary)',
      border: 'rgba(0,0,0,0.12)',
    }
  );
}
</script>

<template>
  <div class="tracker-root">

    <!-- E optic neuritis priority alert -->
    <Transition name="alert-fade">
      <div v-if="showEPriorityAlert" class="priority-alert" role="alert" aria-live="assertive">
        <div class="priority-alert-icon-wrap">
          <AlertTriangle :size="18" />
        </div>
        <div class="priority-alert-body">
          <strong class="priority-alert-title">
            แจ้งเตือน: พบการรายงานตาพร่า / ตาบอดสี (Optic neuritis)
          </strong>
          <p class="priority-alert-desc">
            ผู้ป่วยรายงานอาการตาพร่าหรือตาบอดสี ซึ่งเป็นผลข้างเคียงสำคัญของยา
            <strong>Ethambutol (E)</strong>
            และขณะนี้ผู้ป่วยยังได้รับยานี้อยู่ในแผนการรักษาปัจจุบัน
            — ควรพิจารณาหยุดยาและนัดตรวจตาโดยเร็วที่สุด
          </p>
        </div>
      </div>
    </Transition>

    <!-- No followups empty state -->
    <div v-if="followups.length === 0" class="empty-state">
      <CheckCircle :size="36" class="empty-icon" aria-hidden="true" />
      <span class="empty-title">ยังไม่มีบันทึกการติดตามผล</span>
      <span class="empty-sub">ผลข้างเคียงจะปรากฏที่นี่เมื่อมีการบันทึกการติดตามผล</span>
    </div>

    <!-- Main content -->
    <template v-else>

      <!-- Summary bar -->
      <div class="summary-bar">
        <div class="summary-item">
          <span class="summary-value">{{ followups.length }}</span>
          <span class="summary-label">ครั้งที่ติดตามผล</span>
        </div>
        <span class="summary-sep" aria-hidden="true">·</span>
        <div class="summary-item">
          <span class="summary-value">{{ totalReported }}</span>
          <span class="summary-label">รายงานผลข้างเคียง (รวม)</span>
        </div>
        <span class="summary-sep" aria-hidden="true">·</span>
        <div class="summary-item">
          <span
            class="summary-value"
            :style="{ color: distinctReported > 0 ? 'var(--color-orange)' : 'var(--color-green)' }"
          >
            {{ distinctReported }}
          </span>
          <span class="summary-label">ประเภทผลข้างเคียง</span>
        </div>
        <span
          v-if="totalReported === 0"
          class="summary-ok"
          aria-label="ไม่พบผลข้างเคียง"
        >
          <CheckCircle :size="13" />
          ไม่พบผลข้างเคียง
        </span>
      </div>

      <!-- Drug group sections -->
      <div class="drug-groups">
        <section
          v-for="group in DRUG_GROUPS"
          :key="group.drug"
          class="drug-section"
          :class="{
            'drug-section-inactive': !isDrugActive(group.drug),
            'drug-section-has-reports': group.effects.some((e) => getCount(e.key) > 0),
          }"
          :style="{
            '--drug-accent-bg': drugColor(group.drug).bg,
            '--drug-accent-text': drugColor(group.drug).text,
            '--drug-accent-border': drugColor(group.drug).border,
          }"
          :aria-label="`ผลข้างเคียงของยา ${group.drug}`"
        >
          <!-- Section header -->
          <div class="section-header">
            <DrugChip :drug="group.drug" size="md" />
            <span
              v-if="!isDrugActive(group.drug)"
              class="inactive-badge"
            >
              ไม่อยู่ในแผนปัจจุบัน
            </span>
            <span
              v-if="group.effects.some((e) => getCount(e.key) > 0)"
              class="has-reports-badge"
            >
              มีรายงาน
            </span>
          </div>

          <!-- Effect rows -->
          <ul class="effect-list" role="list">
            <li
              v-for="effect in group.effects"
              :key="`${group.drug}-${effect.key}`"
              class="effect-row"
              :class="{
                'effect-row-reported': getCount(effect.key) > 0,
                'effect-row-priority': effect.isPriority && getCount(effect.key) > 0,
              }"
            >
              <!-- Left: label -->
              <div class="effect-info">
                <!-- Priority icon -->
                <span
                  v-if="effect.isPriority"
                  class="priority-icon"
                  :class="{ 'priority-icon-active': getCount(effect.key) > 0 }"
                  aria-hidden="true"
                  title="ผลข้างเคียงสำคัญ"
                >
                  ⚠️
                </span>

                <div class="effect-labels">
                  <span class="effect-label-th">{{ effect.labelTh }}</span>
                  <span class="effect-label-en">{{ effect.labelEn }}</span>
                </div>

                <span
                  v-if="effect.isPriority"
                  class="priority-tag"
                  :class="{ 'priority-tag-active': getCount(effect.key) > 0 }"
                >
                  สำคัญมาก
                </span>
              </div>

              <!-- Right: count badge -->
              <div class="effect-count-wrap">
                <!-- Reported: show count -->
                <span
                  v-if="getCount(effect.key) > 0"
                  class="count-badge"
                  :class="{ 'count-badge-priority': effect.isPriority }"
                  :style="{
                    background: effect.isPriority
                      ? 'var(--priority-bg)'
                      : drugColor(group.drug).bg,
                    color: effect.isPriority
                      ? 'var(--priority-text)'
                      : drugColor(group.drug).text,
                    outlineColor: effect.isPriority
                      ? 'var(--priority-border)'
                      : drugColor(group.drug).border,
                  }"
                  :aria-label="`รายงาน ${getCount(effect.key)} ครั้ง`"
                >
                  {{ getCount(effect.key) }}
                  <span class="count-unit">ครั้ง</span>
                </span>

                <!-- Not reported: dash -->
                <span v-else class="count-none" aria-label="ไม่มีรายงาน">—</span>
              </div>
            </li>
          </ul>
        </section>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* -- Root -- */
.tracker-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.priority-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-6);
  background: var(--tint-orange);
  border: 1px solid var(--warning-border-28);
  border-radius: var(--radius-md);
  padding: var(--space-7) var(--space-8);
}

.priority-alert-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--warning-bg-14);
  color: var(--color-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.priority-alert-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.priority-alert-title {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  color: var(--color-warning);
  line-height: var(--leading-snug);
}

.priority-alert-desc {
  font-size: var(--text-sm);
  color: var(--palette-orange-dark);
  line-height: 1.55;
  margin: 0;
}

.priority-alert-desc strong {
  font-weight: var(--weight-heading);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--empty-padding-sm);
  text-align: center;
  background: var(--color-surface-alt);
  border-radius: var(--radius-md);
}

.empty-icon {
  color: var(--color-info);
  opacity: 0.25;
  margin-bottom: var(--space-2);
}

.empty-title {
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
}

.empty-sub {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
  max-width: 320px;
  line-height: var(--leading-body);
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  padding: var(--space-5) var(--space-7);
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.summary-value {
  font-size: var(--text-ui);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.summary-sep {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
  line-height: 1;
}

.summary-ok {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-success);
  background: var(--status-active-bg);
  border-radius: var(--radius-pill);
  padding: 3px 9px;
}

.drug-groups {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.drug-section {
  border: var(--border-standard);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--duration-slow) var(--ease-standard);
}

.drug-section-has-reports {
  border-color: var(--drug-accent-border);
}

.drug-section-inactive {
  opacity: 0.5;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-7);
  background: var(--color-surface-alt);
  border-bottom: var(--border-standard);
}

.inactive-badge {
  font-size: var(--text-caption);
  font-weight: var(--weight-ui);
  color: var(--color-text-muted);
  background: var(--btn-secondary-bg);
  border-radius: var(--radius-pill);
  padding: var(--space-1) 7px;
}

.has-reports-badge {
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  color: var(--color-warning);
  background: var(--status-defaulted-bg);
  border-radius: var(--radius-pill);
  padding: var(--space-1) 7px;
}

.effect-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.effect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-5) var(--space-7);
  border-bottom: var(--border-standard);
  transition: background var(--duration-fast) var(--ease-standard);
}

.effect-row:last-child {
  border-bottom: none;
}

.effect-row:hover {
  background: rgba(0, 0, 0, 0.015);
}

.effect-row-reported {
  background: color-mix(in srgb, var(--drug-accent-bg) 50%, transparent);
}

.effect-row-priority {
  background: var(--tint-orange);
  outline: 1px solid var(--priority-outline);
  outline-offset: -1px;
}

.effect-info {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.priority-icon {
  font-size: var(--text-body);
  opacity: 0.3;
  flex-shrink: 0;
  transition: opacity var(--duration-base) var(--ease-standard);
}

.priority-icon-active {
  opacity: 1;
}

.effect-labels {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.effect-label-th {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-ui);
  color: var(--color-text);
  line-height: var(--leading-snug);
}

.effect-label-en {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  line-height: var(--leading-snug);
}

.priority-tag {
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-emphasis);
  padding: var(--space-1) 7px;
  border-radius: var(--radius-pill);
  background: var(--btn-secondary-bg);
  color: var(--color-text-muted);
  transition: var(--transition-icon-btn);
}

.priority-tag-active {
  background: var(--priority-bg);
  color: var(--priority-text);
}

.effect-count-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.count-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: var(--badge-padding);
  border-radius: var(--radius-pill);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  outline: 1px solid transparent;
  font-variant-numeric: tabular-nums;
  transition: transform var(--duration-base) var(--ease-standard);
}

.count-badge:hover {
  transform: scale(1.06);
}

.count-badge-priority {
  outline-style: solid;
}

.count-unit {
  font-size: var(--text-xs);
  font-weight: var(--weight-ui);
  opacity: 0.75;
}

.count-none {
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
  padding: 3px 8px;
  opacity: 0.5;
}

.alert-fade-enter-active {
  transition: opacity 0.25s var(--ease-standard), transform 0.25s var(--ease-standard);
}

.alert-fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-standard), transform var(--duration-slow) var(--ease-standard);
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>