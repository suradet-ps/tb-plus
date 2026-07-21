<script setup lang="ts">
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Microscope,
  Pill,
  Scan,
  StickyNote,
  User,
} from '@lucide/vue';
import { computed, ref } from 'vue';
import type { Followup } from '@/types/treatment';

const props = defineProps<{
  followups: Followup[];
}>();

// -- Sort order toggle --

const newestFirst = ref(true);

const sortedFollowups = computed<Followup[]>(() => {
  const list = [...props.followups].sort((a, b) => a.followup_date.localeCompare(b.followup_date));
  return newestFirst.value ? list.reverse() : list;
});

// -- Expandable items --

const expandedIds = ref<Set<number>>(new Set());

function toggleExpanded(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function isExpanded(id: number): boolean {
  return expandedIds.value.has(id);
}

// -- Date helpers --

function toThaiDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
  } catch {
    return iso;
  }
}

function toThaiDateLong(iso: string): string {
  const MONTH_TH = [
    '',
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
  ];
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTH_TH[m]} ${y + 543}`;
  } catch {
    return iso;
  }
}

// -- Sputum helpers --

type SputumResult = 'negative' | 'positive' | 'not_done' | null;

interface BadgeConfig {
  label: string;
  bg: string;
  color: string;
}

function sputumConfig(v: SputumResult): BadgeConfig {
  switch (v) {
    case 'negative':
      return { label: 'ผลลบ', bg: 'var(--result-negative-bg)', color: 'var(--result-negative-text)' };
    case 'positive':
      return { label: 'ผลบวก', bg: 'var(--result-positive-bg)', color: 'var(--result-positive-text)' };
    case 'not_done':
      return { label: 'ไม่ได้ตรวจ', bg: 'var(--result-not-done-bg)', color: 'var(--result-not-done-text)' };
    default:
      return { label: '-', bg: 'var(--result-na-bg)', color: 'var(--result-na-text)' };
  }
}

// -- X-ray helpers --

type XrayResult = 'improved' | 'stable' | 'worse' | 'not_done' | null;

function xrayConfig(v: XrayResult): BadgeConfig {
  switch (v) {
    case 'improved':
      return { label: 'ดีขึ้น', bg: 'var(--result-improved-bg)', color: 'var(--result-improved-text)' };
    case 'stable':
      return { label: 'คงที่', bg: 'var(--result-stable-bg)', color: 'var(--result-stable-text)' };
    case 'worse':
      return { label: 'แย่ลง', bg: 'var(--result-worse-bg)', color: 'var(--result-worse-text)' };
    case 'not_done':
      return { label: 'ไม่ได้ตรวจ', bg: 'var(--result-not-done-bg)', color: 'var(--result-not-done-text)' };
    default:
      return { label: '-', bg: 'var(--result-na-bg)', color: 'var(--result-na-text)' };
  }
}

// -- Adherence helpers --

type Adherence = 'good' | 'fair' | 'poor' | null;

function adherenceConfig(v: Adherence): BadgeConfig {
  switch (v) {
    case 'good':
      return { label: 'การรับยา: ดี', bg: 'var(--result-negative-bg)', color: 'var(--result-negative-text)' };
    case 'fair':
      return { label: 'การรับยา: พอใช้', bg: 'var(--result-fair-bg)', color: 'var(--result-fair-text)' };
    case 'poor':
      return { label: 'การรับยา: ไม่ดี', bg: 'var(--result-worse-bg)', color: 'var(--result-worse-text)' };
    default:
      return { label: 'การรับยา: -', bg: 'var(--result-na-bg)', color: 'var(--result-na-text)' };
  }
}

// -- Side effects --

function parseSideEffects(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function isOpticNeuritis(se: string): boolean {
  return se.toLowerCase().includes('ตาพร่า') || se.toLowerCase().includes('ตาบอด');
}

// -- Dispensed drugs --

function parseDispensedDrugs(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

// -- Summary line --

function hasMeaningfulData(f: Followup): boolean {
  return !!(
    f.sputum_result ||
    f.xray_result ||
    f.adherence ||
    parseSideEffects(f.side_effects).length > 0 ||
    f.notes
  );
}
</script>

<template>
  <div class="followup-list">

    <!-- Header bar -->
    <div class="list-header">
      <span class="list-count">
        {{ followups.length }} บันทึก
      </span>
      <button
        v-if="followups.length > 1"
        class="sort-toggle"
        @click="newestFirst = !newestFirst"
        :title="newestFirst ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน'"
      >
        <ChevronDown v-if="newestFirst" :size="14" />
        <ChevronUp   v-else             :size="14" />
        {{ newestFirst ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน' }}
      </button>
    </div>

    <!-- Empty state -->
    <div v-if="followups.length === 0" class="empty-state" role="status">
      <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" width="40" height="40"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
        <line x1="8"  y1="14" x2="8"  y2="14"/>
        <line x1="12" y1="14" x2="12" y2="14"/>
        <line x1="16" y1="14" x2="16" y2="14"/>
      </svg>
      <span class="empty-title">ยังไม่มีบันทึกการติดตามผล</span>
      <span class="empty-sub">กดปุ่ม "เพิ่มบันทึก" เพื่อบันทึกการติดตามผลครั้งแรก</span>
    </div>

    <!-- Follow-up item cards -->
    <TransitionGroup name="fup-list" tag="div" class="list-items">
      <div
        v-for="f in sortedFollowups"
        :key="f.id"
        class="fup-card"
        :class="{
          'fup-card-alert': parseSideEffects(f.side_effects).some(isOpticNeuritis),
        }"
      >
        <!-- Card header -->
        <div
          class="fup-header"
          @click="hasMeaningfulData(f) ? toggleExpanded(f.id) : undefined"
          :style="hasMeaningfulData(f) ? 'cursor: pointer' : ''"
          :role="hasMeaningfulData(f) ? 'button' : undefined"
          :aria-expanded="hasMeaningfulData(f) ? isExpanded(f.id) : undefined"
        >
          <!-- Left: date + month badge -->
          <div class="fup-header-left">
            <div class="fup-date-row">
              <span class="fup-date">{{ toThaiDateLong(f.followup_date) }}</span>
              <span v-if="f.month_number != null" class="month-badge">
                เดือนที่ {{ f.month_number }}
              </span>
            </div>
            <!-- Weight inline with muted style -->
            <div class="fup-meta-row">
              <span v-if="f.weight_kg != null" class="weight-tag">
                ⚖ {{ f.weight_kg }} กก.
              </span>
              <span v-if="f.created_by" class="created-by-inline">
                <User :size="10" class="created-icon" />
                {{ f.created_by }}
              </span>
            </div>
          </div>

          <!-- Right: status chips summary -->
          <div class="fup-header-right">
            <!-- Sputum chip -->
            <span
              v-if="f.sputum_result"
              class="status-chip"
              :style="{ background: sputumConfig(f.sputum_result as any).bg, color: sputumConfig(f.sputum_result as any).color }"
            >
              <Microscope :size="10" />
              {{ sputumConfig(f.sputum_result as any).label }}
            </span>

            <!-- Adherence chip -->
            <span
              v-if="f.adherence"
              class="status-chip"
              :style="{ background: adherenceConfig(f.adherence as any).bg, color: adherenceConfig(f.adherence as any).color }"
            >
              <Pill :size="10" />
              {{ adherenceConfig(f.adherence as any).label.replace('การรับยา: ', '') }}
            </span>

            <!-- Side-effects count chip -->
            <span
              v-if="parseSideEffects(f.side_effects).length > 0"
              class="status-chip chip-se"
            >
              {{ parseSideEffects(f.side_effects).length }} ผลข้างเคียง
            </span>

            <!-- Expand chevron -->
            <ChevronDown
              v-if="hasMeaningfulData(f)"
              :size="14"
              class="expand-icon"
              :class="{ 'expand-icon-open': isExpanded(f.id) }"
            />
          </div>
        </div>

        <!-- Expanded detail -->
        <Transition name="expand">
          <div v-if="isExpanded(f.id)" class="fup-body">

            <!-- Results row -->
            <div class="results-row">
              <!-- Sputum -->
              <div class="result-block">
                <div class="result-label">
                  <Microscope :size="12" class="result-icon" />
                  ผลเสมหะ
                </div>
                <span
                  class="result-badge"
                  :style="{
                    background: sputumConfig(f.sputum_result as any).bg,
                    color: sputumConfig(f.sputum_result as any).color,
                  }"
                >
                  {{ sputumConfig(f.sputum_result as any).label }}
                </span>
              </div>

              <!-- X-ray -->
              <div class="result-block">
                <div class="result-label">
                  <Scan :size="12" class="result-icon" />
                  ผล X-Ray
                </div>
                <span
                  class="result-badge"
                  :style="{
                    background: xrayConfig(f.xray_result as any).bg,
                    color: xrayConfig(f.xray_result as any).color,
                  }"
                >
                  {{ xrayConfig(f.xray_result as any).label }}
                </span>
              </div>

              <!-- Adherence -->
              <div class="result-block">
                <div class="result-label">
                  <Activity :size="12" class="result-icon" />
                  การรับยา
                </div>
                <span
                  class="result-badge"
                  :style="{
                    background: adherenceConfig(f.adherence as any).bg,
                    color: adherenceConfig(f.adherence as any).color,
                  }"
                >
                  {{ adherenceConfig(f.adherence as any).label.replace('การรับยา: ', '') }}
                </span>
              </div>
            </div>

            <!-- Side effects -->
            <div v-if="parseSideEffects(f.side_effects).length > 0" class="side-effects-row">
              <span class="se-heading">ผลข้างเคียง:</span>
              <div class="se-tags">
                <span
                  v-for="se in parseSideEffects(f.side_effects)"
                  :key="se"
                  class="se-tag"
                  :class="{ 'se-tag-priority': isOpticNeuritis(se) }"
                >
                  {{ se }}
                  <span v-if="isOpticNeuritis(se)" class="se-priority-marker" aria-label="สำคัญมาก">⚠️</span>
                </span>
              </div>
            </div>

            <!-- Dispensed drugs snapshot -->
            <div v-if="parseDispensedDrugs(f.dispensed_drugs).length > 0" class="dispensed-row">
              <span class="dispensed-heading">
                <Pill :size="12" />
                ยาที่รับครั้งนี้:
              </span>
              <div class="dispensed-tags">
                <span
                  v-for="drug in parseDispensedDrugs(f.dispensed_drugs)"
                  :key="drug"
                  class="dispensed-tag"
                >
                  {{ drug }}
                </span>
              </div>
            </div>

            <!-- Notes -->
            <div v-if="f.notes" class="notes-row">
              <StickyNote :size="12" class="notes-icon" />
              <p class="notes-text">{{ f.notes }}</p>
            </div>

            <!-- Footer: created info -->
            <div class="fup-footer">
              <span v-if="f.created_by" class="footer-by">
                <User :size="11" />
                บันทึกโดย {{ f.created_by }}
              </span>
              <span class="footer-date">
                ID #{{ f.id }} · {{ toThaiDate(f.created_at?.slice(0, 10) ?? f.followup_date) }}
              </span>
            </div>

          </div>
        </Transition>
      </div>
    </TransitionGroup>

  </div>
</template>

<style scoped>
/* -- Root -- */
.followup-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.list-count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: var(--weight-ui);
}

.sort-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: var(--border-standard);
  border-radius: var(--radius-pill);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: var(--transition-icon-btn);
}

.sort-toggle:hover {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--empty-padding-sm);
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.2;
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
  max-width: 300px;
  line-height: var(--leading-body);
}

.list-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.fup-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow var(--duration-base) var(--ease-standard);
}

.fup-card:hover {
  box-shadow: var(--shadow-card-hover-sm);
}

.fup-card-alert {
  border-left: 3px solid var(--color-warning);
}

.fup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-8);
  user-select: none;
}

.fup-header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.fup-date-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.fup-date {
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  letter-spacing: -0.1px;
}

.month-badge {
  padding: var(--badge-padding-sm);
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
  flex-shrink: 0;
}

.fup-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.weight-tag {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.created-by-inline {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.created-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.fup-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.chip-se {
  background: var(--status-defaulted-bg);
  color: var(--status-defaulted-text);
}

.expand-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--duration-slow) var(--ease-standard);
}

.expand-icon-open {
  transform: rotate(180deg);
}

.fup-body {
  padding: 0 var(--space-8) var(--space-7);
  border-top: var(--border-standard);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-top: var(--space-6);
}

.results-row {
  display: flex;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.result-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 80px;
}

.result-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.result-icon {
  flex-shrink: 0;
}

.result-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--badge-padding);
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.side-effects-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.se-heading {
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-muted);
  white-space: nowrap;
  margin-top: 3px;
  flex-shrink: 0;
}

.se-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.se-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 9px;
  background: var(--tint-orange);
  color: var(--palette-orange-dark);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
}

.se-tag-priority {
  background: var(--priority-bg);
  color: var(--priority-text);
  outline: 1px solid var(--priority-border);
}

.se-priority-marker {
  font-size: var(--text-xs);
}

.dispensed-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.dispensed-heading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-muted);
  white-space: nowrap;
  margin-top: 3px;
  flex-shrink: 0;
}

.dispensed-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.dispensed-tag {
  padding: var(--badge-padding-sm);
  background: var(--color-surface-alt);
  color: var(--color-text-secondary);
  border: var(--border-standard);
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-ui);
}

.notes-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
  padding: var(--space-4) var(--space-5);
}

.notes-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.notes-text {
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin: 0;
  font-style: italic;
}

.fup-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: var(--border-standard);
}

.footer-by {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.footer-date {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.fup-list-enter-active {
  transition: var(--transition-fade-slide);
}

.fup-list-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.fup-list-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fup-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fup-list-move {
  transition: transform 0.25s var(--ease-standard);
}

.expand-enter-active {
  transition: opacity var(--duration-normal) var(--ease-standard),
    transform var(--duration-normal) var(--ease-standard);
}

.expand-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.expand-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>