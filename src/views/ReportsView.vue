<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Users,
  TrendingUp,
  Pill,
  AlertTriangle,
  Clock,
  Calendar,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-vue-next'
import { usePatientStore } from '@/stores/patient'
import type { TreatmentPlan } from '@/types/treatment'

const patientStore = usePatientStore()

const activeReport = ref<string | null>(null)

onMounted(() => {
  patientStore.fetchActivePatients()
})

function getEffectivePhase(plan: TreatmentPlan | null | undefined): 'intensive' | 'continuation' | null {
  if (!plan) return null
  if (plan.phase === 'intensive' && plan.phase_end_expected) {
    if (new Date() > new Date(plan.phase_end_expected)) return 'continuation'
  }
  return plan.phase as 'intensive' | 'continuation'
}

// ── Derived stats ────────────────────────────────────────────────────
const totalActive = computed(() => patientStore.activePatients.length)

const intensiveCount = computed(
  () => patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'intensive').length,
)

const continuationCount = computed(
  () => patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'continuation').length,
)

const overdueCount = computed(
  () => patientStore.activePatients.filter((p) => (p.days_since_last_dispensing ?? 0) > 35).length,
)

// ── Report cards definition ───────────────────────────────────────────
interface ReportCard {
  id: string
  titleTh: string
  icon: string
  iconColor: string
  iconBg: string
  valueColor: string
  value: string | number
  label: string
  description: string
  available: boolean
}

const reportCards = computed<ReportCard[]>(() => [
  {
    id: 'census',
    titleTh: 'สถิติผู้ป่วย',
    icon: 'Users',
    iconColor: '#0075de',
    iconBg: 'rgba(0,117,222,0.1)',
    valueColor: '#0075de',
    value: totalActive.value,
    label: 'ผู้ป่วยทั้งหมด (active)',
    description: 'จำนวนผู้ป่วยแบ่งตามสถานะ',
    available: true,
  },
  {
    id: 'success-rate',
    titleTh: 'อัตราความสำเร็จ',
    icon: 'TrendingUp',
    iconColor: '#2a9d99',
    iconBg: 'rgba(42,157,153,0.1)',
    valueColor: '#2a9d99',
    value: '-',
    label: 'หาย + รักษาครบ / ทั้งหมด',
    description: 'อัตราสำเร็จในการรักษา (%)',
    available: false,
  },
  {
    id: 'drug-consumption',
    titleTh: 'การใช้ยา',
    icon: 'Pill',
    iconColor: '#dd5b00',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: '#dd5b00',
    value: '-',
    label: 'รายการจ่ายยาต่อเดือน',
    description: 'ปริมาณยา TB ที่จ่ายไป แบ่งตามประเภท',
    available: false,
  },
  {
    id: 'ethambutol-overrun',
    titleTh: 'E เกินกำหนด',
    icon: 'AlertTriangle',
    iconColor: '#dd5b00',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: '#dd5b00',
    value: '-',
    label: 'ผู้ป่วยที่ได้รับ E เกินระยะ',
    description: 'รายชื่อผู้ป่วยที่ได้รับ Ethambutol เกินกำหนด',
    available: false,
  },
  {
    id: 'lost-followup',
    titleTh: 'ขาดการติดตาม',
    icon: 'Clock',
    iconColor: '#dd5b00',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: '#dd5b00',
    value: overdueCount.value,
    label: 'ผู้ป่วยไม่ได้รับยา > 35 วัน',
    description: 'ผู้ป่วยที่ไม่ได้รับยานาน > 35 วัน (แจ้งเตือน) หรือ > 60 วัน (ขาดการติดตาม)',
    available: true,
  },
  {
    id: 'monthly-cohort',
    titleTh: 'Cohort รายเดือน',
    icon: 'Calendar',
    iconColor: '#0075de',
    iconBg: 'rgba(0,117,222,0.1)',
    valueColor: '#0075de',
    value: '-',
    label: 'วิเคราะห์ตามเดือนที่ลงทะเบียน',
    description: 'การวิเคราะห์ cohort แบ่งตามเดือนลงทะเบียน',
    available: false,
  },
])

