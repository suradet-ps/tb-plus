<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAlertStore } from '@/stores/alerts';
import { usePatientStore } from '@/stores/patient';
import type { ActivePatientRow } from '@/types/patient';
import type { TreatmentPlan } from '@/types/treatment';

const router = useRouter();
const patientStore = usePatientStore();
const alertStore = useAlertStore();

onMounted(() => {
  patientStore.fetchActivePatients();
});

type SortKey = 'alert' | 'month' | 'name' | 'hn';
const sortBy = ref<SortKey>('alert');
const sortAsc = ref(false);

function alertWeight(row: ActivePatientRow): number {
  if (row.alerts.some((a) => a.severity === 'red')) return 0;
  if (row.alerts.some((a) => a.severity === 'yellow')) return 1;
  return 2;
}

const sortedPatients = computed<ActivePatientRow[]>(() => {
  const list = [...patientStore.activePatients];
  const dir = sortAsc.value ? 1 : -1;
  list.sort((a, b) => {
    let cmp = 0;
    switch (sortBy.value) {
      case 'hn':
        cmp = a.tb_patient.hn.localeCompare(b.tb_patient.hn);
        break;
      case 'month':
        cmp = (a.current_month ?? 0) - (b.current_month ?? 0);
        break;
      case 'name':
        cmp = (a.demographics?.full_name ?? a.tb_patient.hn).localeCompare(
          b.demographics?.full_name ?? b.tb_patient.hn,
          'th',
        );
        break;
      default:
        cmp = alertWeight(a) - alertWeight(b);
        break;
    }
    return cmp * dir;
  });
  return list;
});

const searchQuery = ref('');

const filteredPatients = computed<ActivePatientRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return sortedPatients.value;
  return sortedPatients.value.filter((p) => {
    const hn = p.tb_patient.hn.toLowerCase();
    const name = (p.demographics?.full_name ?? '').toLowerCase();
    return hn.includes(q) || name.includes(q);
  });
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

const statsTotal = computed(() => patientStore.activePatients.length);
const statsRedAlerts = computed(() => alertStore.redCount);
const statsYellowAlerts = computed(() => alertStore.yellowAlerts.length);

const statsIntensive = computed(
  () =>
    patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'intensive')
      .length,
);
const statsContinuation = computed(
  () =>
    patientStore.activePatients.filter((p) => getEffectivePhase(p.current_plan) === 'continuation')
      .length,
);

const isInitialLoad = computed(
  () => patientStore.isLoading && patientStore.activePatients.length === 0,
);

function viewDetail(hn: string) {
  router.push(`/patient/${hn}`);
}

function toggleSort(key: SortKey) {
  if (sortBy.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = key;
    sortAsc.value = key === 'name' || key === 'hn';
  }
}

function sortIcon(key: SortKey): string {
  if (sortBy.value !== key) return '';
  return sortAsc.value ? '↑' : '↓';
}
</script>

