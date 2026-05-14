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
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { Followup } from '@/types/treatment';

const props = defineProps<{
  followups: Followup[];
}>();

// ── Sort order toggle ─────────────────────────────────────────────────────

const newestFirst = ref(true);

const sortedFollowups = computed<Followup[]>(() => {
  const list = [...props.followups].sort((a, b) => a.followup_date.localeCompare(b.followup_date));
  return newestFirst.value ? list.reverse() : list;
});

// ── Expandable items ──────────────────────────────────────────────────────

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

// ── Date helpers ──────────────────────────────────────────────────────────

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

// ── Sputum helpers ────────────────────────────────────────────────────────

type SputumResult = 'negative' | 'positive' | 'not_done' | null;

interface BadgeConfig {
  label: string;
  bg: string;
  color: string;
}

function sputumConfig(v: SputumResult): BadgeConfig {
  switch (v) {
    case 'negative':
      return { label: 'ผลลบ', bg: 'rgba(26,174,57,0.1)', color: '#1aae39' };
    case 'positive':
      return { label: 'ผลบวก', bg: 'rgba(221,91,0,0.1)', color: '#dd5b00' };
    case 'not_done':
      return { label: 'ไม่ได้ตรวจ', bg: 'rgba(0,0,0,0.06)', color: '#a39e98' };
    default:
      return { label: '-', bg: 'rgba(0,0,0,0.04)', color: '#a39e98' };
  }
}

// ── X-ray helpers ─────────────────────────────────────────────────────────

type XrayResult = 'improved' | 'stable' | 'worse' | 'not_done' | null;

function xrayConfig(v: XrayResult): BadgeConfig {
  switch (v) {
    case 'improved':
      return { label: 'ดีขึ้น', bg: 'rgba(42,157,153,0.1)', color: '#2a9d99' };
    case 'stable':
      return { label: 'คงที่', bg: 'rgba(0,0,0,0.06)', color: '#615d59' };
    case 'worse':
      return { label: 'แย่ลง', bg: 'rgba(221,91,0,0.1)', color: '#dd5b00' };
    case 'not_done':
      return { label: 'ไม่ได้ตรวจ', bg: 'rgba(0,0,0,0.06)', color: '#a39e98' };
    default:
      return { label: '-', bg: 'rgba(0,0,0,0.04)', color: '#a39e98' };
  }
}

// ── Adherence helpers ─────────────────────────────────────────────────────

type Adherence = 'good' | 'fair' | 'poor' | null;

function adherenceConfig(v: Adherence): BadgeConfig {
  switch (v) {
    case 'good':
      return { label: 'การรับยา: ดี', bg: 'rgba(26,174,57,0.1)', color: '#1aae39' };
    case 'fair':
      return { label: 'การรับยา: พอใช้', bg: 'rgba(245,166,35,0.12)', color: '#c78b00' };
    case 'poor':
      return { label: 'การรับยา: ไม่ดี', bg: 'rgba(221,91,0,0.1)', color: '#dd5b00' };
    default:
      return { label: 'การรับยา: -', bg: 'rgba(0,0,0,0.04)', color: '#a39e98' };
  }
}

// ── Side effects ──────────────────────────────────────────────────────────

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

// ── Dispensed drugs ───────────────────────────────────────────────────────

function parseDispensedDrugs(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

// ── Summary line ──────────────────────────────────────────────────────────

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

    <!-- ── Header bar ────────────────────────────────────────────── -->
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

    <!-- ── Empty state ────────────────────────────────────────────── -->
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

    <!-- ── Follow-up item cards ───────────────────────────────────── -->
    <TransitionGroup name="fup-list" tag="div" class="list-items">
      <div
        v-for="f in sortedFollowups"
        :key="f.id"
        class="fup-card"
        :class="{
          'fup-card-alert': parseSideEffects(f.side_effects).some(isOpticNeuritis),
        }"
      >
        <!-- ── Card header ────────────────────────────────── -->
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

        <!-- ── Expanded detail ────────────────────────────── -->
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
/* ── Root ─────────────────────────────────────────────────────────── */
.followup-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── List header ──────────────────────────────────────────────────── */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.list-count {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.sort-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: var(--border);
  border-radius: var(--radius-pill);
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.sort-toggle:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

/* ── Empty state ──────────────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 24px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.2;
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
  max-width: 300px;
  line-height: 1.5;
}

/* ── List items container ─────────────────────────────────────────── */
.list-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── Follow-up card ───────────────────────────────────────────────── */
.fup-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.fup-card:hover {
  box-shadow:
    rgba(0, 0, 0, 0.06) 0px 4px 14px,
    rgba(0, 0, 0, 0.03) 0px 1px 4px;
}

/* Alert state: E-related optic neuritis */
.fup-card-alert {
  border-left: 3px solid var(--color-orange);
}

/* ── Card header ──────────────────────────────────────────────────── */
.fup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  user-select: none;
}

.fup-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.fup-date-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.fup-date {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.1px;
}

.month-badge {
  padding: 2px 8px;
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.fup-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.weight-tag {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.created-by-inline {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.created-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

/* ── Header right: chips ──────────────────────────────────────────── */
.fup-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.chip-se {
  background: rgba(221, 91, 0, 0.1);
  color: var(--color-orange);
}

.expand-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.expand-icon-open {
  transform: rotate(180deg);
}

/* ── Card body (expanded) ─────────────────────────────────────────── */
.fup-body {
  padding: 0 16px 14px;
  border-top: var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
}

/* ── Results row ──────────────────────────────────────────────────── */
.results-row {
  display: flex;
  gap: 24px;
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
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
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
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Side effects ─────────────────────────────────────────────────── */
.side-effects-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.se-heading {
  font-size: 11px;
  font-weight: 600;
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
  gap: 4px;
  padding: 3px 9px;
  background: rgba(221, 91, 0, 0.08);
  color: #b84a00;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}

.se-tag-priority {
  background: rgba(221, 91, 0, 0.15);
  color: #dd5b00;
  outline: 1px solid rgba(221, 91, 0, 0.3);
}

.se-priority-marker {
  font-size: 10px;
}

/* ── Dispensed drugs ──────────────────────────────────────────────── */
.dispensed-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.dispensed-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
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
  padding: 2px 8px;
  background: var(--color-bg-alt);
  color: var(--color-text-secondary);
  border: var(--border);
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 500;
}

/* ── Notes ────────────────────────────────────────────────────────── */
.notes-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}

.notes-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.notes-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.55;
  margin: 0;
  font-style: italic;
}

/* ── Footer ───────────────────────────────────────────────────────── */
.fup-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 6px;
  border-top: var(--border);
}

.footer-by {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.footer-date {
  font-size: 11px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

/* ── List transition ──────────────────────────────────────────────── */
.fup-list-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fup-list-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
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
  transition: transform 0.25s ease;
}

/* ── Expand transition ────────────────────────────────────────────── */
.expand-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.expand-leave-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
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