// ── CSV export ────────────────────────────────────────────────────────
function exportCSV() {
  const headers = [
    'HN',
    'ชื่อ-สกุล',
    'สูตรยา',
    'Phase',
    'เดือนที่',
    'รับยาล่าสุด',
    'สถานะการแจ้งเตือน',
  ]

  const rows = patientStore.activePatients.map((p) => [
    p.tb_patient.hn,
    p.demographics?.full_name ?? '-',
    p.current_plan?.regimen ?? '-',
    getEffectivePhase(p.current_plan) === 'intensive'
      ? 'ระยะเข้มข้น'
      : getEffectivePhase(p.current_plan) === 'continuation'
        ? 'ระยะต่อเนื่อง'
        : '-',
    p.current_month !== null
      ? `${p.current_month}/${p.total_months ?? '?'}`
      : '-',
    p.days_since_last_dispensing !== null
      ? `${p.days_since_last_dispensing} วันที่แล้ว`
      : '-',
    p.alerts.some((a) => a.severity === 'red')
      ? 'แจ้งเตือนสีแดง'
      : p.alerts.length
        ? 'เฝ้าระวัง'
        : 'ปกติ',
  ])

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tb-plus-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="view-root">

    <!-- ── Page header ── -->
    <div class="view-header">
      <div class="header-left">
        <h1>รายงาน</h1>
        <p>สถิติและรายงานสำหรับมาตรฐาน HA</p>
      </div>
      <div class="header-right">
        <button
          class="btn-ghost"
          :disabled="patientStore.isLoading"
          title="รีเฟรชข้อมูล"
          @click="patientStore.fetchActivePatients()"
        >
          <Loader2 v-if="patientStore.isLoading" :size="13" class="spin" />
          <RefreshCw v-else :size="13" />
          รีเฟรช
        </button>
        <button class="btn-export" @click="exportCSV">
          <Download :size="13" />
          ส่งออก CSV
        </button>
      </div>
    </div>

    <!-- ── Quick stats strip ── -->
    <div class="quick-stats">
      <div class="qs-item">
        <span class="qs-value">{{ totalActive }}</span>
        <span class="qs-label">Active ทั้งหมด</span>
      </div>
      <div class="qs-divider" aria-hidden="true" />
      <div class="qs-item">
        <span class="qs-value qs-orange">{{ intensiveCount }}</span>
        <span class="qs-label">ระยะเข้มข้น</span>
      </div>
      <div class="qs-divider" aria-hidden="true" />
      <div class="qs-item">
        <span class="qs-value qs-teal">{{ continuationCount }}</span>
        <span class="qs-label">ระยะต่อเนื่อง</span>
      </div>
      <div class="qs-divider" aria-hidden="true" />
      <div class="qs-item">
        <span class="qs-value qs-red">{{ overdueCount }}</span>
        <span class="qs-label">ไม่ได้รับยา &gt; 35 วัน</span>
      </div>
    </div>

    <!-- ── Report cards grid ── -->
    <div class="report-grid">
      <div
        v-for="card in reportCards"
        :key="card.id"
        class="report-card"
        :class="{
          'card-active': activeReport === card.id,
          'card-unavailable': !card.available,
        }"
        :title="card.available ? card.description : 'รายงานนี้จะพร้อมใช้งานในเวอร์ชันถัดไป'"
        @click="activeReport = activeReport === card.id ? null : card.id"
      >
        <!-- Icon -->
        <div
          class="report-card-icon"
          :style="{ color: card.iconColor, background: card.iconBg }"
        >
          <Users         v-if="card.icon === 'Users'"         :size="19" />
          <TrendingUp    v-else-if="card.icon === 'TrendingUp'"    :size="19" />
          <Pill          v-else-if="card.icon === 'Pill'"          :size="19" />
          <AlertTriangle v-else-if="card.icon === 'AlertTriangle'" :size="19" />
          <Clock         v-else-if="card.icon === 'Clock'"         :size="19" />
          <Calendar      v-else-if="card.icon === 'Calendar'"      :size="19" />
        </div>

        <!-- Body -->
        <div class="report-card-body">
          <div class="report-title">{{ card.titleTh }}</div>
          <div
            class="report-value"
            :style="{ color: card.available ? card.valueColor : 'var(--color-text-muted)' }"
          >
            {{ card.value }}
          </div>
          <div class="report-label">{{ card.label }}</div>
          <div class="report-desc">{{ card.description }}</div>
        </div>

        <!-- "Coming soon" badge for unavailable cards -->
        <span v-if="!card.available" class="coming-soon-tag">เร็วๆ นี้</span>
      </div>
    </div>

    <!-- ── Loading state ── -->
    <div v-if="patientStore.isLoading && patientStore.activePatients.length === 0" class="state-container">
      <Loader2 :size="28" class="spin loading-icon" />
      <span class="state-title">กำลังโหลดข้อมูล...</span>
    </div>

    <!-- ── Error state ── -->
    <div
      v-else-if="patientStore.error && patientStore.activePatients.length === 0"
      class="state-container"
    >
      <AlertTriangle :size="32" class="error-icon" />
      <span class="state-title">ไม่สามารถโหลดข้อมูลได้</span>
      <span class="state-sub">{{ patientStore.error }}</span>
      <button class="retry-btn" @click="patientStore.fetchActivePatients()">ลองใหม่</button>
    </div>

    <!-- ── Active patients table ── -->
    <div
      v-else-if="patientStore.activePatients.length > 0"
      class="report-table-card"
    >
      <div class="table-header">
        <div class="table-header-left">
          <h3>รายชื่อผู้ป่วย Active ทั้งหมด</h3>
          <span class="table-count">{{ patientStore.activePatients.length }} ราย</span>
        </div>
      </div>

      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
              <th>สูตรยา</th>
              <th>Phase</th>
              <th class="col-center">เดือนที่</th>
              <th>รับยาล่าสุด</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in patientStore.activePatients"
              :key="p.tb_patient.hn"
              :class="{ 'row-overdue': (p.days_since_last_dispensing ?? 0) > 35 }"
            >
              <!-- HN -->
              <td class="mono">{{ p.tb_patient.hn }}</td>

              <!-- Name -->
              <td>
                <span class="patient-name">
                  {{ p.demographics?.full_name ?? '—' }}
                </span>
              </td>

              <!-- Regimen -->
              <td>
                <span v-if="p.current_plan?.regimen" class="regimen-tag">
                  {{ p.current_plan.regimen }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>

              <!-- Phase -->
              <td>
                <span
                  v-if="getEffectivePhase(p.current_plan)"
                  class="phase-chip"
                  :class="getEffectivePhase(p.current_plan) === 'intensive' ? 'phase-intensive' : 'phase-continuation'"
                >
                  {{ getEffectivePhase(p.current_plan) === 'intensive' ? 'Intensive' : 'Continuation' }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>

              <!-- Month progress -->
              <td class="col-center">
                <span v-if="p.current_month !== null" class="month-progress">
                  {{ p.current_month }}<span class="month-sep">/</span>{{ p.total_months ?? '?' }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>

              <!-- Last dispensing -->
              <td
                :class="{
                  'overdue-cell': (p.days_since_last_dispensing ?? 0) > 35,
                }"
              >
                <span v-if="p.days_since_last_dispensing !== null">
                  {{ p.days_since_last_dispensing }} วันที่แล้ว
                </span>
                <span v-else class="muted-dash">—</span>
              </td>

              <!-- Alert status -->
              <td>
                <span
                  v-if="p.alerts.some((a) => a.severity === 'red')"
                  class="alert-pill alert-red"
                >
                  ⚠ แจ้งเตือน
                </span>
                <span
                  v-else-if="p.alerts.length"
                  class="alert-pill alert-yellow"
                >
                  • เฝ้าระวัง
                </span>
                <span v-else class="alert-pill alert-ok">
                  ✓ ปกติ
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Empty state ── -->
    <div
      v-else-if="!patientStore.isLoading"
      class="state-container"
    >
      <span class="state-title">ยังไม่มีผู้ป่วยที่กำลังรับการรักษา</span>
      <span class="state-sub">ไปที่หน้าคัดกรองเพื่อลงทะเบียนผู้ป่วย</span>
    </div>

  </div>
</template>

<style scoped>
/* ── Page root ──────────────────────────────────────────────────────── */
.view-root {
  padding: 32px 32px 48px;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
  gap: 16px;
}

.header-left h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.header-left p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.header-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: var(--border);
  padding: 7px 13px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-bg-alt);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: var(--border);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s;
}

