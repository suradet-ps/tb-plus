<script setup lang="ts">
import {
  AlertTriangle,
  Calendar,
  Clock,
  Download,
  Loader2,
  Pill,
  RefreshCw,
  TrendingUp,
  Users,
} from '@lucide/vue';
import { invoke } from '@tauri-apps/api/core';
import { computed, onMounted, ref } from 'vue';
import { useAlertStore } from '@/stores/alerts';
import { usePatientStore } from '@/stores/patient';
import type { DrugConsumptionRow } from '@/types/reports';
import type { TreatmentPlan } from '@/types/treatment';

const patientStore = usePatientStore();
const alertStore = useAlertStore();

const activeReport = ref<string | null>(null);

const drugConsumption = ref<DrugConsumptionRow[]>([]);
const isLoadingDrugConsumption = ref(false);

const cohortViewMonth = ref<string | null>(null);

onMounted(() => {
  patientStore.fetchActivePatients();
  patientStore.fetchDischargedPatients();
  alertStore.refresh();
});

function getEffectivePhase(
  plan: TreatmentPlan | null | undefined,
): 'intensive' | 'continuation' | null {
  if (!plan) return null;
  if (plan.phase === 'intensive' && plan.phase_end_expected) {
    if (new Date() > new Date(plan.phase_end_expected)) return 'continuation';
  }
  return plan.phase as 'intensive' | 'continuation';
}

// -- Derived stats --
const totalActive = computed(() => patientStore.activePatients.length);

const intensiveCount = computed(
  () =>
    patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'intensive')
      .length,
);

const continuationCount = computed(
  () =>
    patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'continuation')
      .length,
);

const overdueCount = computed(
  () => patientStore.activePatients.filter((p) => (p.days_since_last_dispensing ?? 0) > 35).length,
);

const lostCount = computed(
  () => patientStore.activePatients.filter((p) => (p.days_since_last_dispensing ?? 0) > 60).length,
);

// -- Success rate --
const dischargeStatuses = computed(() => {
  const m = { success: 0, failure: 0, other: 0 };
  for (const p of patientStore.dischargedPatients) {
    const ov = p.outcome_value;
    if (ov === 'cured' || ov === 'treatment_completed') m.success++;
    else if (ov === 'treatment_failed' || ov === 'died' || ov === 'lost_to_followup') m.failure++;
    else m.other++;
  }
  return m;
});

const totalDischarged = computed(() => patientStore.dischargedPatients.length);
const successRate = computed(() => {
  const total = totalDischarged.value;
  if (total === 0) return null;
  return Math.round((dischargeStatuses.value.success / total) * 100);
});

// -- E overrun patients --
const eOverrunPatients = computed(() =>
  patientStore.activePatients.filter((p) =>
    p.alerts.some((a) => a.alert_type === 'ethambutol_overrun'),
  ),
);

// -- Overdue / lost patients --
const overduePatients = computed(() =>
  patientStore.activePatients.filter((p) => {
    const d = p.days_since_last_dispensing ?? 0;
    return d > 35 && d <= 60;
  }),
);

const lostPatientsList = computed(() =>
  patientStore.activePatients.filter((p) => (p.days_since_last_dispensing ?? 0) > 60),
);

// -- Cohort data --
const allEnrolled = computed(() => [
  ...patientStore.activePatients.map((p) => ({
    hn: p.tb_patient.hn,
    name: p.demographics?.full_name ?? p.tb_patient.hn,
    enrolled_at: p.tb_patient.enrolled_at,
    status: p.tb_patient.status,
    outcome: null as string | null,
  })),
  ...patientStore.dischargedPatients.map((p) => ({
    hn: p.tb_patient.hn,
    name: p.demographics?.full_name ?? p.tb_patient.hn,
    enrolled_at: p.tb_patient.enrolled_at,
    status: p.tb_patient.status,
    outcome: p.outcome_value,
  })),
]);

