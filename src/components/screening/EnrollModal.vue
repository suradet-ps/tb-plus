<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2, UserPlus, X } from '@lucide/vue';
import { computed, ref, watch } from 'vue';
import { usePatientStore } from '@/stores/patient';
import { useSettingsStore } from '@/stores/settings';
import type { EnrollmentInput, PatientDrugRecord } from '@/types/patient';

const props = defineProps<{
  modelValue: boolean;
  patients: PatientDrugRecord[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  enrolled: [];
}>();

const patientStore = usePatientStore();
const settingsStore = useSettingsStore();

// -- Form state --
const tbType = ref('pulmonary');
const diagnosisDate = ref('');
const regimen = ref('2HRZE/4HR');
const treatmentStartDate = ref('');
const enrolledBy = ref('');
const notes = ref('');
const isSubmitting = ref(false);
const error = ref<string | null>(null);
const success = ref(false);

// -- Re-enrollment detection --
const reenrollCount = computed(
  () =>
    props.patients.filter((p) => p.is_enrolled && p.patient_status && p.patient_status !== 'active')
      .length,
);
const hasReenrollPatients = computed(() => reenrollCount.value > 0);

// -- Reset form whenever the modal opens --
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      tbType.value = 'pulmonary';
      diagnosisDate.value = '';
      regimen.value = '2HRZE/4HR';
      treatmentStartDate.value = '';
      enrolledBy.value = '';
      notes.value = '';
      error.value = null;
      success.value = false;
      isSubmitting.value = false;
    }
  },
);

// -- Actions --
function close() {
  if (isSubmitting.value) return;
  emit('update:modelValue', false);
}

async function submit() {
  if (!treatmentStartDate.value) {
    error.value = 'กรุณาระบุวันเริ่มการรักษา';
    return;
  }

  isSubmitting.value = true;
  error.value = null;

  try {
    for (const patient of props.patients) {
      const input: EnrollmentInput = {
        hn: patient.hn,
        tb_type: tbType.value,
        diagnosis_date: diagnosisDate.value || null,
        regimen: regimen.value,
        treatment_start_date: treatmentStartDate.value,
        enrolled_by: enrolledBy.value || null,
        notes: notes.value || null,
      };
      await patientStore.enrollPatient(input);
    }

    success.value = true;
    setTimeout(() => {
      emit('enrolled');
      close();
      success.value = false;
    }, 1200);
  } catch (e) {
    error.value = String(e);
  } finally {
    isSubmitting.value = false;
  }
}

