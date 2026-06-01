<script setup lang="ts">
import {
  Activity,
  Loader2,
  Map as MapIcon,
  MapPinned,
  RefreshCw,
  ScanSearch,
  TriangleAlert,
} from '@lucide/vue';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import MapCanvas from '@/components/mapping/MapCanvas.vue';
import MapFilters from '@/components/mapping/MapFilters.vue';
import StatusBadge from '@/components/shared/StatusBadge.vue';
import { useMappingStore } from '@/stores/mapping';
import { useSettingsStore } from '@/stores/settings';
import type { MappingPatientRow } from '@/types/mapping';

const mappingStore = useMappingStore();
const settingsStore = useSettingsStore();

const search = ref('');
const status = ref<'all' | 'active' | 'completed' | 'transferred' | 'died' | 'defaulted'>('all');
const tbType = ref<'all' | 'pulmonary' | 'extra_pulmonary'>('all');
const geocodeStatus = ref<'all' | 'success' | 'pending' | 'failed' | 'missing_address'>('all');
const enrolledFrom = ref('');
const enrolledTo = ref('');
const mapError = ref<string | null>(null);
const isOnline = ref(window.navigator.onLine);
const batchMessage = ref<string | null>(null);

function handleOnline(): void {
  isOnline.value = true;
}

function handleOffline(): void {
  isOnline.value = false;
}

onMounted(() => {
  mappingStore.fetchAll();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});

const summary = computed(() => ({
  total: mappingStore.summary?.total_patients ?? 0,
  active: mappingStore.summary?.active_patients ?? 0,
  mapped: mappingStore.summary?.mapped_patients ?? 0,
  unmapped: mappingStore.summary?.unmapped_patients ?? 0,
  missingAddress: mappingStore.summary?.missing_address_patients ?? 0,
}));

