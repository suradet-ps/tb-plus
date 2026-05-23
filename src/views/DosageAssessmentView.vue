<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  Loader2,
  Scale,
  Search,
  UserRound,
} from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import DrugChip from '@/components/shared/DrugChip.vue';
import { useSettingsStore } from '@/stores/settings';
import type { DosageAssessmentResult } from '@/types/dosage';

const settingsStore = useSettingsStore();

const hnQuery = ref('');
const selectedRegimen = ref('');
const result = ref<DosageAssessmentResult | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

const visibleWarnings = computed(() =>
  (result.value?.warnings ?? []).filter(
    (warning) => !warning.includes('ยังไม่มี phase ที่ตั้งค่าไว้ ระบบจึงใช้การตีความมาตรฐานอัตโนมัติ'),
  ),
);

watch(
  () => settingsStore.regimenDefinitions,
  (regimens) => {
    if (!regimens.length) {
      selectedRegimen.value = '';
      return;
    }
    if (!regimens.some((regimen) => regimen.name === selectedRegimen.value)) {
      selectedRegimen.value = regimens[0]?.name ?? '';
    }
  },
  { immediate: true },
);

async function assessDosage() {
  const hn = hnQuery.value.trim();
  if (!hn || !selectedRegimen.value) {
    error.value = 'กรุณาระบุ HN และเลือกสูตรยาก่อนประเมิน';
    return;
  }

  isLoading.value = true;
  error.value = null;
  try {
    result.value = await invoke<DosageAssessmentResult>('assess_patient_dosage', {
      hn,
      regimenName: selectedRegimen.value,
    });
  } catch (err) {
    result.value = null;
    error.value = String(err);
  } finally {
    isLoading.value = false;
  }
}

function toThaiDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '-';
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 543}`;
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return '-';
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatRange(minValue: number | null, maxValue: number | null): string {
  if (minValue == null || maxValue == null) return '-';
  return `${formatNumber(minValue)}-${formatNumber(maxValue)} mg/day`;
}

function sexLabel(sex: string | null | undefined): string | null {
  if (!sex) return null;
  if (sex === '1' || sex.toUpperCase() === 'M') return 'ชาย';
  if (sex === '2' || sex.toUpperCase() === 'F') return 'หญิง';
  return sex;
}
</script>

<template>
  <div class="view-root">
    <div class="view-header">
      <div>
        <h1>การประเมินขนาดยา</h1>
        <p>ค้นหาผู้ป่วยจาก HN แล้วคำนวณขนาดยาตามสูตรรักษาโดยอ้างอิงน้ำหนักล่าสุด</p>
      </div>
      <div class="header-chip">
        <Calculator :size="15" />
        ใช้น้ำหนักล่าสุดจาก HOSxP
      </div>
    </div>

    <div class="search-card">
      <div class="search-grid">
        <div class="form-group">
          <label class="form-label" for="dosage-hn">HN</label>
          <input
            id="dosage-hn"
            v-model="hnQuery"
            class="form-input"
            placeholder="ระบุ HN ผู้ป่วย"
            @keydown.enter="assessDosage"
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="dosage-regimen">สูตรยา</label>
          <select id="dosage-regimen" v-model="selectedRegimen" class="form-input">
            <option value="" disabled>เลือกสูตรยา</option>
            <option
              v-for="regimen in settingsStore.regimenDefinitions"
              :key="regimen.name"
              :value="regimen.name"
            >
              {{ regimen.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="search-actions">
        <button
          class="btn-primary"
          :disabled="isLoading || !settingsStore.isConnected || !settingsStore.regimenDefinitions.length"
          @click="assessDosage"
        >
          <Loader2 v-if="isLoading" :size="14" class="spin" />
          <Search v-else :size="14" />
          ประเมินขนาดยา
        </button>
        <span class="helper-text">รองรับทั้งรายใหม่และรายเดิม</span>
      </div>
    </div>

    <div v-if="!settingsStore.isConnected" class="state-box state-box--warn">
      <AlertCircle :size="26" class="state-icon" />
      <div>
        <p class="state-title">ยังไม่ได้เชื่อมต่อ HOSxP</p>
        <p class="state-sub">ต้องเชื่อมต่อ MySQL ก่อนจึงจะค้นหาผู้ป่วยและดึงน้ำหนักล่าสุดได้</p>
      </div>
    </div>

    <div v-else-if="!settingsStore.regimenDefinitions.length" class="state-box state-box--warn">
      <AlertCircle :size="26" class="state-icon" />
      <div>
        <p class="state-title">ยังไม่ได้ตั้งค่าสูตรยา</p>
        <p class="state-sub">กรุณาเพิ่มสูตรยาในหน้าตั้งค่าก่อนใช้งานการประเมินขนาดยา</p>
      </div>
    </div>

    <div v-if="error" class="state-box state-box--error">
      <AlertCircle :size="26" class="state-icon" />
      <div>
        <p class="state-title">ประเมินขนาดยาไม่สำเร็จ</p>
        <p class="state-sub">{{ error }}</p>
      </div>
    </div>

    <template v-if="result">
      <div class="summary-card">
        <div class="summary-head">
          <div>
            <p class="summary-label">ผู้ป่วย</p>
            <h2>{{ result.patient.full_name }}</h2>
            <p class="summary-meta">
              HN {{ result.patient.hn }}
              <span v-if="result.patient.age != null">· อายุ {{ result.patient.age }} ปี</span>
              <span v-if="sexLabel(result.patient.sex)">· เพศ {{ sexLabel(result.patient.sex) }}</span>
            </p>
          </div>
          <div class="weight-panel">
            <div class="weight-badge">
              <Scale :size="15" />
              น้ำหนักล่าสุด {{ formatNumber(result.patient.latest_weight_kg, 1) }} กก.
            </div>
            <p class="weight-date">อ้างอิงวันที่ {{ toThaiDate(result.patient.latest_weight_date) }}</p>
            <p class="weight-regimen">สูตรที่เลือก: {{ result.regimen_name }}</p>
          </div>
        </div>
      </div>

      <div v-if="visibleWarnings.length" class="warnings-card">
        <div v-for="warning in visibleWarnings" :key="warning" class="warning-row">
          <AlertCircle :size="15" />
          <span>{{ warning }}</span>
        </div>
      </div>

      <div v-for="phase in result.phases" :key="phase.phase" class="phase-card">
        <div class="phase-header">
          <div>
            <h3>{{ phase.phase }}</h3>
            <p>ช่วงรักษา {{ phase.months }} เดือน</p>
          </div>
          <span class="phase-count">{{ phase.items.length }} รายการยา</span>
        </div>

        <div v-if="phase.items.length" class="assessment-table-wrap">
          <table class="assessment-table">
            <thead>
              <tr>
                <th>ยา</th>
                <th>ช่วงเป้าหมาย</th>
                <th>Strength</th>
                <th>แนะนำต่อวัน</th>
                <th>ผลประเมิน</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in phase.items" :key="`${phase.phase}_${item.class}_${item.icode}`">
                <td>
                  <div class="drug-cell">
                    <DrugChip :drug="item.class" size="md" />
                    <div>
                      <div class="drug-name">{{ item.drug_name }}</div>
                      <div class="drug-code">icode {{ item.icode }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="target-range">{{ formatRange(item.target_min_mg_day, item.target_max_mg_day) }}</div>
                  <div class="dose-rule">{{ item.min_mg_per_kg_day }}-{{ item.max_mg_per_kg_day }} mg/kg/day</div>
                </td>
                <td>
                  <div class="strength-text">{{ item.strength ?? '-' }}</div>
                  <div class="dose-rule">{{ item.units ?? 'หน่วย' }}</div>
                </td>
                <td>
                  <div class="suggestion-main">
                    {{ item.suggested_units_per_day != null ? `${item.suggested_units_per_day} หน่วย/วัน` : '-' }}
                  </div>
                  <div class="dose-rule">
                    {{ item.suggested_daily_dose_mg != null ? `${formatNumber(item.suggested_daily_dose_mg)} mg/day` : item.note ?? '-' }}
                  </div>
                </td>
                <td>
                  <div class="status-pill" :class="item.within_target_range ? 'status-pill--ok' : 'status-pill--warn'">
                    <CheckCircle2 v-if="item.within_target_range" :size="14" />
                    <AlertCircle v-else :size="14" />
                    {{ item.within_target_range ? 'อยู่ในช่วงเป้าหมาย' : 'ใกล้ที่สุดจากจำนวนเต็ม' }}
                  </div>
                  <div class="dose-rule">{{ item.note ?? '-' }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-card">ยังไม่มีรายการยาที่ประเมินได้ในระยะนี้</div>
      </div>
    </template>

    <div v-else class="empty-card empty-card--large">
      <UserRound :size="30" class="empty-icon" />
      <p class="empty-title">พร้อมประเมินขนาดยา</p>
      <p class="empty-sub">กรอก HN และเลือกสูตรยาเพื่อดูคำแนะนำเทียบกับน้ำหนักล่าสุด</p>
    </div>
  </div>
</template>

<style scoped>
.view-root {
  padding: 32px 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.view-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.view-header p,
.summary-meta,
.weight-date,
.weight-regimen,
.helper-text,
.state-sub,
.phase-header p,
.dose-rule,
.empty-sub {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.header-chip,
.weight-badge,
.phase-count,
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
}

.header-chip,
.phase-count {
  background: var(--color-badge-bg);
  color: var(--color-blue);
}

.search-card,
.summary-card,
.warnings-card,
.phase-card,
.state-box,
.empty-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.search-card,
.summary-card,
.warnings-card,
.phase-card,
.state-box {
  padding: 22px 24px;
}

.search-grid {
  display: grid;
  grid-template-columns: minmax(220px, 360px) minmax(260px, 420px);
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #dddddd;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  transition: border-color 0.13s, box-shadow 0.13s;
}

.form-input:focus {
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.1);
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-blue);
  color: #fff;
  border: none;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.13s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-blue-active);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.state-box {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.state-box--warn {
  background: #fff8f1;
}

.state-box--error {
  background: #fff5f5;
}

.state-icon,
.empty-icon {
  color: var(--color-orange);
  flex-shrink: 0;
}

.state-title,
.summary-head h2,
.phase-header h3,
.empty-title {
  color: var(--color-text);
  margin: 0 0 4px;
  font-weight: 700;
}

.summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.summary-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.weight-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.weight-badge {
  background: rgba(42, 157, 153, 0.12);
  color: var(--color-teal);
}

.warnings-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fffaf2;
}

.warning-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-orange);
}

.phase-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.assessment-table-wrap {
  overflow-x: auto;
}

.assessment-table {
  width: 100%;
  border-collapse: collapse;
}

.assessment-table th,
.assessment-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  vertical-align: top;
  text-align: left;
}

.assessment-table th {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.drug-cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.drug-name,
.suggestion-main,
.target-range,
.strength-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.drug-code {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.status-pill--ok {
  background: rgba(26, 174, 57, 0.1);
  color: var(--color-green);
}

.status-pill--warn {
  background: rgba(221, 91, 0, 0.1);
  color: var(--color-orange);
}

.empty-card {
  padding: 28px 24px;
  text-align: center;
}

.empty-card--large {
  padding: 56px 24px;
}

.spin {
  animation: spin 0.85s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 960px) {
  .view-header,
  .summary-head {
    flex-direction: column;
  }

  .weight-panel {
    align-items: flex-start;
  }

  .search-grid {
    grid-template-columns: 1fr;
  }
}
</style>