function unfocus(e: Event) {
  (e.target as HTMLElement)?.blur();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-title-row">
              <UserPlus :size="18" class="modal-title-icon" />
              <h2 id="modal-title" class="modal-title">ลงทะเบียนเข้าคลินิก TB</h2>
            </div>
            <button class="close-btn" @click="close" :disabled="isSubmitting" title="ปิด">
              <X :size="18" />
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Patient chips -->
            <div class="section-label">ผู้ป่วยที่จะลงทะเบียน ({{ patients.length }} ราย)</div>
            <div class="patient-chips">
              <span v-for="p in patients.slice(0, 3)" :key="p.hn" class="patient-chip">
                <span class="patient-chip-hn">{{ p.hn }}</span>
                <span class="patient-chip-name">{{ p.full_name }}</span>
              </span>
              <span v-if="patients.length > 3" class="patient-chip patient-chip--more">
                +{{ patients.length - 3 }} รายอื่น
              </span>
            </div>

            <!-- Re-enrollment warning -->
            <div v-if="hasReenrollPatients" class="reenroll-warning">
              <span class="reenroll-warning-icon">⚠️</span>
              <span>
                มีผู้ป่วย <strong>{{ reenrollCount }} ราย</strong>
                เคยรักษาในคลินิกมาก่อน — ระบบจะสร้างแผนการรักษาใหม่โดยเก็บประวัติเดิมไว้
              </span>
            </div>

            <div class="form-divider" />

            <!-- TB Type -->
            <div class="form-group">
              <label class="form-label">ชนิดวัณโรค</label>
              <div class="radio-group">
                <label class="radio-label">
                  <input type="radio" v-model="tbType" value="pulmonary" />
                  <span class="radio-text">ปอด (Pulmonary)</span>
                </label>
                <label class="radio-label">
                  <input type="radio" v-model="tbType" value="extra_pulmonary" />
                  <span class="radio-text">นอกปอด (Extra-pulmonary)</span>
                </label>
              </div>
            </div>

            <!-- Diagnosis date -->
            <div class="form-group">
              <label class="form-label" for="diagnosisDate">วันที่วินิจฉัยยืนยัน</label>
              <input
                id="diagnosisDate"
                type="date"
                v-model="diagnosisDate"
                class="form-input"
                placeholder="ไม่ระบุ"
              />
            </div>

            <!-- Regimen -->
            <div class="form-group">
              <label class="form-label" for="regimen">สูตรยาที่ใช้</label>
                <select id="regimen" v-model="regimen" class="form-select">
                  <option
                    v-for="reg in settingsStore.regimenDefinitions"
                    :key="reg.name"
                    :value="reg.name"
                  >
                    {{ reg.name }}
                  </option>
                </select>
            </div>

            <!-- Treatment start date (required) -->
            <div class="form-group">
              <label class="form-label" for="treatmentStart">
                วันเริ่มการรักษา
                <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="treatmentStart"
                type="date"
                v-model="treatmentStartDate"
                class="form-input"
                :class="{ 'form-input--error': error && !treatmentStartDate }"
                required
              />
            </div>

            <!-- Enrolled by -->
            <div class="form-group">
              <label class="form-label" for="enrolledBy">ลงทะเบียนโดย</label>
              <input
                id="enrolledBy"
                type="text"
                v-model="enrolledBy"
                list="staff-datalist"
                class="form-input"
                placeholder="ชื่อผู้บันทึก (ไม่จำเป็น)"
                autocomplete="off"
                @change="unfocus"
              />
              <datalist id="staff-datalist">
                <option
                  v-for="name in settingsStore.staffNames"
                  :key="name"
                  :value="name"
                />
              </datalist>
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label class="form-label" for="notes">หมายเหตุ</label>
              <textarea
                id="notes"
                v-model="notes"
                class="form-textarea"
                placeholder="บันทึกเพิ่มเติม (ไม่จำเป็น)"
                rows="3"
              />
            </div>

            <!-- Error alert -->
            <div v-if="error" class="error-alert" role="alert">
              <AlertCircle :size="15" class="alert-icon" />
              <span>{{ error }}</span>
            </div>

            <!-- Success alert -->
            <div v-if="success" class="success-alert" role="status">
              <CheckCircle :size="15" class="alert-icon" />
              <span>ลงทะเบียนสำเร็จ {{ patients.length }} ราย</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-ghost" type="button" @click="close" :disabled="isSubmitting">
              ยกเลิก
            </button>
            <button
              class="btn-primary"
              type="button"
              :disabled="isSubmitting || success"
              @click="submit"
            >
              <Loader2 v-if="isSubmitting" :size="14" class="spin" />
              <UserPlus v-else :size="14" />
              {{ isSubmitting ? 'กำลังบันทึก…' : 'ลงทะเบียน' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active {
  transition: var(--transition-modal);
}

.modal-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--modal-overlay);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
}

.modal-panel {
  background: var(--modal-bg);
  border-radius: var(--modal-radius);
  box-shadow: var(--modal-shadow);
  width: var(--modal-max);
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: var(--modal-header-padding);
  border-bottom: var(--border-standard);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.modal-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.modal-title-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

.modal-title {
  font-size: var(--text-heading);
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-heading);
  color: var(--color-text);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-icon-btn);
  flex-shrink: 0;
}