const filteredPatients = computed<MappingPatientRow[]>(() => {
  const query = search.value.trim().toLowerCase();

  return mappingStore.patients.filter((patient) => {
    if (status.value !== 'all' && patient.tb_status !== status.value) return false;
    if (tbType.value !== 'all' && patient.tb_type !== tbType.value) return false;
    if (geocodeStatus.value !== 'all' && patient.geocode_status !== geocodeStatus.value)
      return false;
    if (enrolledFrom.value && patient.enrolled_at < enrolledFrom.value) return false;
    if (enrolledTo.value && patient.enrolled_at > enrolledTo.value) return false;
    if (!query) return true;

    const haystacks = [
      patient.masked_name,
      patient.masked_hn,
      patient.address_preview ?? '',
      patient.tb_status,
      patient.tb_type ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystacks.includes(query);
  });
});

const selectedPatient = computed(() => {
  const explicit = mappingStore.selectedPatient;
  if (explicit && filteredPatients.value.some((patient) => patient.hn === explicit.hn)) {
    return explicit;
  }
  return filteredPatients.value[0] ?? null;
});

const mappedPatients = computed(() =>
  filteredPatients.value.filter((patient) => patient.lat !== null && patient.lng !== null),
);

function resetFilters(): void {
  search.value = '';
  status.value = 'all';
  tbType.value = 'all';
  geocodeStatus.value = 'all';
  enrolledFrom.value = '';
  enrolledTo.value = '';
}

function geocodeStatusLabel(value: MappingPatientRow['geocode_status']): string {
  switch (value) {
    case 'success':
      return 'พร้อมแสดงบนแผนที่';
    case 'failed':
      return 'แปลงพิกัดไม่สำเร็จ';
    case 'missing_address':
      return 'ไม่มีที่อยู่ใน HOSxP';
    default:
      return 'รอแปลงพิกัด';
  }
}

function geocodeStatusClass(value: MappingPatientRow['geocode_status']): string {
  switch (value) {
    case 'success':
      return 'geo-pill geo-pill--success';
    case 'failed':
      return 'geo-pill geo-pill--failed';
    case 'missing_address':
      return 'geo-pill geo-pill--muted';
    default:
      return 'geo-pill geo-pill--pending';
  }
}

async function handleBatchGeocode(): Promise<void> {
  batchMessage.value = null;
  const result = await mappingStore.batchGeocode(10);
  batchMessage.value = `ประมวลผล ${result.processed} ราย • สำเร็จ ${result.succeeded} • ข้าม ${result.skipped} • ไม่สำเร็จ ${result.failed}`;
}

async function handleSingleGeocode(hn: string): Promise<void> {
  batchMessage.value = null;
  await mappingStore.geocodePatient(hn);
}
</script>

<template>
  <div class="view-root">
    <div class="view-header">
      <div>
        <h1 class="page-title">แผนที่การกระจายโรค</h1>
        <p class="page-subtitle">
          แสดงตำแหน่งผู้ป่วยที่ลงทะเบียนแล้ว
        </p>
      </div>

      <div class="header-actions">
        <button class="btn-ghost" :disabled="mappingStore.isLoading" @click="mappingStore.fetchAll()">
          <Loader2 v-if="mappingStore.isLoading" :size="14" class="spin" />
          <RefreshCw v-else :size="14" />
          รีเฟรช
        </button>
        <button
          class="btn-primary"
          :disabled="mappingStore.isBatchGeocoding || !settingsStore.isConnected"
          @click="handleBatchGeocode"
        >
          <Loader2 v-if="mappingStore.isBatchGeocoding" :size="14" class="spin" />
          <ScanSearch v-else :size="14" />
          แปลงพิกัด 10 ราย
        </button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon stat-icon--blue"><MapPinned :size="16" /></div>
        <div>
          <div class="stat-value">{{ summary.total }}</div>
          <div class="stat-label">ลงทะเบียนทั้งหมด</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--teal"><MapIcon :size="16" /></div>
        <div>
          <div class="stat-value stat-value--teal">{{ summary.mapped }}</div>
          <div class="stat-label">พร้อมแสดงบนแผนที่</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--orange"><TriangleAlert :size="16" /></div>
        <div>
          <div class="stat-value stat-value--orange">{{ summary.unmapped }}</div>
          <div class="stat-label">ยังไม่พร้อมแสดง</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon--green"><Activity :size="16" /></div>
        <div>
          <div class="stat-value stat-value--green">{{ summary.active }}</div>
          <div class="stat-label">กำลังรักษา</div>
        </div>
      </div>
    </div>

    <div v-if="!isOnline" class="notice-banner notice-banner--warning">
      อินเทอร์เน็ตไม่พร้อมใช้งาน แผนที่พื้นหลังอาจไม่โหลด แต่ยังดูรายการผู้ป่วยและพิกัดที่ cache ไว้ได้
    </div>
    <div v-else-if="mapError" class="notice-banner notice-banner--warning">
      {{ mapError }}
    </div>
    <div v-if="!settingsStore.isConnected" class="notice-banner">
      ขณะนี้ยังไม่ได้เชื่อมต่อ HOSxP จึงแสดงได้เฉพาะข้อมูลที่ cache ไว้เดิม และยังไม่สามารถแปลงพิกัดเพิ่มได้
    </div>
    <div v-if="batchMessage" class="notice-banner notice-banner--success">
      {{ batchMessage }}
    </div>
    <div v-if="mappingStore.error" class="notice-banner notice-banner--error">
      {{ mappingStore.error }}
    </div>

    <MapFilters
      :search="search"
      :status="status"
      :tb-type="tbType"
      :geocode-status="geocodeStatus"
      :enrolled-from="enrolledFrom"
      :enrolled-to="enrolledTo"
      @update:search="search = $event"
      @update:status="status = $event"
      @update:tb-type="tbType = $event"
      @update:geocode-status="geocodeStatus = $event"
      @update:enrolled-from="enrolledFrom = $event"
      @update:enrolled-to="enrolledTo = $event"
      @reset="resetFilters"
    />

    <div class="content-grid">
      <div class="side-card">
        <div class="side-card__header">
          <div>
            <h2 class="section-title">ข้อมูลผู้ป่วย</h2>
            <p class="section-subtitle">เลือกจากรายการหรือคลิก marker บนแผนที่</p>
          </div>
          <span class="count-pill">{{ filteredPatients.length }} ราย</span>
        </div>

        <div v-if="selectedPatient" class="detail-card">
          <div class="detail-card__top">
            <div>
              <div class="detail-name">{{ selectedPatient.masked_name }}</div>
              <div class="detail-hn">{{ selectedPatient.masked_hn }}</div>
            </div>
            <StatusBadge :status="selectedPatient.tb_status" />
          </div>

          <div class="detail-meta-grid">
            <div>
              <span class="meta-label">ชนิดวัณโรค</span>
              <span class="meta-value">
                {{
                  selectedPatient.tb_type === 'pulmonary'
                    ? 'Pulmonary'
                    : selectedPatient.tb_type === 'extra_pulmonary'
                      ? 'Extra-pulmonary'
                      : '-'
                }}
              </span>
            </div>
            <div>
              <span class="meta-label">ลงทะเบียน</span>
              <span class="meta-value">{{ selectedPatient.enrolled_at }}</span>
            </div>
          </div>

          <div class="detail-block">
            <span class="meta-label">พื้นที่</span>
            <span class="meta-value">{{ selectedPatient.address_preview ?? 'ไม่พบข้อมูลที่อยู่' }}</span>
          </div>

          <div class="detail-block">
            <span class="meta-label">สถานะพิกัด</span>
            <span :class="geocodeStatusClass(selectedPatient.geocode_status)">
              {{ geocodeStatusLabel(selectedPatient.geocode_status) }}
            </span>
          </div>

          <div v-if="selectedPatient.geocode_error" class="detail-error">
            {{ selectedPatient.geocode_error }}
          </div>

          <button
            class="btn-primary btn-primary--full"
            :disabled="
              mappingStore.isGeocoding ||
              !settingsStore.isConnected ||
              selectedPatient.geocode_status === 'missing_address'
            "
            @click="handleSingleGeocode(selectedPatient.hn)"
          >
            <Loader2 v-if="mappingStore.isGeocoding" :size="14" class="spin" />
            <ScanSearch v-else :size="14" />
            แปลงพิกัดผู้ป่วยรายนี้
          </button>
        </div>

        <div class="patient-list">
          <button
            v-for="patient in filteredPatients"
            :key="patient.hn"
            class="patient-row"
            :class="{ 'patient-row--active': selectedPatient?.hn === patient.hn }"
            @click="mappingStore.selectPatient(patient.hn)"
          >
            <div class="patient-row__main">
              <div class="patient-row__name">{{ patient.masked_name }}</div>
              <div class="patient-row__sub">
                {{ patient.masked_hn }} • {{ patient.address_preview ?? 'ไม่มีที่อยู่' }}
              </div>
            </div>
            <span :class="geocodeStatusClass(patient.geocode_status)">
              {{ geocodeStatusLabel(patient.geocode_status) }}
            </span>
          </button>

          <div v-if="!mappingStore.isLoading && filteredPatients.length === 0" class="empty-inline">
            ไม่พบผู้ป่วยที่ตรงกับตัวกรองที่เลือก
          </div>
        </div>
      </div>

      <div class="map-column">
        <MapCanvas
          :patients="mappedPatients"
          :selected-hn="selectedPatient?.hn ?? null"
          @select="mappingStore.selectPatient"
          @map-error="mapError = $event"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.view-root {
  padding: var(--page-root-padding);
  max-width: 1440px;
}

.view-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-8);
  margin-bottom: var(--space-12);
}