const cohortGroups = computed(() => {
  const groups = new Map<
    string,
    { total: number; active: number; success: number; failure: number }
  >();
  for (const p of allEnrolled.value) {
    const month = p.enrolled_at.slice(0, 7);
    let g = groups.get(month);
    if (!g) {
      g = { total: 0, active: 0, success: 0, failure: 0 };
      groups.set(month, g);
    }
    g.total++;
    if (p.status === 'active') g.active++;
    else if (p.outcome === 'cured' || p.outcome === 'treatment_completed') g.success++;
    else if (
      p.outcome === 'treatment_failed' ||
      p.outcome === 'died' ||
      p.outcome === 'lost_to_followup'
    )
      g.failure++;
  }
  return Array.from(groups.entries())
    .map(([month, counts]) => ({
      month,
      ...counts,
      success_rate: counts.total > 0 ? Math.round((counts.success / counts.total) * 100) : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
});

const cohortDetailPatients = computed(() => {
  const month = cohortViewMonth.value;
  if (!month) return [];
  return allEnrolled.value
    .filter((p) => p.enrolled_at.startsWith(month))
    .sort((a, b) => a.name.localeCompare(b.name));
});

// -- Drug consumption --
async function fetchDrugConsumption() {
  if (drugConsumption.value.length > 0) return;
  isLoadingDrugConsumption.value = true;
  try {
    drugConsumption.value = await invoke<DrugConsumptionRow[]>('get_drug_consumption', {
      monthsBack: 12,
    });
  } catch {
    drugConsumption.value = [];
  } finally {
    isLoadingDrugConsumption.value = false;
  }
}

const drugConsumptionByMonth = computed(() => {
  const map = new Map<string, DrugConsumptionRow[]>();
  for (const row of drugConsumption.value) {
    let arr = map.get(row.month);
    if (!arr) {
      arr = [];
      map.set(row.month, arr);
    }
    arr.push(row);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
});

// -- Toggle report --
function toggleReport(id: string) {
  if (activeReport.value === id) {
    activeReport.value = null;
    return;
  }
  activeReport.value = id;
  if (id === 'drug-consumption') fetchDrugConsumption();
  if (id === 'monthly-cohort') cohortViewMonth.value = null;
}

// -- Report cards --
interface ReportCard {
  id: string;
  titleTh: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  valueColor: string;
  value: string | number;
  label: string;
  description: string;
}

const reportCards = computed<ReportCard[]>(() => [
  {
    id: 'census',
    titleTh: 'สถิติผู้ป่วย',
    icon: 'Users',
    iconColor: 'var(--color-accent)',
    iconBg: 'rgba(0,117,222,0.1)',
    valueColor: 'var(--color-accent)',
    value: totalActive.value,
    label: 'ผู้ป่วยทั้งหมด (active)',
    description: 'จำนวนผู้ป่วยแบ่งตามสถานะและระยะการรักษา',
  },
  {
    id: 'success-rate',
    titleTh: 'อัตราความสำเร็จ',
    icon: 'TrendingUp',
    iconColor: 'var(--color-info)',
    iconBg: 'rgba(42,157,153,0.1)',
    valueColor: 'var(--color-info)',
    value: successRate.value !== null ? `${successRate.value}%` : '-',
    label: `หาย + รักษาครบ / ทั้งหมด (${totalDischarged.value} ราย)`,
    description: 'อัตราสำเร็จในการรักษา (%)',
  },
  {
    id: 'drug-consumption',
    titleTh: 'การใช้ยา',
    icon: 'Pill',
    iconColor: 'var(--color-warning)',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: 'var(--color-warning)',
    value: drugConsumption.value.length > 0 ? drugConsumptionByMonth.value.length : '-',
    label:
      drugConsumption.value.length > 0
        ? `${drugConsumptionByMonth.value.length} เดือนล่าสุด`
        : 'รายการจ่ายยาต่อเดือน',
    description: 'ปริมาณยา TB ที่จ่ายไป แบ่งตามประเภทและเดือน',
  },
  {
    id: 'ethambutol-overrun',
    titleTh: 'E เกินกำหนด',
    icon: 'AlertTriangle',
    iconColor: 'var(--color-warning)',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: 'var(--color-warning)',
    value: eOverrunPatients.value.length,
    label: `ผู้ป่วยที่ได้รับ E เกินระยะ (${eOverrunPatients.value.length} ราย)`,
    description: 'รายชื่อผู้ป่วยที่ได้รับ Ethambutol เกินกำหนด',
  },
  {
    id: 'lost-followup',
    titleTh: 'ขาดการติดตาม',
    icon: 'Clock',
    iconColor: 'var(--color-warning)',
    iconBg: 'rgba(221,91,0,0.1)',
    valueColor: 'var(--color-warning)',
    value: overdueCount.value + lostCount.value,
    label: `เกินกำหนด ${overdueCount.value} · ขาดติดตาม ${lostCount.value}`,
    description: 'ผู้ป่วยที่ไม่ได้รับยานาน > 35 วัน (แจ้งเตือน) หรือ > 60 วัน (ขาดการติดตาม)',
  },
  {
    id: 'monthly-cohort',
    titleTh: 'Cohort รายเดือน',
    icon: 'Calendar',
    iconColor: 'var(--color-accent)',
    iconBg: 'rgba(0,117,222,0.1)',
    valueColor: 'var(--color-accent)',
    value: cohortGroups.value.length,
    label: `${cohortGroups.value.length} กลุ่มตามเดือนลงทะเบียน`,
    description: 'การวิเคราะห์ cohort แบ่งตามเดือนลงทะเบียน',
  },
]);

// -- CSV export --
function exportCSV() {
  const headers = ['HN', 'ชื่อ-สกุล', 'สูตรยา', 'Phase', 'เดือนที่', 'รับยาล่าสุด', 'สถานะการแจ้งเตือน'];

  const rows = patientStore.activePatients.map((p) => [
    p.tb_patient.hn,
    p.demographics?.full_name ?? '-',
    p.current_plan?.regimen ?? '-',
    getEffectivePhase(p.current_plan) === 'intensive'
      ? 'ระยะเข้มข้น'
      : getEffectivePhase(p.current_plan) === 'continuation'
        ? 'ระยะต่อเนื่อง'
        : '-',
    p.current_month !== null ? `${p.current_month}/${p.total_months ?? '?'}` : '-',
    p.days_since_last_dispensing !== null ? `${p.days_since_last_dispensing} วันที่แล้ว` : '-',
    p.alerts.some((a) => a.severity === 'red')
      ? 'แจ้งเตือนสีแดง'
      : p.alerts.length
        ? 'เฝ้าระวัง'
        : 'ปกติ',
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tb-plus-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="view-root">

    <!-- Page header -->
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
          @click="
            patientStore.fetchActivePatients();
            patientStore.fetchDischargedPatients();
            alertStore.refresh();
          "
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

    <!-- Quick stats strip -->
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

    <!-- Report cards grid -->
    <div class="report-grid">
      <div
        v-for="card in reportCards"
        :key="card.id"
        class="report-card"
        :class="{ 'card-active': activeReport === card.id }"
        :title="card.description"
        @click="toggleReport(card.id)"
      >
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

        <div class="report-card-body">
          <div class="report-title">{{ card.titleTh }}</div>
          <div
            class="report-value"
            :style="{ color: card.valueColor }"
          >
            {{ card.value }}
          </div>
          <div class="report-label">{{ card.label }}</div>
          <div class="report-desc">{{ card.description }}</div>
        </div>
      </div>
    </div>

    <!-- Expandable report detail sections -->

    <!-- Census detail -->
    <div v-if="activeReport === 'census'" class="report-detail">
      <div class="detail-header">
        <h3>รายละเอียดสถิติผู้ป่วย</h3>
      </div>
      <div class="detail-grid-4">
        <div class="stat-box">
          <span class="stat-val">{{ totalActive }}</span>
          <span class="stat-lbl">Active</span>
        </div>
        <div class="stat-box">
          <span class="stat-val stat-orange">{{ intensiveCount }}</span>
          <span class="stat-lbl">ระยะเข้มข้น</span>
        </div>
        <div class="stat-box">
          <span class="stat-val stat-teal">{{ continuationCount }}</span>
          <span class="stat-lbl">ระยะต่อเนื่อง</span>
        </div>
        <div class="stat-box">
          <span class="stat-val">
            {{ patientStore.dischargedPatients.length }}
          </span>
          <span class="stat-lbl">จำหน่ายแล้ว</span>
        </div>
      </div>

      <!-- TB type breakdown -->
      <div class="detail-subsection">
        <h4>แบ่งตามประเภทผู้ป่วย</h4>
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>ประเภท</th>
              <th class="col-center">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ปอด (Pulmonary)</td>
              <td class="col-center">
                {{ patientStore.activePatients.filter((p) => p.tb_patient.tb_type === 'pulmonary').length }}
              </td>
            </tr>
            <tr>
              <td>นอกปอด (Extra-pulmonary)</td>
              <td class="col-center">
                {{ patientStore.activePatients.filter((p) => p.tb_patient.tb_type === 'extra_pulmonary').length }}
              </td>
            </tr>
            <tr>
              <td>ไม่ระบุ</td>
              <td class="col-center">
                {{ patientStore.activePatients.filter((p) => !p.tb_patient.tb_type).length }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="detail-subsection">
        <h4>สถานะผู้ป่วยทั้งหมด (ตั้งแต่เริ่ม)</h4>
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>สถานะ</th>
              <th class="col-center">จำนวน</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Active (กำลังรักษา)</td><td class="col-center">{{ totalActive }}</td></tr>
            <tr><td>รักษาหาย (Cured)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'cured').length }}
              </td>
            </tr>
            <tr><td>รักษาครบ (Completed)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'treatment_completed').length }}
              </td>
            </tr>
            <tr><td>เสียชีวิต (Died)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'died').length }}
              </td>
            </tr>
            <tr><td>ขาดการติดตาม (Defaulted)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'lost_to_followup').length }}
              </td>
            </tr>
            <tr><td>ส่งต่อ (Transferred)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'transferred_out').length }}
              </td>
            </tr>
            <tr><td>รักษาล้มเหลว (Failed)</td>
              <td class="col-center">
                {{ patientStore.dischargedPatients.filter((p) => p.outcome_value === 'treatment_failed').length }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Success rate detail -->
    <div v-if="activeReport === 'success-rate'" class="report-detail">
      <div class="detail-header">
        <h3>อัตราความสำเร็จในการรักษา</h3>
      </div>
      <div class="detail-grid-4">
        <div class="stat-box">
          <span class="stat-val stat-teal">
            {{ successRate !== null ? `${successRate}%` : '-' }}
          </span>
          <span class="stat-lbl">อัตราสำเร็จ</span>
        </div>
        <div class="stat-box">
          <span class="stat-val stat-green">{{ dischargeStatuses.success }}</span>
          <span class="stat-lbl">สำเร็จ (Cured + Completed)</span>
        </div>
        <div class="stat-box">
          <span class="stat-val stat-orange">{{ dischargeStatuses.failure }}</span>
          <span class="stat-lbl">ล้มเหลว (Failed + Died + Defaulted)</span>
        </div>
        <div class="stat-box">
          <span class="stat-val">{{ totalDischarged }}</span>
          <span class="stat-lbl">จำหน่ายแล้วทั้งหมด</span>
        </div>
      </div>

      <div class="detail-subsection">
        <h4>รายชื่อผู้ป่วยที่จำหน่ายแล้ว</h4>
        <div v-if="patientStore.isLoadingDischarged" class="mini-loader">
          <Loader2 :size="16" class="spin" /> กำลังโหลด...
        </div>
        <div v-else-if="patientStore.dischargedPatients.length === 0" class="mini-empty">
          ยังไม่มีผู้ป่วยที่จำหน่าย
        </div>
        <div v-else class="table-scroll">
          <table class="data-table mini-table">
            <thead>
              <tr>
                <th>HN</th>
                <th>ชื่อ-สกุล</th>
                <th>ผลการรักษา</th>
                <th>วันที่จำหน่าย</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in patientStore.dischargedPatients"
                :key="p.tb_patient.hn"
              >
                <td class="mono">{{ p.tb_patient.hn }}</td>
                <td>{{ p.demographics?.full_name ?? '—' }}</td>
                <td>
                  <span
                    class="outcome-pill"
                    :class="{
                      'outcome-success': p.outcome_value === 'cured' || p.outcome_value === 'treatment_completed',
                      'outcome-fail': p.outcome_value === 'died' || p.outcome_value === 'treatment_failed',
                      'outcome-warn': p.outcome_value === 'lost_to_followup',
                      'outcome-info': p.outcome_value === 'transferred_out',
                    }"
                  >
                    {{ p.outcome_value ?? '—' }}
                  </span>
                </td>
                <td>{{ p.tb_patient.updated_at?.slice(0, 10) ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Drug consumption detail -->
    <div v-if="activeReport === 'drug-consumption'" class="report-detail">
      <div class="detail-header">
        <h3>ปริมาณการใช้ยา TB รายเดือน</h3>
      </div>

      <div v-if="isLoadingDrugConsumption" class="mini-loader">
        <Loader2 :size="16" class="spin" /> กำลังโหลด...
      </div>
      <div v-else-if="drugConsumption.length === 0" class="mini-empty">
        ไม่พบข้อมูลการใช้ยา (MySQL อาจไม่ได้เชื่อมต่อ)
      </div>
      <div v-else>
        <div
          v-for="[month, rows] in drugConsumptionByMonth"
          :key="month"
          class="month-group"
        >
          <h4 class="month-label">{{ month }}</h4>
          <table class="data-table mini-table">
            <thead>
              <tr>
                <th>กลุ่มยา</th>
                <th class="col-center">ปริมาณที่จ่าย</th>
                <th class="col-center">วันที่จ่าย</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.drug_class">
                <td>
                  <span class="drug-chip" :class="`drug-${r.drug_class.toLowerCase()}`">
                    {{ r.drug_class }}
                  </span>
                </td>
                <td class="col-center mono">{{ r.total_qty.toFixed(1) }}</td>
                <td class="col-center mono">{{ r.dispensed_days }} วัน</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Ethambutol overrun detail -->
    <div v-if="activeReport === 'ethambutol-overrun'" class="report-detail">
      <div class="detail-header">
        <h3>Ethambutol Overrun — ผู้ป่วยที่ได้รับ E เกินระยะ</h3>
      </div>

      <div v-if="eOverrunPatients.length === 0" class="mini-empty">
        ไม่มีผู้ป่วยที่ได้รับ Ethambutol เกินกำหนด
      </div>
      <div v-else class="table-scroll">
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
              <th>สูตรยา</th>
              <th class="col-center">เดือนที่</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in eOverrunPatients" :key="p.tb_patient.hn">
              <td class="mono">{{ p.tb_patient.hn }}</td>
              <td>{{ p.demographics?.full_name ?? '—' }}</td>
              <td>
                <span v-if="p.current_plan?.regimen" class="regimen-tag">
                  {{ p.current_plan.regimen }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>
              <td class="col-center">
                {{ p.current_month !== null ? `${p.current_month}/${p.total_months ?? '?'}` : '—' }}
              </td>
              <td>
                <span class="alert-pill alert-red" v-if="p.alerts.find(a => a.alert_type === 'ethambutol_overrun')?.details">
                  {{ p.alerts.find(a => a.alert_type === 'ethambutol_overrun')?.details }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Lost to follow-up detail -->
    <div v-if="activeReport === 'lost-followup'" class="report-detail">
      <div class="detail-header">
        <h3>ผู้ป่วยที่ไม่ได้รับยา</h3>
      </div>

      <div class="detail-grid-2">
        <div class="stat-box">
          <span class="stat-val stat-orange">{{ overdueCount }}</span>
          <span class="stat-lbl">เกินกำหนด (> 35 วัน)</span>
        </div>
        <div class="stat-box">
          <span class="stat-val stat-red">{{ lostCount }}</span>
          <span class="stat-lbl">ขาดติดตาม (> 60 วัน)</span>
        </div>
      </div>

      <div v-if="overduePatients.length > 0" class="detail-subsection">
        <h4>เกินกำหนด (35–60 วัน)</h4>
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
              <th>ไม่ได้รับยา</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in overduePatients" :key="p.tb_patient.hn">
              <td class="mono">{{ p.tb_patient.hn }}</td>
              <td>{{ p.demographics?.full_name ?? '—' }}</td>
              <td class="overdue-cell">{{ p.days_since_last_dispensing }} วัน</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="lostPatientsList.length > 0" class="detail-subsection">
        <h4>ขาดการติดตาม (> 60 วัน)</h4>
        <table class="data-table mini-table">
          <thead>
            <tr>
              <th>HN</th>
              <th>ชื่อ-สกุล</th>
              <th>ไม่ได้รับยา</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in lostPatientsList" :key="p.tb_patient.hn">
              <td class="mono">{{ p.tb_patient.hn }}</td>
              <td>{{ p.demographics?.full_name ?? '—' }}</td>
              <td class="overdue-cell overrun">{{ p.days_since_last_dispensing }} วัน</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Monthly cohort detail -->
    <div v-if="activeReport === 'monthly-cohort'" class="report-detail">
      <div class="detail-header">
        <h3>Cohort ตามเดือนที่ลงทะเบียน</h3>
      </div>

      <div v-if="cohortGroups.length === 0" class="mini-empty">
        ไม่มีข้อมูล cohort
      </div>
      <div v-else>
        <table class="data-table mini-table cohort-table">
          <thead>
            <tr>
              <th>เดือน</th>
              <th class="col-center">ทั้งหมด</th>
              <th class="col-center">กำลังรักษา</th>
              <th class="col-center">สำเร็จ</th>
              <th class="col-center">ล้มเหลว</th>
              <th class="col-center">อัตราสำเร็จ</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="g in cohortGroups"
              :key="g.month"
              :class="{ 'row-selected': cohortViewMonth === g.month }"
              @click="cohortViewMonth = cohortViewMonth === g.month ? null : g.month"
            >
              <td class="mono">{{ g.month }}</td>
              <td class="col-center">{{ g.total }}</td>
              <td class="col-center">{{ g.active }}</td>
              <td class="col-center stat-teal">{{ g.success }}</td>
              <td class="col-center stat-orange">{{ g.failure }}</td>
              <td class="col-center">
                <span
                  class="rate-pill"
                  :class="{
                    'rate-good': g.success_rate >= 80,
                    'rate-ok': g.success_rate >= 50 && g.success_rate < 80,
                    'rate-bad': g.success_rate < 50,
                  }"
                >
                  {{ g.success_rate }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Expanded patient list for selected cohort month -->
        <div v-if="cohortViewMonth && cohortDetailPatients.length > 0" class="detail-subsection">
          <h4>ผู้ป่วยในเดือน {{ cohortViewMonth }}</h4>
          <table class="data-table mini-table">
            <thead>
              <tr>
                <th>HN</th>
                <th>ชื่อ-สกุล</th>
                <th>สถานะ</th>
                <th>ผลการรักษา</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in cohortDetailPatients" :key="p.hn">
                <td class="mono">{{ p.hn }}</td>
                <td>{{ p.name }}</td>
                <td>
                  <span class="status-pill" :class="`status-${p.status}`">
                    {{ p.status === 'active' ? 'กำลังรักษา' : p.status }}
                  </span>
                </td>
                <td>{{ p.outcome ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="patientStore.isLoading && patientStore.activePatients.length === 0" class="state-container">
      <Loader2 :size="28" class="spin loading-icon" />
      <span class="state-title">กำลังโหลดข้อมูล...</span>
    </div>

    <!-- Error state -->
    <div
      v-else-if="patientStore.error && patientStore.activePatients.length === 0"
      class="state-container"
    >
      <AlertTriangle :size="32" class="error-icon" />
      <span class="state-title">ไม่สามารถโหลดข้อมูลได้</span>
      <span class="state-sub">{{ patientStore.error }}</span>
      <button class="retry-btn" @click="patientStore.fetchActivePatients()">ลองใหม่</button>
    </div>

    <!-- Active patients table -->
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
              <td class="mono">{{ p.tb_patient.hn }}</td>
              <td>
                <span class="patient-name">
                  {{ p.demographics?.full_name ?? '—' }}
                </span>
              </td>
              <td>
                <span v-if="p.current_plan?.regimen" class="regimen-tag">
                  {{ p.current_plan.regimen }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>
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
              <td class="col-center">
                <span v-if="p.current_month !== null" class="month-progress">
                  {{ p.current_month }}<span class="month-sep">/</span>{{ p.total_months ?? '?' }}
                </span>
                <span v-else class="muted-dash">—</span>
              </td>
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

    <!-- Empty state -->
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
/* -- Page root -- */
.view-root {
  padding: var(--page-root-padding);
}

/* -- Header -- */
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-12);
  gap: var(--space-8);
}

.header-left h1 {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.header-left p {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  margin: 0;
}

.header-right {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  flex-shrink: 0;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  border: var(--border-standard);
  padding: 7px 13px;
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface-alt);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  border: var(--border-standard);
  padding: var(--btn-padding);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s;
}

.btn-export:hover {
  background: var(--color-surface-alt);
}

/* -- Quick stats strip -- */
.quick-stats {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: var(--space-12);
  background: var(--color-surface);
  border: var(--border-standard);
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
  background: var(--tint-active);
  flex-shrink: 0;
}

.qs-value {
  font-size: var(--text-display-lg);
  font-weight: var(--weight-heading);
  letter-spacing: -0.75px;
  line-height: 1;
  color: var(--color-text);
}

.qs-orange { color: var(--color-orange); }
.qs-teal   { color: var(--color-teal);   }
.qs-red    { color: var(--color-orange); }

.qs-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* -- Report cards grid -- */
.report-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.report-card {
  position: relative;
  background: var(--color-surface);
  border: var(--border-standard);
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
    var(--tint-active) 0px 6px 24px,
    rgba(0, 0, 0, 0.04) 0px 2px 6px;
}

.card-active {
  border-color: var(--color-blue);
  background: var(--color-badge-bg);
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

.report-card-body {
  flex: 1;
  min-width: 0;
}

.report-title {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  margin-bottom: 6px;
  letter-spacing: -0.1px;
}

.report-value {
  font-size: var(--text-display-lg);
  font-weight: var(--weight-heading);
  letter-spacing: -0.75px;
  line-height: 1;
  margin-bottom: 5px;
}

.report-label {
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
  margin-bottom: 3px;
  line-height: var(--leading-normal);
}

.report-desc {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
  line-height: var(--leading-normal);
}

/* -- Expandable report details -- */
.report-detail {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: var(--filter-card-padding);
  margin-bottom: 28px;
}

.detail-header {
  margin-bottom: 18px;
}

.detail-header h3 {
  font-size: var(--text-ui);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.15px;
}

.detail-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
  margin-bottom: 20px;
}

.detail-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
  margin-bottom: 20px;
}

.stat-box {
  background: var(--color-badge-bg);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-val {
  font-size: var(--text-display);
  font-weight: var(--weight-heading);
  letter-spacing: -0.5px;
  line-height: 1;
  color: var(--color-text);
}

.stat-lbl {
  font-size: var(--text-caption);
  color: var(--color-text-muted);
}

.stat-orange { color: var(--color-orange); }
.stat-teal   { color: var(--color-teal); }
.stat-green  { color: var(--color-success); }
.stat-red    { color: var(--color-orange); }

.detail-subsection {
  margin-top: 20px;
}

.detail-subsection h4 {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  margin: 0 0 10px;
  letter-spacing: -0.1px;
}

.mini-loader {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  padding: 24px 0;
}

.mini-empty {
  text-align: center;
  padding: 32px 0;
  font-size: var(--text-body-sm);
  color: var(--color-text-muted);
}

/* Mini table variant — higher specificity to override .data-table defaults */
.data-table.mini-table {
  font-size: var(--text-sm);
}

.data-table.mini-table th {
  padding: 7px 12px;
  font-size: var(--text-sm);
  vertical-align: middle;
}

.data-table.mini-table td {
  padding: 7px 12px;
  font-size: var(--text-sm);
}

/* Month group in drug consumption */
.month-group {
  margin-bottom: 18px;
}

.month-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text-secondary);
  margin: 0 0 6px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

.drug-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: var(--weight-heading);
  letter-spacing: 0.3px;
}

.drug-h { background: var(--tint-blue); color: var(--color-accent); }
.drug-r { background: var(--status-defaulted-bg); color: var(--color-warning); }
.drug-e { background: var(--status-completed-bg); color: var(--color-info); }
.drug-z { background: var(--drug-Z-bg); color: var(--drug-Z); }

/* Outcome pill */
.outcome-pill {
  display: inline-flex;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
}

.outcome-success { background: var(--status-active-bg); color: var(--color-success); }
.outcome-fail    { background: var(--status-defaulted-bg); color: var(--color-warning); }
.outcome-warn    { background: rgba(245, 166, 35, 0.1); color: var(--color-alert-yellow); }
.outcome-info    { background: var(--tint-blue); color: var(--color-accent); }

/* Cohort table */
.cohort-table tbody tr {
  cursor: pointer;
}

.cohort-table tbody tr:hover {
  background: var(--color-surface-alt);
}

.row-selected {
  background: var(--color-badge-bg) !important;
}

.rate-pill {
  display: inline-flex;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-heading);
}

.rate-good { background: var(--status-active-bg); color: var(--color-success); }
.rate-ok   { background: rgba(245, 166, 35, 0.1); color: var(--color-alert-yellow); }
.rate-bad  { background: var(--status-defaulted-bg); color: var(--color-warning); }

/* Status pill */
.status-pill {
  display: inline-flex;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
}

.status-active      { background: var(--tint-blue); color: var(--color-accent); }
.status-completed   { background: var(--status-active-bg); color: var(--color-success); }
.status-died        { background: var(--status-defaulted-bg); color: var(--color-warning); }
.status-defaulted   { background: var(--status-defaulted-bg); color: var(--color-warning); }
.status-transferred { background: var(--tint-blue); color: var(--color-accent); }

/* -- Report table card -- */
.report-table-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.table-header {
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: var(--border-standard);
}

.table-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-header h3 {
  font-size: var(--text-body);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.1px;
}

.table-count {
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
}

.table-scroll {
  overflow-x: auto;
}

/* -- Data table -- */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-sm);
}

