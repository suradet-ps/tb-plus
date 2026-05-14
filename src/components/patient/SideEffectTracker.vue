<script setup lang="ts">
import { computed } from 'vue';
import type { Followup, TreatmentPlan } from '@/types/treatment';

// ── Props ─────────────────────────────────────────────────────────────────

const props = defineProps<{
  followups: Followup[];
  currentPlan: TreatmentPlan | null;
}>();

// ── Side effect definitions ───────────────────────────────────────────────

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

const _DRUG_GROUPS: DrugGroup[] = [
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

// ── Aggregate side-effect counts across all followups ─────────────────────

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
const _totalReported = computed(() =>
  Object.values(sideEffectCounts.value).reduce((a, b) => a + b, 0),
);

/** Distinct side-effect types reported (any count > 0) */
const _distinctReported = computed(
  () => Object.values(sideEffectCounts.value).filter((c) => c > 0).length,
);

// ── E-related optic neuritis alert logic ──────────────────────────────────

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

const _showEPriorityAlert = computed(() => hasOpticNeuritis.value && isCurrentlyOnE.value);

// ── Active drugs in current plan ──────────────────────────────────────────

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

function _isDrugActive(drug: string): boolean {
  return activeDrugLetters.value.has(drug.toUpperCase());
}

// ── Drug-specific color helper (for count badge tints) ───────────────────

interface DrugColor {
  bg: string;
  text: string;
  border: string;
}

const DRUG_COLORS: Record<string, DrugColor> = {
  H: { bg: 'rgba(42,157,153,0.12)', text: '#2a9d99', border: 'rgba(42,157,153,0.3)' },
  R: { bg: 'rgba(221,91,0,0.12)', text: '#dd5b00', border: 'rgba(221,91,0,0.3)' },
  E: { bg: 'rgba(0,117,222,0.12)', text: '#0075de', border: 'rgba(0,117,222,0.3)' },
  Z: { bg: 'rgba(82,52,16,0.10)', text: '#523410', border: 'rgba(82,52,16,0.25)' },
};

function _drugColor(drug: string): DrugColor {
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

    <!-- ── E optic neuritis priority alert ────────────────────────── -->
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

    <!-- ── No followups empty state ───────────────────────────────── -->
    <div v-if="followups.length === 0" class="empty-state">
      <CheckCircle :size="36" class="empty-icon" aria-hidden="true" />
      <span class="empty-title">ยังไม่มีบันทึกการติดตามผล</span>
      <span class="empty-sub">ผลข้างเคียงจะปรากฏที่นี่เมื่อมีการบันทึกการติดตามผล</span>
    </div>

    <!-- ── Main content ────────────────────────────────────────────── -->
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
                      ? 'rgba(221,91,0,0.15)'
                      : drugColor(group.drug).bg,
                    color: effect.isPriority
                      ? '#dd5b00'
                      : drugColor(group.drug).text,
                    outlineColor: effect.isPriority
                      ? 'rgba(221,91,0,0.35)'
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
/* ── Root ──────────────────────────────────────────────────────────── */
.tracker-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Priority alert (E + optic neuritis) ───────────────────────────── */
.priority-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(221, 91, 0, 0.07);
  border: 1px solid rgba(221, 91, 0, 0.28);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.priority-alert-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: rgba(221, 91, 0, 0.14);
  color: var(--color-orange);
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
  font-size: 13px;
  font-weight: 700;
  color: var(--color-orange);
  line-height: 1.3;
}

.priority-alert-desc {
  font-size: 12px;
  color: #b84a00;
  line-height: 1.55;
  margin: 0;
}

.priority-alert-desc strong {
  font-weight: 700;
}

/* ── Empty state ────────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
  background: var(--color-bg-alt);
  border-radius: var(--radius-md);
}

.empty-icon {
  color: var(--color-teal);
  opacity: 0.25;
  margin-bottom: 4px;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.empty-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 320px;
  line-height: 1.5;
}

/* ── Summary bar ────────────────────────────────────────────────────── */
.summary-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.summary-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.summary-sep {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1;
}

.summary-ok {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-green);
  background: rgba(26, 174, 57, 0.09);
  border-radius: var(--radius-pill);
  padding: 3px 9px;
}

/* ── Drug groups container ──────────────────────────────────────────── */
.drug-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Drug section card ──────────────────────────────────────────────── */
.drug-section {
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color 0.2s;
}

/* Highlight card border when this drug has any reported effects */
.drug-section-has-reports {
  border-color: var(--drug-accent-border);
}

/* Dim sections for drugs not in current plan */
.drug-section-inactive {
  opacity: 0.5;
}

/* ── Section header ─────────────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-bg-alt);
  border-bottom: var(--border);
}

.inactive-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.05);
  border-radius: var(--radius-pill);
  padding: 2px 7px;
}

.has-reports-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-orange);
  background: rgba(221, 91, 0, 0.1);
  border-radius: var(--radius-pill);
  padding: 2px 7px;
}

/* ── Effect list ────────────────────────────────────────────────────── */
.effect-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* ── Effect row ─────────────────────────────────────────────────────── */
.effect-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: var(--border);
  transition: background 0.12s;
}

.effect-row:last-child {
  border-bottom: none;
}

.effect-row:hover {
  background: rgba(0, 0, 0, 0.015);
}

/* Reported rows get a subtle tinted background using the drug color */
.effect-row-reported {
  background: color-mix(in srgb, var(--drug-accent-bg) 50%, transparent);
}

/* Priority effect (optic neuritis) when reported */
.effect-row-priority {
  background: rgba(221, 91, 0, 0.05);
  outline: 1px solid rgba(221, 91, 0, 0.15);
  outline-offset: -1px;
}

/* ── Effect info (left side) ────────────────────────────────────────── */
.effect-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.priority-icon {
  font-size: 14px;
  opacity: 0.3;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.priority-icon-active {
  opacity: 1;
}

.effect-labels {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.effect-label-th {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.3;
}

.effect-label-en {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.3;
}

.priority-tag {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-muted);
  transition: background 0.15s, color 0.15s;
}

.priority-tag-active {
  background: rgba(221, 91, 0, 0.12);
  color: #dd5b00;
}

/* ── Effect count (right side) ──────────────────────────────────────── */
.effect-count-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.count-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 700;
  outline: 1px solid transparent;
  font-variant-numeric: tabular-nums;
  transition: transform 0.15s;
}

.count-badge:hover {
  transform: scale(1.06);
}

.count-badge-priority {
  outline-style: solid;
}

.count-unit {
  font-size: 10px;
  font-weight: 500;
  opacity: 0.75;
}

.count-none {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 3px 8px;
  opacity: 0.5;
}

/* ── Alert fade transition ──────────────────────────────────────────── */
.alert-fade-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.alert-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.alert-fade-enter-from,
.alert-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>