<template>
  <div class="view-root">
    <div class="view-header">
      <div class="header-left">
        <h1 class="header-title">ผู้ป่วยในการรักษา</h1>
        <p class="header-sub">
          ผู้ป่วย TB ที่กำลังรับการรักษาทั้งหมด
          <strong>{{ statsTotal }}</strong> ราย
        </p>
      </div>
      <div class="header-right">
        <button
          class="btn-ghost"
          @click="patientStore.fetchActivePatients()"
          :disabled="patientStore.isLoading"
          title="รีเฟรชข้อมูล"
        >
          <Loader2 v-if="patientStore.isLoading" :size="14" class="spin" />
          <RefreshCw v-else :size="14" />
          รีเฟรช
        </button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-blue"><Users :size="15" /></div>
        <div class="stat-body">
          <div class="stat-num">{{ statsTotal }}</div>
          <div class="stat-label">ผู้ป่วยทั้งหมด</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-orange"><Activity :size="15" /></div>
        <div class="stat-body">
          <div class="stat-num stat-num-orange">{{ statsIntensive }}</div>
          <div class="stat-label">ระยะเข้มข้น</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-teal"><Activity :size="15" /></div>
        <div class="stat-body">
          <div class="stat-num stat-num-teal">{{ statsContinuation }}</div>
          <div class="stat-label">ระยะต่อเนื่อง</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon-wrap stat-icon-alert"><AlertTriangle :size="15" /></div>
        <div class="stat-body">
          <div class="stat-num-group">
            <span v-if="statsRedAlerts > 0" class="stat-num stat-num-red">{{ statsRedAlerts }}</span>
            <span v-if="statsRedAlerts > 0 && statsYellowAlerts > 0" class="stat-divider">/</span>
            <span v-if="statsYellowAlerts > 0" class="stat-num stat-num-yellow">{{ statsYellowAlerts }}</span>
            <span v-if="statsRedAlerts === 0 && statsYellowAlerts === 0" class="stat-num stat-num-ok">0</span>
          </div>
          <div class="stat-label">การแจ้งเตือน</div>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-wrap">
        <Search :size="14" class="search-icon" />
        <input v-model="searchQuery" class="search-input" placeholder="ค้นหา HN หรือชื่อผู้ป่วย..." />
      </div>
      <div v-if="searchQuery.trim()" class="search-count">
        แสดง <strong>{{ filteredPatients.length }}</strong> จาก {{ sortedPatients.length }} ราย
      </div>
    </div>

    <div v-if="isInitialLoad" class="state-container">
      <div class="loading-state">
        <Loader2 :size="28" class="spin loading-icon" />
        <span class="state-title">กำลังโหลดข้อมูล...</span>
      </div>
    </div>

    <div v-else-if="!patientStore.isLoading && patientStore.activePatients.length === 0" class="state-container">
      <div class="empty-state">
        <CheckCircle :size="44" class="empty-icon" />
        <span class="state-title">ยังไม่มีผู้ป่วยที่กำลังรับการรักษา</span>
        <span class="state-sub">ไปที่หน้าคัดกรองเพื่อลงทะเบียนผู้ป่วย</span>
        <RouterLink to="/screening" class="empty-cta">ไปที่การคัดกรอง</RouterLink>
      </div>
    </div>

    <div v-else-if="patientStore.error && patientStore.activePatients.length === 0" class="state-container">
      <div class="error-state">
        <AlertTriangle :size="44" class="error-icon" />
        <span class="state-title">ไม่สามารถโหลดข้อมูลได้</span>
        <span class="state-sub">{{ patientStore.error }}</span>
        <button class="empty-cta" @click="patientStore.fetchActivePatients()">ลองใหม่</button>
      </div>
    </div>

    <div v-else class="table-wrap">
      <p v-if="filteredPatients.length === 0 && searchQuery.trim()" class="search-empty">
        ไม่พบผู้ป่วยที่ตรงกับการค้นหา
      </p>

      <table v-else class="patient-table">
        <thead>
          <tr>
            <th class="th-hn sortable" @click="toggleSort('hn')">HN {{ sortIcon('hn') }}</th>
            <th class="th-name sortable" @click="toggleSort('name')">ชื่อ-สกุล {{ sortIcon('name') }}</th>
            <th class="th-regimen">สูตรยา</th>
            <th class="th-phase">Phase</th>
            <th class="th-month sortable" @click="toggleSort('month')">เดือนที่ {{ sortIcon('month') }}</th>
            <th class="th-last">รับยาล่าสุด</th>
            <th class="th-action">รายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filteredPatients"
            :key="p.tb_patient.hn"
            class="patient-row"
            :class="{
              'row--red': p.alerts.some(a => a.severity === 'red'),
              'row--yellow': p.alerts.some(a => a.severity === 'yellow'),
            }"
          >
            <td class="td-hn">{{ p.tb_patient.hn }}</td>
            <td class="td-name">
              <span class="patient-name">{{ p.demographics?.full_name ?? p.tb_patient.hn }}</span>
              <span v-if="p.demographics?.age" class="patient-age">อายุ {{ p.demographics.age }} ปี</span>
            </td>
            <td class="td-regimen">
              <span v-if="p.current_plan" class="regimen-text">{{ p.current_plan.regimen }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td class="td-phase">
              <span
                v-if="getEffectivePhase(p.current_plan)"
                class="phase-pill"
                :class="getEffectivePhase(p.current_plan) === 'intensive' ? 'phase-intensive' : 'phase-continuation'"
              >
                {{ getEffectivePhase(p.current_plan) === 'intensive' ? 'Intensive' : 'Continuation' }}
              </span>
              <span v-else class="muted">—</span>
            </td>
            <td class="td-month">
              <template v-if="p.current_month && p.total_months">
                <span class="month-text">{{ p.current_month }} / {{ p.total_months }}</span>
                <div class="progress-track">
                  <div class="progress-fill" :style="{ width: Math.min(100, (p.current_month / p.total_months) * 100) + '%' }"></div>
                </div>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td class="td-last">
              <template v-if="p.days_since_last_dispensing != null">
                <span
                  class="days-badge"
                  :class="{
                    'days-ok': p.days_since_last_dispensing <= 35,
                    'days-warn': p.days_since_last_dispensing > 35 && p.days_since_last_dispensing <= 60,
                    'days-over': p.days_since_last_dispensing > 60,
                  }"
                >
                  {{ p.days_since_last_dispensing }} วัน
                </span>
              </template>
              <span v-else class="muted">—</span>
            </td>
            <td class="td-action">
              <button class="btn-detail-icon" @click="viewDetail(p.tb_patient.hn)" title="ดูรายละเอียด">
                <Eye :size="15" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.view-root { padding: 32px 32px 48px; max-width: 1440px; }

