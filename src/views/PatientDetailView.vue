<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  PlusCircle,
  LogOut,
  Loader2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Phone,
  Calendar,
  UserCheck,
} from 'lucide-vue-next'
import TreatmentTimeline from '@/components/patient/TreatmentTimeline.vue'
import DispensingTable from '@/components/patient/DispensingTable.vue'
import FollowupList from '@/components/patient/FollowupList.vue'
import FollowupForm from '@/components/patient/FollowupForm.vue'
import SideEffectTracker from '@/components/patient/SideEffectTracker.vue'
import DischargeModal from '@/components/patient/DischargeModal.vue'
import StatusBadge from '@/components/shared/StatusBadge.vue'
import AlertBadge from '@/components/active/AlertBadge.vue'
import DrugChip from '@/components/shared/DrugChip.vue'
import { usePatientStore } from '@/stores/patient'
import { useAlertStore } from '@/stores/alerts'

// ── Props ─────────────────────────────────────────────────────────────────

const props = defineProps<{ hn: string }>()

// ── Router & Stores ───────────────────────────────────────────────────────

const router = useRouter()
const patientStore = usePatientStore()
const alertStore = useAlertStore()

// ── Panel / modal visibility ──────────────────────────────────────────────

const showFollowupForm = ref(false)
const showDischargeModal = ref(false)

// ── Tab state ─────────────────────────────────────────────────────────────

type TabKey = 'timeline' | 'dispensing' | 'followups' | 'sideeffects'

const activeTab = ref<TabKey>('timeline')

interface Tab {
  key: TabKey
  label: string
}

const TABS: Tab[] = [
  { key: 'timeline',    label: 'ไทม์ไลน์การรักษา' },
  { key: 'dispensing',  label: 'ประวัติยา' },
  { key: 'followups',   label: 'การติดตามผล' },
  { key: 'sideeffects', label: 'ผลข้างเคียง' },
]

// ── Data loading ──────────────────────────────────────────────────────────

onMounted(() => {
  patientStore.fetchPatientDetail(props.hn)
})

function refresh() {
  patientStore.fetchPatientDetail(props.hn)
}

// ── Computed ──────────────────────────────────────────────────────────────

const detail    = computed(() => patientStore.currentPatient)
const isLoading = computed(() => patientStore.isLoadingDetail)
const loadError = computed(() => patientStore.error)

const patientName = computed(
  () => detail.value?.demographics?.full_name ?? props.hn,
)

// Alerts for this patient from the central alert store
const allAlerts    = computed(() => alertStore.alertsForPatient(props.hn))
const redAlerts    = computed(() => allAlerts.value.filter((a) => a.severity === 'red'))
const yellowAlerts = computed(() => allAlerts.value.filter((a) => a.severity === 'yellow'))

/** Estimated current treatment month (1-based), used to pre-fill FollowupForm */
const currentTreatmentMonth = computed<number | undefined>(() => {
  const plan = detail.value?.current_plan
  if (!plan?.phase_start) return undefined
  const start = new Date(plan.phase_start)
  const now   = new Date()
  const diffDays = (now.getTime() - start.getTime()) / 86_400_000
  return Math.max(1, Math.floor(diffDays / 30.44) + 1)
})