.btn-export:hover {
  background: var(--color-bg-alt);
}

/* ── Quick stats strip ──────────────────────────────────────────────── */
.quick-stats {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 24px;
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.qs-item {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.qs-divider {
  width: 1px;
  height: 40px;
  background: rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.qs-value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.75px;
  line-height: 1;
  color: var(--color-text);
}

.qs-orange { color: var(--color-orange); }
.qs-teal   { color: var(--color-teal);   }
.qs-red    { color: var(--color-orange); }

.qs-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* ── Report cards grid ──────────────────────────────────────────────── */
.report-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.report-card {
  position: relative;
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 18px;
  cursor: pointer;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  transition: box-shadow 0.15s, border-color 0.15s, background 0.15s;
}

.report-card:hover {
  box-shadow:
    rgba(0, 0, 0, 0.08) 0px 6px 24px,
    rgba(0, 0, 0, 0.04) 0px 2px 6px;
}

.card-active {
  border-color: var(--color-blue);
  background: var(--color-badge-bg);
}

.card-unavailable {
  cursor: default;
}

.card-unavailable:hover {
  box-shadow: var(--shadow-card);
}

/* Icon container */
.report-card-icon {
  padding: 8px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Card body */
.report-card-body {
  flex: 1;
  min-width: 0;
}

.report-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 6px;
  letter-spacing: -0.1px;
}

.report-value {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.75px;
  line-height: 1;
  margin-bottom: 5px;
}

.report-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 3px;
  line-height: 1.4;
}

.report-desc {
  font-size: 11px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* "Coming soon" badge */
.coming-soon-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-pill);
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 2px 7px;
  letter-spacing: 0.2px;
}