.view-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; gap: 16px; }
.header-title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; margin: 0 0 4px; }
.header-sub { font-size: 14px; color: var(--color-text-secondary); margin: 0; }
.header-sub strong { font-weight: 700; color: var(--color-text); }
.header-right { flex-shrink: 0; }

.btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1px solid rgba(0,0,0,0.15);
  padding: 7px 13px; font-size: 13px; font-weight: 600;
  font-family: var(--font); cursor: pointer; border-radius: var(--radius-sm);
  color: var(--color-text-secondary); transition: background 0.15s, border-color 0.15s;
}
.btn-ghost:hover:not(:disabled) { background: var(--color-bg-alt); border-color: rgba(0,0,0,0.22); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.stats-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.stat-card {
  background: var(--color-bg); border: var(--border);
  border-radius: var(--radius-card); padding: 14px 18px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: var(--shadow-card); min-width: 140px;
}
.stat-icon-wrap { width: 32px; height: 32px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon-blue { background: rgba(0,117,222,0.1); color: var(--color-blue); }
.stat-icon-orange { background: rgba(221,91,0,0.1); color: var(--color-orange); }
.stat-icon-teal { background: rgba(42,157,153,0.1); color: var(--color-teal); }
.stat-icon-alert { background: rgba(245,166,35,0.1); color: #c78b00; }
.stat-body { display: flex; flex-direction: column; gap: 2px; }
.stat-num { font-size: 24px; font-weight: 700; line-height: 1; letter-spacing: -0.5px; color: var(--color-text); }
.stat-num-group { display: flex; align-items: baseline; gap: 4px; line-height: 1; }
.stat-num-group .stat-num { font-size: 22px; }
.stat-divider { font-size: 16px; font-weight: 400; color: var(--color-text-muted); }
.stat-num-orange { color: var(--color-orange); }
.stat-num-teal { color: var(--color-teal); }
.stat-num-red { color: #dd5b00; }
.stat-num-yellow { color: #c78b00; }
.stat-num-ok { color: var(--color-text-muted); }
.stat-label { font-size: 12px; color: var(--color-text-muted); margin-top: 1px; }

.toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.search-wrap {
  display: flex; align-items: center; gap: 7px;
  background: #fff; border: 1px solid #ddd; border-radius: 4px;
  padding: 6px 10px; transition: border-color 0.15s, box-shadow 0.15s;
}
.search-wrap:focus-within { border-color: #097fe8; box-shadow: 0 0 0 3px rgba(9,127,232,0.15); }
.search-icon { color: #a39e98; flex-shrink: 0; }
.search-input { border: none; outline: none; background: transparent; font-family: var(--font); font-size: 13px; font-weight: 500; color: var(--color-text); width: 240px; }
.search-input::placeholder { color: #a39e98; }
.search-count { font-size: 12px; color: var(--color-text-muted); }

.table-wrap { overflow-x: auto; }
.patient-table { width: 100%; border-collapse: collapse; border: var(--border); border-radius: var(--radius-card); overflow: hidden; box-shadow: var(--shadow-card); }

thead { background: var(--color-bg-alt); }
th {
  padding: 10px 12px; font-size: 11px; font-weight: 700;
  color: var(--color-text-muted); text-transform: uppercase;
  letter-spacing: 0.4px; text-align: left; white-space: nowrap;
  border-bottom: var(--border);
}
th.sortable { cursor: pointer; user-select: none; }
th.sortable:hover { color: var(--color-text); }

td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid rgba(0,0,0,0.05); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }

.patient-row { transition: background 0.1s; }
.patient-row:hover { background: rgba(0,0,0,0.02); }
.row--red { background: rgba(221,91,0,0.04); }
.row--yellow { background: rgba(199,139,0,0.03); }

.th-hn { width: 90px; }
.th-name { min-width: 180px; }
.th-regimen { width: 120px; }
.th-phase { width: 120px; }
.th-month { width: 120px; }
.th-last { width: 100px; }
.th-action { width: 130px; text-align: center; }

.td-hn { font-family: monospace; font-weight: 600; color: var(--color-text); }
.td-name { display: flex; flex-direction: column; gap: 2px; }
.patient-name { font-weight: 600; color: var(--color-text); }
.patient-age { font-size: 12px; color: var(--color-text-muted); }
.regimen-text { font-family: 'SF Mono', 'Roboto Mono', monospace; font-weight: 600; font-size: 12px; }
.muted { color: var(--color-text-muted); font-size: 12px; }

.phase-pill {
  display: inline-block; padding: 3px 10px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700; letter-spacing: 0.2px;
}
.phase-intensive { background: rgba(221,91,0,0.1); color: var(--color-orange); }
.phase-continuation { background: rgba(42,157,153,0.1); color: var(--color-teal); }

.td-month { min-width: 110px; }
.month-text { font-weight: 600; font-size: 12px; color: var(--color-text); display: block; margin-bottom: 4px; }
.progress-track {
  width: 100%; height: 4px; background: var(--color-bg-alt);
  border-radius: var(--radius-pill); overflow: hidden;
}
.progress-fill { height: 100%; background: var(--color-blue); border-radius: var(--radius-pill); transition: width 0.3s; }

.days-badge {
  display: inline-block; padding: 2px 8px; border-radius: var(--radius-pill);
  font-size: 11px; font-weight: 700;
}
.days-ok { background: rgba(26,174,57,0.1); color: var(--color-green); }
.days-warn { background: rgba(221,91,0,0.1); color: var(--color-orange); }
.days-over { background: rgba(185,28,28,0.1); color: #b91c1c; }

.td-action { text-align: center; }
.btn-detail-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: none; background: var(--color-blue); color: #fff;
  cursor: pointer; transition: background 0.13s;
}
.btn-detail-icon:hover { background: var(--color-blue-active); }

.state-container { display: flex; align-items: center; justify-content: center; min-height: 400px; }
.loading-state, .empty-state, .error-state { display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--color-text-muted); text-align: center; }
.loading-icon { color: var(--color-blue); opacity: 0.7; margin-bottom: 4px; }
.empty-icon { color: var(--color-teal); opacity: 0.25; margin-bottom: 4px; }
.error-icon { color: var(--color-orange); opacity: 0.4; margin-bottom: 4px; }
.state-title { font-size: 15px; font-weight: 600; color: var(--color-text-secondary); }
.state-sub { font-size: 13px; color: var(--color-text-muted); max-width: 320px; }
.empty-cta {
  margin-top: 6px; display: inline-flex; align-items: center;
  padding: 7px 16px; background: var(--color-blue); color: #fff;
  border: none; border-radius: var(--radius-sm); font-size: 13px;
  font-weight: 600; font-family: var(--font); cursor: pointer;
  text-decoration: none; transition: background 0.15s;
}
.empty-cta:hover { background: var(--color-blue-active); }

.search-empty { text-align: center; padding: 56px 16px; font-size: 14px; color: var(--color-text-muted); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