.close-btn:hover:not(:disabled) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.close-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.modal-body {
  padding: var(--modal-body-padding);
  overflow-y: auto;
  flex: 1;
}

.section-label {
  font-size: var(--text-caption);
  font-weight: var(--weight-heading);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.patient-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-6);
  background: var(--color-surface-alt);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
}

.patient-chip {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-pill);
  padding: var(--space-2) var(--space-5);
  font-size: var(--text-sm);
  font-weight: var(--weight-ui);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.patient-chip-hn {
  font-family: var(--font-family-mono-simple);
  font-weight: var(--weight-heading);
  color: var(--color-text);
}

.patient-chip-name {
  color: var(--color-text-secondary);
}

.patient-chip--more {
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  border-color: rgba(9, 127, 232, 0.18);
  font-weight: var(--weight-emphasis);
}

.form-divider {
  height: 1px;
  background: var(--divider-color);
  margin: var(--space-10) 0;
}

.form-group {
  margin-bottom: var(--space-8);
}

.form-label {
  display: block;
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
  margin-bottom: var(--space-3);
}

.required {
  color: var(--color-warning);
  margin-left: var(--space-1);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: var(--input-padding-md);
  border: 1px solid var(--input-border);
  border-radius: var(--input-radius);
  font-size: var(--input-font-size-md);
  font-family: var(--font-family);
  color: var(--input-text);
  background: var(--input-bg);
  outline: none;
  transition: var(--transition-input);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--input-border-focus);
  box-shadow: var(--shadow-focus-ring);
}

.form-input--error {
  border-color: var(--input-border-error);
  box-shadow: var(--shadow-focus-ring-error);
}

.form-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: var(--leading-body);
}

.radio-group {
  display: flex;
  gap: var(--space-10);
  flex-wrap: wrap;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;
}

.radio-label input[type='radio'] {
  width: 15px;
  height: 15px;
  accent-color: var(--color-accent);
  cursor: pointer;
  flex-shrink: 0;
}

.radio-text {
  font-size: var(--text-body);
  color: var(--color-text);
}

.error-alert,
.success-alert {
  border-radius: var(--radius-sm);
  padding: var(--space-5) var(--space-6);
  font-size: var(--text-body-sm);
  margin-bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.error-alert {
  background: var(--alert-error-bg);
  border: 1px solid var(--border-color-error);
  color: var(--color-warning);
}

.success-alert {
  background: var(--alert-success-bg);
  border: 1px solid var(--border-color-green);
  color: var(--color-success);
}

.alert-icon {
  flex-shrink: 0;
}

.reenroll-warning {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: var(--space-5) 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--alert-warning-border);
  border-left: 3px solid var(--color-warning);
  background: var(--tint-orange);
  font-size: var(--text-body-sm);
  color: var(--color-warning);
  line-height: var(--leading-body);
  margin-top: var(--space-5);
}

.reenroll-warning-icon {
  flex-shrink: 0;
  font-size: var(--text-body);
  line-height: var(--leading-body);
}

.reenroll-warning strong {
  font-weight: var(--weight-heading);
  color: var(--color-warning);
}

.modal-footer {
  padding: var(--modal-footer-padding);
  border-top: var(--border-standard);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-4);
  flex-shrink: 0;
}

.btn-ghost {
  background: transparent;
  border: none;
  padding: var(--btn-padding-lg);
  font-size: var(--btn-font-size-lg);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  border-radius: var(--btn-radius);
  color: var(--color-text-secondary);
  transition: var(--transition-btn);
  font-family: var(--font-family);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
  padding: var(--btn-padding-lg);
  font-size: var(--btn-font-size-lg);
  font-weight: var(--weight-emphasis);
  cursor: pointer;
  border-radius: var(--btn-radius);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  transition: var(--transition-btn);
  font-family: var(--font-family);
}

.btn-primary:hover:not(:disabled) {
  background: var(--btn-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin var(--duration-animate) linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>