.page-title {
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.3px;
  margin-bottom: var(--space-2);
  color: var(--color-text);
}

.page-subtitle {
  font-size: var(--text-body);
  color: var(--color-text-secondary);
  max-width: 820px;
  line-height: var(--leading-body);
}

.header-actions {
  display: inline-flex;
  gap: 10px;
}

.btn-ghost,
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.btn-ghost {
  background: var(--color-surface);
  border: var(--border-standard);
  color: var(--color-text-secondary);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.btn-primary {
  background: var(--color-blue);
  border: 1px solid transparent;
  color: var(--color-surface);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-blue-active);
}

.btn-primary:disabled,
.btn-ghost:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary--full {
  width: 100%;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.stat-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 14px 16px;
  display: flex;
  gap: var(--space-6);
  align-items: center;
}

.stat-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stat-icon--blue {
  color: var(--color-blue);
  background: var(--tint-blue);
}

.stat-icon--teal {
  color: var(--color-teal);
  background: var(--status-completed-bg);
}

.stat-icon--orange {
  color: var(--color-orange);
  background: var(--status-defaulted-bg);
}

.stat-icon--green {
  color: var(--color-green);
  background: var(--status-active-bg);
}

.stat-value {
  font-size: var(--text-display);
  font-weight: var(--weight-heading);
  line-height: 1;
  color: var(--color-text);
}