.data-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  background: var(--color-surface-alt);
  white-space: nowrap;
  border-bottom: var(--border-standard);
  vertical-align: middle;
}

.data-table td {
  padding: 10px 14px;
  border-bottom: var(--border-standard);
  vertical-align: middle;
  color: var(--color-text);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.data-table tbody tr:hover {
  background: var(--color-surface-alt);
}

/* Row highlight for overdue patients */
.row-overdue td:first-child {
  border-left: 3px solid var(--color-orange);
}

.col-center {
  text-align: center;
}

/* Override .data-table th's text-align:left for centered columns */
.data-table th.col-center {
  text-align: center;
}

.data-table.mini-table th.col-center {
  text-align: center;
}

/* -- Table cell styles -- */
.mono {
  font-family: var(--font-family-mono-simple);
  font-weight: var(--weight-emphasis);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.patient-name {
  font-weight: var(--weight-ui);
}

.regimen-tag {
  background: var(--color-surface-alt);
  border: var(--border-standard);
  border-radius: var(--radius-sm);
  padding: 2px 7px;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.phase-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.phase-intensive {
  background: var(--status-defaulted-bg);
  color: var(--color-warning);
}

.phase-continuation {
  background: var(--status-completed-bg);
  color: var(--color-info);
}

.month-progress {
  font-variant-numeric: tabular-nums;
  font-weight: var(--weight-emphasis);
}

.month-sep {
  color: var(--color-text-muted);
  font-weight: var(--weight-body);
  margin: 0 1px;
}

.overdue-cell {
  color: var(--color-orange);
  font-weight: var(--weight-emphasis);
}

.overdue-cell.overrun {
  color: var(--palette-red-mid);
}

.muted-dash {
  color: var(--color-text-muted);
}

/* -- Alert pills -- */
.alert-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  white-space: nowrap;
}

.alert-red    { background: var(--status-defaulted-bg);    color: var(--color-warning); }
.alert-yellow { background: rgba(245, 166, 35, 0.1);  color: var(--color-alert-yellow); }
.alert-ok     { background: var(--status-active-bg);   color: var(--color-success); }

/* -- State containers -- */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 200px;
  background: var(--color-surface);
  border: var(--border-standard);
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
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
}

.state-sub {
  font-size: var(--text-body-sm);
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
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  transition: background 0.13s;
}

.retry-btn:hover {
  background: var(--color-blue-active);
}

/* -- Spin animation -- */
.spin {
  animation: spin 0.85s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