/** Drug letters in the current treatment plan */
const currentDrugs = computed<string[]>(() => {
  const plan = detail.value?.current_plan
  if (!plan) return []
  try {
    const arr = JSON.parse(plan.drugs ?? '[]') as string[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
})

const phaseLabel = computed(() => {
  const phase = detail.value?.current_plan?.phase
  if (phase === 'intensive')    return 'ระยะเข้มข้น (Intensive)'
  if (phase === 'continuation') return 'ระยะต่อเนื่อง (Continuation)'
  return null
})

const phaseColor = computed(() => {
  const phase = detail.value?.current_plan?.phase
  if (phase === 'intensive')    return '#dd5b00'
  if (phase === 'continuation') return '#2a9d99'
  return '#a39e98'
})

const tbTypeLabel = computed(() => {
  const t = detail.value?.patient?.tb_type
  if (t === 'pulmonary')       return 'วัณโรคปอด'
  if (t === 'extra_pulmonary') return 'วัณโรคนอกปอด'
  return null
})

// ── Event handlers ────────────────────────────────────────────────────────

function handleFollowupSaved() {
  showFollowupForm.value = false
  patientStore.fetchPatientDetail(props.hn)
}

function handleDischarged() {
  showDischargeModal.value = false
  // Navigate back to active list; patient is no longer active
  router.push('/active')
}

// ── Helpers ───────────────────────────────────────────────────────────────

function toThaiDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const [y, m, d] = iso.split('-').map(Number)
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`
  } catch {
    return iso
  }
}

function sexLabel(sex: string | null | undefined): string | null {
  if (!sex) return null
  return sex === 'M' || sex === '1' ? '♂ ชาย' : '♀ หญิง'
}
</script>

<template>
  <div class="view-root">

    <!-- ── Loading (initial, before any data) ──────────────────────── -->
    <div v-if="isLoading && !detail" class="state-container">
      <div class="loading-state">
        <Loader2 :size="34" class="spin loading-icon" aria-hidden="true" />
        <span class="state-title">กำลังโหลดข้อมูลผู้ป่วย...</span>
        <span class="state-sub">HN {{ hn }}</span>
      </div>
    </div>

    <!-- ── Error (no cached data to fall back on) ───────────────────── -->
    <div v-else-if="loadError && !detail" class="state-container">
      <div class="error-state">
        <AlertTriangle :size="44" class="error-icon" aria-hidden="true" />
        <span class="state-title">ไม่สามารถโหลดข้อมูลได้</span>
        <span class="state-sub">{{ loadError }}</span>
        <button class="btn-retry" type="button" @click="refresh">
          <RefreshCw :size="13" aria-hidden="true" />
          ลองใหม่
        </button>
      </div>
    </div>

    <!-- ── Main detail content ─────────────────────────────────────── -->
    <template v-else-if="detail">

      <!-- ── Red alert banner ───────────────────────────────────────── -->
      <Transition name="banner-slide">
        <div
          v-if="redAlerts.length > 0"
          class="alert-banner"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle :size="15" class="banner-icon" aria-hidden="true" />
          <div class="banner-alert-list">
            <AlertBadge
              v-for="a in redAlerts"
              :key="a.alert_type"
              :alert="a"
            />
          </div>
          <span
            v-if="yellowAlerts.length > 0"
            class="banner-yellow-extra"
            :title="`${yellowAlerts.length} การแจ้งเตือนสีเหลือง`"
          >
            +{{ yellowAlerts.length }} เตือน
          </span>
        </div>
      </Transition>

      <!-- ── Page nav (back + action buttons) ──────────────────────── -->
      <div class="page-nav">
        <button
          class="btn-back"
          type="button"
          @click="router.back()"
          aria-label="กลับหน้าก่อนหน้า"
        >
          <ArrowLeft :size="15" aria-hidden="true" />
          กลับ
        </button>

        <div class="page-actions">
          <!-- Refresh indicator / button -->
          <button
            class="btn-ghost-sm"
            type="button"
            :disabled="isLoading"
            @click="refresh"
            :title="isLoading ? 'กำลังโหลด...' : 'รีเฟรชข้อมูล'"
            aria-label="รีเฟรชข้อมูล"
          >
            <Loader2 v-if="isLoading" :size="13" class="spin" aria-hidden="true" />
            <RefreshCw v-else :size="13" aria-hidden="true" />
          </button>

          <button
            class="btn-followup"
            type="button"
            @click="showFollowupForm = true"
          >
            <PlusCircle :size="14" aria-hidden="true" />
            บันทึกการติดตามผล
          </button>

          <button
            v-if="detail.patient.status === 'active'"
            class="btn-discharge"
            type="button"
            @click="showDischargeModal = true"
          >
            <LogOut :size="14" aria-hidden="true" />
            จำหน่ายผู้ป่วย
          </button>
        </div>
      </div>

      <!-- ── Patient header card ──────────────────────────────────── -->
      <div class="patient-header-card">

        <!-- Left: identity + demographics -->
        <div class="header-left">
          <!-- HN row -->
          <div class="hn-row">
            <span class="hn-label" aria-label="หมายเลขผู้ป่วย">HN</span>
            <span class="hn-value">{{ detail.patient.hn }}</span>
            <span v-if="tbTypeLabel" class="tb-type-badge">{{ tbTypeLabel }}</span>
          </div>

          <!-- Full name -->
          <h1 class="patient-name">{{ patientName }}</h1>
          <!-- HOSxP connection / error status -->
          <p v-if="!detail.mysql_connected" class="demo-unavailable demo-unavailable--warn">
            ⚠️ ยังไม่ได้เชื่อมต่อ HOSxP — ข้อมูลผู้ป่วยและประวัติยาจะไม่แสดง
          </p>
          <p v-else-if="detail.mysql_error" class="demo-unavailable demo-unavailable--error">
            ⚠️ HOSxP error: {{ detail.mysql_error }}
          </p>
          <p v-else-if="!detail.demographics" class="demo-unavailable">
            ℹ️ ไม่พบข้อมูลผู้ป่วยใน HOSxP (HN: {{ detail.patient.hn }})
          </p>

          <!-- Age / sex / birthday -->
          <div class="patient-meta">
            <span v-if="detail.demographics?.age != null">
              {{ detail.demographics.age }} ปี
            </span>
            <span v-if="detail.demographics?.sex" class="sex-text">
              {{ sexLabel(detail.demographics.sex) }}
            </span>
            <template v-if="detail.demographics?.birthday">
              <span class="meta-sep" aria-hidden="true">·</span>
              <span class="birthday-text">เกิด {{ toThaiDate(detail.demographics.birthday) }}</span>
            </template>
          </div>

          <!-- Phone + address -->
          <div class="contact-row">
            <span v-if="detail.demographics?.phone" class="contact-item">
              <Phone :size="11" aria-hidden="true" />
              {{ detail.demographics.phone }}
            </span>
            <span v-if="detail.demographics?.address" class="contact-item contact-address">
              <MapPin :size="11" aria-hidden="true" />
              <span class="truncate">{{ detail.demographics.address }}</span>
            </span>
          </div>

          <!-- Current phase label + drug chips -->
          <div v-if="detail.current_plan" class="treatment-row">
            <span
              v-if="phaseLabel"
              class="phase-badge"
              :style="{ background: phaseColor + '1a', color: phaseColor }"
            >
              {{ phaseLabel }}
            </span>
            <div
              v-if="currentDrugs.length > 0"
              class="drug-chips"
              aria-label="ยาในแผนปัจจุบัน"
            >
              <DrugChip
                v-for="d in currentDrugs"
                :key="d"
                :drug="d"
                size="sm"
              />
            </div>
          </div>
        </div>

        <!-- Right: status badge + enrollment meta -->
        <div class="header-right">
          <StatusBadge :status="detail.patient.status" />

          <dl class="enrollment-dl">
            <!-- Regimen -->
            <div v-if="detail.current_plan" class="enroll-item">
              <dt class="enroll-dt">สูตรยา</dt>
              <dd class="enroll-dd enroll-regimen">{{ detail.current_plan.regimen }}</dd>
            </div>

            <!-- Enrolled date -->
            <div class="enroll-item">
              <dt class="enroll-dt">
                <Calendar :size="10" aria-hidden="true" />
                ลงทะเบียน
              </dt>
              <dd class="enroll-dd">{{ toThaiDate(detail.patient.enrolled_at) }}</dd>
            </div>

            <!-- Enrolled by -->
            <div v-if="detail.patient.enrolled_by" class="enroll-item">
              <dt class="enroll-dt">
                <UserCheck :size="10" aria-hidden="true" />
                โดย
              </dt>
              <dd class="enroll-dd">{{ detail.patient.enrolled_by }}</dd>
            </div>

            <!-- Diagnosis date -->
            <div v-if="detail.patient.diagnosis_date" class="enroll-item">
              <dt class="enroll-dt">วินิจฉัย</dt>
              <dd class="enroll-dd">{{ toThaiDate(detail.patient.diagnosis_date) }}</dd>
            </div>

            <!-- Treatment outcome if available -->
            <div v-if="detail.outcome" class="enroll-item">
              <dt class="enroll-dt">ผลการรักษา</dt>
              <dd class="enroll-dd enroll-outcome">{{ detail.outcome.outcome }}</dd>
            </div>
          </dl>

          <p v-if="detail.patient.notes" class="patient-notes-aside">
            {{ detail.patient.notes }}
          </p>
        </div>
      </div>

      <!-- ── Yellow alerts (non-critical, shown below header) ─────── -->
      <div
        v-if="yellowAlerts.length > 0 && redAlerts.length === 0"
        class="yellow-alerts-row"
      >
        <AlertBadge
          v-for="a in yellowAlerts"
          :key="a.alert_type"
          :alert="a"
        />
      </div>

      <!-- ── Tab bar ──────────────────────────────────────────────── -->
      <nav class="tabs-bar" role="tablist" aria-label="ส่วนของข้อมูลผู้ป่วย">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="tab-btn"
          :class="{ 'tab-active': activeTab === tab.key }"
          type="button"
          role="tab"
          :aria-selected="activeTab === tab.key"
          :aria-controls="`tabpanel-${tab.key}`"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}

          <!-- Follow-up count badge -->
          <span
            v-if="tab.key === 'followups' && detail.followups.length > 0"
            class="tab-badge"
            :class="{ 'tab-badge-active': activeTab === 'followups' }"
          >
            {{ detail.followups.length }}
          </span>

          <!-- Dispensing count badge -->
          <span
            v-if="tab.key === 'dispensing' && detail.dispensing_history.length > 0"
            class="tab-badge"
            :class="{ 'tab-badge-active': activeTab === 'dispensing' }"
          >
            {{ detail.dispensing_history.length }}
          </span>
        </button>
      </nav>

      <!-- ── Tab panels (v-show keeps component state alive) ──────── -->

      <!-- Timeline -->
      <section
        id="tabpanel-timeline"
        class="content-card"
        role="tabpanel"
        :aria-hidden="activeTab !== 'timeline'"
        v-show="activeTab === 'timeline'"
      >
        <div class="card-head">
          <h2 class="card-title">ไทม์ไลน์การรักษา</h2>
          <span v-if="detail.current_plan" class="card-sub">
            {{ detail.current_plan.regimen }}
            &nbsp;·&nbsp;
            {{ detail.current_plan.duration_months }} เดือน
          </span>
        </div>
        <TreatmentTimeline
          :plans="detail.current_plan ? [detail.current_plan] : []"
          :followups="detail.followups"
        />
      </section>

      <!-- Dispensing history -->
      <section
        id="tabpanel-dispensing"
        class="content-card"
        role="tabpanel"
        :aria-hidden="activeTab !== 'dispensing'"
        v-show="activeTab === 'dispensing'"
      >
        <div class="card-head">
          <h2 class="card-title">ประวัติการจ่ายยา TB</h2>
          <span class="card-sub card-source-badge">จาก HOSxP (อ่านอย่างเดียว)</span>
        </div>
        <DispensingTable :records="detail.dispensing_history" />
      </section>

      <!-- Follow-ups -->
      <section
        id="tabpanel-followups"
        class="content-card"
        role="tabpanel"
        :aria-hidden="activeTab !== 'followups'"
        v-show="activeTab === 'followups'"
      >
        <div class="card-head">
          <h2 class="card-title">บันทึกการติดตามผล</h2>
          <button
            class="btn-add"
            type="button"
            @click="showFollowupForm = true"
          >
            <PlusCircle :size="13" aria-hidden="true" />
            เพิ่มบันทึก
          </button>
        </div>
        <FollowupList :followups="detail.followups" />
      </section>

      <!-- Side effects -->
      <section
        id="tabpanel-sideeffects"
        class="content-card"
        role="tabpanel"
        :aria-hidden="activeTab !== 'sideeffects'"
        v-show="activeTab === 'sideeffects'"
      >
        <div class="card-head">
          <h2 class="card-title">ผลข้างเคียงจากยา</h2>
        </div>
        <SideEffectTracker
          :followups="detail.followups"
          :current-plan="detail.current_plan"
        />
      </section>

    </template>

    <!-- ── Global panels & modals ──────────────────────────────────── -->
    <FollowupForm
      v-model="showFollowupForm"
      :hn="hn"
      :month-number="currentTreatmentMonth"
      @saved="handleFollowupSaved"
    />

    <DischargeModal
      v-model="showDischargeModal"
      :hn="hn"
      :patient-name="patientName"
      @discharged="handleDischarged"
    />

  </div>
</template>

<style scoped>
/* ── Page root ────────────────────────────────────────────────────── */
.view-root {
  padding: 32px 32px 48px;
  max-width: 1100px;
}

/* ── State containers ─────────────────────────────────────────────── */
.state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480px;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.loading-icon {
  color: var(--color-blue);
  opacity: 0.65;
  margin-bottom: 6px;
}

.error-icon {
  color: var(--color-orange);
  opacity: 0.35;
  margin-bottom: 6px;
}

.state-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.state-sub {
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 340px;
  line-height: 1.5;
}

.btn-retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 18px;
  background: var(--color-blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-retry:hover {
  background: var(--color-blue-active);
}

/* ── Red alert banner ─────────────────────────────────────────────── */
.alert-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(221, 91, 0, 0.07);
  border: 1px solid rgba(221, 91, 0, 0.22);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.banner-icon {
  color: var(--color-orange);
  flex-shrink: 0;
}

.banner-alert-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}

.banner-yellow-extra {
  font-size: 11px;
  font-weight: 600;
  color: #c78b00;
  background: rgba(245, 166, 35, 0.12);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Page nav ─────────────────────────────────────────────────────── */
.page-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 13px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.btn-back:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-ghost-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  background: none;
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-ghost-sm:hover:not(:disabled) {
  background: var(--color-bg-alt);
  color: var(--color-text-secondary);
}

.btn-ghost-sm:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-followup {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: 1px solid rgba(42, 157, 153, 0.35);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--color-teal);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}

.btn-followup:hover {
  background: rgba(42, 157, 153, 0.06);
  border-color: rgba(42, 157, 153, 0.5);
}

.btn-discharge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: 1px solid rgba(221, 91, 0, 0.3);
  border-radius: var(--radius-sm);
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--color-orange);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s;
}

.btn-discharge:hover {
  background: rgba(221, 91, 0, 0.05);
  border-color: rgba(221, 91, 0, 0.5);
}

/* ── Patient header card ──────────────────────────────────────────── */
.patient-header-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 22px 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

/* ── Header left ──────────────────────────────────────────────────── */
.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-width: 240px;
}

.hn-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.hn-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.hn-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.tb-type-badge {
  padding: 2px 8px;
  background: var(--color-bg-alt);
  color: var(--color-text-secondary);
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
}

.demo-unavailable {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 2px 0 0;
}

.demo-unavailable--warn {
  color: var(--color-orange);
  font-size: 12px;
}

.demo-unavailable--error {
  color: #dd5b00;
  font-size: 12px;
  word-break: break-all;
}

.patient-name {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--color-text);
  line-height: 1.2;
  margin: 0;
}

.patient-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.sex-text {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.meta-sep {
  color: var(--color-text-muted);
  line-height: 1;
}

.birthday-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.contact-address {
  flex: 1;
  min-width: 0;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.treatment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.phase-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.drug-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

/* ── Header right ─────────────────────────────────────────────────── */
.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  flex-shrink: 0;
  min-width: 180px;
}

.enrollment-dl {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
}

.enroll-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.enroll-dt {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.enroll-dd {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin: 0;
}

.enroll-regimen {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-blue);
  letter-spacing: 0.3px;
}

.enroll-outcome {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-teal);
}

.patient-notes-aside {
  font-size: 12px;
  color: var(--color-text-muted);
  font-style: italic;
  max-width: 220px;
  text-align: right;
  line-height: 1.55;
  margin: 0;
}

/* ── Yellow alerts row ────────────────────────────────────────────── */
.yellow-alerts-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

/* ── Tabs bar ─────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  border-bottom: var(--border);
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-bar::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  margin-bottom: -1px; /* overlap the border-bottom of tabs-bar */
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: var(--color-text);
}

.tab-active {
  color: var(--color-blue);
  border-bottom-color: var(--color-blue);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  background: var(--color-bg-alt);
  color: var(--color-text-muted);
  border-radius: var(--radius-pill);
  font-size: 10px;
  font-weight: 700;
  padding: 0 5px;
  line-height: 1;
  transition: background 0.15s, color 0.15s;
}

.tab-badge-active {
  background: rgba(0, 117, 222, 0.12);
  color: var(--color-blue);
}

/* ── Content card (shared by all tab panels) ──────────────────────── */
.content-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 22px 24px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.15px;
  margin: 0;
}

.card-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.card-source-badge {
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-pill);
  padding: 3px 9px;
}

/* ── Add follow-up button (inside followups tab header) ───────────── */
.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--color-blue);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.btn-add:hover {
  background: var(--color-blue-active);
}

/* ── Alert banner slide-in transition ─────────────────────────────── */
.banner-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.banner-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ── Spin animation ───────────────────────────────────────────────── */
.spin {
  animation: spin 1s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>