.stat-value--teal {
  color: var(--color-teal);
}

.stat-value--orange {
  color: var(--color-orange);
}

.stat-value--green {
  color: var(--color-green);
}

.stat-label {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.notice-banner {
  margin-bottom: var(--space-6);
  border-radius: var(--radius-md);
  border: var(--border-standard);
  background: rgba(0, 117, 222, 0.07);
  color: var(--color-blue);
  padding: 10px 12px;
  font-size: var(--text-body-sm);
  line-height: var(--leading-body);
}

.notice-banner--warning {
  background: var(--alert-error-bg);
  color: var(--color-orange);
}

.notice-banner--success {
  background: rgba(42, 157, 153, 0.08);
  color: var(--color-teal);
}

.notice-banner--error {
  background: rgba(49, 48, 46, 0.08);
  color: var(--color-text);
}

.content-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: var(--space-8);
  margin-top: 16px;
}

.side-card {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 560px;
}

.side-card__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
}

.section-title {
  font-size: var(--text-title-sm);
  font-weight: var(--weight-heading);
  letter-spacing: -0.2px;
  color: var(--color-text);
}

.section-subtitle {
  margin-top: 4px;
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.count-pill {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
}

.detail-card {
  padding: 14px;
  border-radius: var(--radius-card);
  background: var(--color-surface-alt);
  border: var(--border-standard);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.detail-card__top {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
  align-items: flex-start;
}

.detail-name {
  font-size: var(--text-heading-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
}

.detail-hn {
  margin-top: 3px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.detail-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail-block,
.detail-meta-grid > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  letter-spacing: 0.125px;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.meta-value {
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.detail-error {
  font-size: var(--text-sm);
  color: var(--color-orange);
  background: var(--alert-error-bg);
  border-radius: var(--radius-md);
  padding: var(--input-padding-lg);
}

.patient-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow: auto;
  padding-right: 2px;
}

.patient-row {
  width: 100%;
  text-align: left;
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-md);
  padding: 11px 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}

.patient-row:hover {
  background: var(--color-surface-alt);
}

.patient-row--active {
  border-color: rgba(0, 117, 222, 0.32);
  background: rgba(0, 117, 222, 0.05);
}

.patient-row__main {
  min-width: 0;
}

.patient-row__name {
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
}

.patient-row__sub {
  margin-top: 4px;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.geo-pill {
  align-self: center;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  letter-spacing: 0.125px;
  white-space: nowrap;
}

.geo-pill--success {
  background: var(--status-completed-bg);
  color: var(--color-teal);
}

.geo-pill--pending {
  background: rgba(0, 117, 222, 0.09);
  color: var(--color-blue);
}

.geo-pill--failed {
  background: var(--status-defaulted-bg);
  color: var(--color-orange);
}

.geo-pill--muted {
  background: var(--divider-color);
  color: var(--color-text-secondary);
}

.empty-inline {
  border-radius: var(--radius-md);
  border: var(--border-standard);
  padding: 14px;
  text-align: center;
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .stats-bar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .side-card {
    min-height: 0;
  }
}

@media (max-width: 760px) {
  .view-root {
    padding: 24px 20px 40px;
  }

  .view-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
    flex-direction: column;
  }

  .stats-bar {
    grid-template-columns: 1fr;
  }
}
</style>
