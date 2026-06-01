<script setup lang="ts">
import { ArrowDown, ArrowUp, ArrowUpDown } from '@lucide/vue';
import { computed, ref } from 'vue';
import DrugChip from '@/components/shared/DrugChip.vue';
import type { DispensingRecord } from '@/types/dispensing';

const props = defineProps<{
  records: DispensingRecord[];
}>();

// -- Sorting --

type SortKey = 'date' | 'drug' | 'class' | 'qty';
type SortDir = 'asc' | 'desc';

const sortKey = ref<SortKey>('date');
const sortDir = ref<SortDir>('desc');

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = key === 'date' ? 'desc' : 'asc';
  }
}

const sortedRecords = computed<DispensingRecord[]>(() => {
  const list = [...props.records];
  const dir = sortDir.value === 'asc' ? 1 : -1;

  return list.sort((a, b) => {
    switch (sortKey.value) {
      case 'date':
        return dir * a.vstdate.localeCompare(b.vstdate);
      case 'drug':
        return dir * (a.drug_name ?? a.icode).localeCompare(b.drug_name ?? b.icode, 'th');
      case 'class': {
        const classOrder: Record<string, number> = { H: 1, R: 2, Z: 3, E: 4 };
        const aOrd = classOrder[a.drug_class ?? ''] ?? 99;
        const bOrd = classOrder[b.drug_class ?? ''] ?? 99;
        return dir * (aOrd - bOrd);
      }
      case 'qty':
        return dir * ((a.qty ?? 0) - (b.qty ?? 0));
      default:
        return 0;
    }
  });
});

// -- Stats --

const uniqueDates = computed(() => new Set(props.records.map((r) => r.vstdate)).size);
const uniqueClasses = computed(
  () => new Set(props.records.map((r) => r.drug_class).filter(Boolean)).size,
);

// -- Helpers --

function toThaiDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`;
  } catch {
    return iso;
  }
}

function rowClass(drugClass: string | null): string {
  switch (drugClass) {
    case 'H':
      return 'row-H';
    case 'R':
      return 'row-R';
    case 'Z':
      return 'row-Z';
    case 'E':
      return 'row-E';
    default:
      return 'row-unknown';
  }
}

function sortIcon(key: SortKey): 'none' | 'asc' | 'desc' {
  if (sortKey.value !== key) return 'none';
  return sortDir.value;
}
</script>

<template>
  <div class="disp-table-wrapper">

    <!-- Summary bar -->
    <div v-if="records.length > 0" class="summary-bar">
      <span class="summary-item">
        <span class="summary-value">{{ records.length }}</span>
        <span class="summary-label">รายการทั้งหมด</span>
      </span>
      <span class="summary-sep" aria-hidden="true">·</span>
      <span class="summary-item">
        <span class="summary-value">{{ uniqueDates }}</span>
        <span class="summary-label">วันที่รับยา</span>
      </span>
      <span class="summary-sep" aria-hidden="true">·</span>
      <span class="summary-item">
        <span class="summary-value">{{ uniqueClasses }}</span>
        <span class="summary-label">กลุ่มยา</span>
      </span>

      <!-- Drug class legend chips -->
      <div class="legend-chips" aria-hidden="true">
        <DrugChip v-for="cls in ['H', 'R', 'Z', 'E']" :key="cls" :drug="cls" size="sm" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="records.length === 0" class="empty-state" role="status">
      <svg class="empty-icon" xmlns="http://www.w3.org/2000/svg" width="36" height="36"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
      <span class="empty-title">ไม่พบประวัติการจ่ายยา TB</span>
      <span class="empty-sub">ยังไม่มีรายการยาวัณโรคในระบบ HOSxP สำหรับผู้ป่วยรายนี้</span>
    </div>

    <!-- Table -->
    <div v-else class="table-scroll">
      <table class="disp-table" aria-label="ประวัติการจ่ายยา TB">
        <thead>
          <tr>
            <!-- วันที่ -->
            <th class="th-date">
              <button class="sort-btn" @click="toggleSort('date')" aria-label="เรียงตามวันที่">
                <span>วันที่</span>
                <ArrowUpDown v-if="sortIcon('date') === 'none'" :size="12" class="sort-icon" />
                <ArrowUp    v-else-if="sortIcon('date') === 'asc'"  :size="12" class="sort-icon sort-icon-active" />
                <ArrowDown  v-else                                   :size="12" class="sort-icon sort-icon-active" />
              </button>
            </th>

            <!-- รายการยา -->
            <th class="th-name">
              <button class="sort-btn" @click="toggleSort('drug')" aria-label="เรียงตามชื่อยา">
                <span>รายการยา</span>
                <ArrowUpDown v-if="sortIcon('drug') === 'none'" :size="12" class="sort-icon" />
                <ArrowUp    v-else-if="sortIcon('drug') === 'asc'"  :size="12" class="sort-icon sort-icon-active" />
                <ArrowDown  v-else                                   :size="12" class="sort-icon sort-icon-active" />
              </button>
            </th>

            <!-- กลุ่มยา -->
            <th class="th-class">
              <button class="sort-btn" @click="toggleSort('class')" aria-label="เรียงตามกลุ่มยา">
                <span>กลุ่มยา</span>
                <ArrowUpDown v-if="sortIcon('class') === 'none'" :size="12" class="sort-icon" />
                <ArrowUp    v-else-if="sortIcon('class') === 'asc'"  :size="12" class="sort-icon sort-icon-active" />
                <ArrowDown  v-else                                    :size="12" class="sort-icon sort-icon-active" />
              </button>
            </th>

            <!-- จำนวน -->
            <th class="th-qty">
              <button class="sort-btn sort-btn-right" @click="toggleSort('qty')" aria-label="เรียงตามจำนวน">
                <span>จำนวน</span>
                <ArrowUpDown v-if="sortIcon('qty') === 'none'" :size="12" class="sort-icon" />
                <ArrowUp    v-else-if="sortIcon('qty') === 'asc'"  :size="12" class="sort-icon sort-icon-active" />
                <ArrowDown  v-else                                   :size="12" class="sort-icon sort-icon-active" />
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="r in sortedRecords"
            :key="r.vstdate + '-' + r.icode"
            class="data-row"
            :class="rowClass(r.drug_class)"
          >
            <!-- วันที่ -->
            <td class="td-date">
              <span class="date-text">{{ toThaiDate(r.vstdate) }}</span>
            </td>

            <!-- รายการยา -->
            <td class="td-name">
              <span class="drug-name">{{ r.drug_name ?? r.icode }}</span>
              <span v-if="r.drug_name && r.icode" class="drug-icode">{{ r.icode }}</span>
            </td>

            <!-- กลุ่มยา -->
            <td class="td-class">
              <DrugChip v-if="r.drug_class" :drug="r.drug_class" size="sm" />
              <span v-else class="no-class">—</span>
            </td>

            <!-- จำนวน -->
            <td class="td-qty">
              <span class="qty-value">{{ r.qty != null ? r.qty : '—' }}</span>
              <span v-if="r.units" class="qty-unit">{{ r.units }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
.disp-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.summary-bar {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  padding: var(--space-4) var(--space-6);
  background: var(--color-surface-alt);
  border-radius: var(--radius-sm);
}

.summary-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.summary-value {
  font-size: var(--text-body);
  font-weight: var(--weight-heading);
  color: var(--color-text);
}

.summary-label {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.summary-sep {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1;
}

.legend-chips {
  display: flex;
  gap: var(--space-2);
  margin-left: auto;
  flex-wrap: wrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--empty-padding-sm);
  text-align: center;
  color: var(--color-text-muted);
}

.empty-icon {
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
  max-width: 320px;
  line-height: var(--leading-body);
}

.table-scroll {
  overflow-x: auto;
  border-radius: var(--radius-sm);
  border: var(--border-standard);
}

.disp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-sm);
  min-width: 520px;
}

thead tr {
  background: var(--color-surface-alt);
  border-bottom: var(--border-standard);
}

thead th {
  padding: 0;
  font-size: var(--table-header-font-size);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  text-align: left;
  white-space: nowrap;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: 9px 12px;
  background: none;
  border: none;
  font-size: var(--table-header-font-size);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  color: var(--color-text-secondary);
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: var(--transition-icon-btn);
}

.sort-btn:hover {
  background: var(--tint-hover);
  color: var(--color-text);
}

.sort-btn-right {
  justify-content: flex-end;
}

.sort-icon {
  flex-shrink: 0;
  opacity: 0.35;
}

.sort-icon-active {
  opacity: 1;
  color: var(--color-accent);
}

.th-date  { width: 110px; }
.th-class { width: 90px; }
.th-qty   { width: 110px; }

.data-row {
  border-bottom: var(--border-standard);
  border-left: 3px solid transparent;
  transition: background var(--duration-instant) var(--ease-standard);
}

.data-row:last-child {
  border-bottom: none;
}

.data-row:hover {
  background: var(--color-surface-alt);
}

.row-H { border-left-color: var(--drug-H); }
.row-R { border-left-color: var(--drug-R); }
.row-Z { border-left-color: var(--drug-Z); }
.row-E { border-left-color: var(--drug-E); }
.row-unknown { border-left-color: transparent; }

td {
  padding: 9px 12px;
  vertical-align: middle;
}

.td-date {
  white-space: nowrap;
}

.date-text {
  font-size: var(--text-sm);
  font-weight: var(--weight-ui);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.drug-name {
  font-size: var(--text-body-sm);
  color: var(--color-text);
  font-weight: var(--weight-body);
  line-height: var(--leading-normal);
}

.drug-icode {
  display: block;
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}

.td-class {
  white-space: nowrap;
}

.no-class {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.td-qty {
  white-space: nowrap;
  text-align: right;
}

.qty-value {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.qty-unit {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  margin-left: 3px;
}
</style>