/* ── Report table card ───────────────────────────────────────────────── */
.report-table-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.table-header {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: var(--border);
}

.table-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.1px;
}

.table-count {
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}

.table-scroll {
  overflow-x: auto;
}

/* ── Data table ─────────────────────────────────────────────────────── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  padding: 9px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-alt);
  white-space: nowrap;
  border-bottom: var(--border);
}

.data-table td {
  padding: 10px 14px;
  border-bottom: var(--border);
  vertical-align: middle;
  color: var(--color-text);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--color-bg-alt);
}

/* Row highlight for overdue patients */
.row-overdue td:first-child {
  border-left: 3px solid var(--color-orange);
}

.col-center {
  text-align: center;
}

/* ── Table cell styles ──────────────────────────────────────────────── */
.mono {
  font-family: monospace;
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.patient-name {
  font-weight: 500;
}

.regimen-tag {
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 2px 7px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.phase-intensive {
  background: rgba(221, 91, 0, 0.1);
  color: #dd5b00;
}

.phase-continuation {
  background: rgba(42, 157, 153, 0.1);
  color: #2a9d99;
}

.month-progress {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.month-sep {
  color: var(--color-text-muted);
  font-weight: 400;
  margin: 0 1px;
}

.overdue-cell {
  color: var(--color-orange);
  font-weight: 600;
}

.muted-dash {
  color: var(--color-text-muted);
}

/* ── Alert pills ────────────────────────────────────────────────────── */
.alert-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.alert-red    { background: rgba(221, 91, 0, 0.1);    color: #dd5b00; }
.alert-yellow { background: rgba(245, 166, 35, 0.1);  color: #c78b00; }
.alert-ok     { background: rgba(26, 174, 57, 0.1);   color: #1aae39; }

/* ── State containers ───────────────────────────────────────────────── */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 200px;
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  padding: 48px 32px;
}

.loading-icon {
  color: var(--color-blue);
  opacity: 0.6;
}

.error-icon {
  color: var(--color-orange);
  opacity: 0.5;
}

.state-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.state-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 360px;
  text-align: center;
}

.retry-btn {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  padding: 7px 16px;
  background: var(--color-blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background 0.13s;
}

.retry-btn:hover {
  background: var(--color-blue-active);
}

/* ── Spin animation ─────────────────────────────────────────────────── */
.spin {
  animation: spin 0.85s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>