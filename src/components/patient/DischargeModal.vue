<script setup lang="ts">
import { AlertTriangle, Loader2, LogOut } from '@lucide/vue';
import { invoke } from '@tauri-apps/api/core';
import { ref, watch } from 'vue';
import type { OutcomeInput } from '@/types/treatment';

// -- Props & Emits --

const props = defineProps<{
  modelValue: boolean;
  hn: string;
  patientName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'discharged'): void;
}>();

// -- Outcome options --

interface OutcomeOption {
  value: string;
  labelTh: string;
  labelEn: string;
  bg: string;
  text: string;
  border: string;
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    value: 'cured',
    labelTh: 'หาย',
    labelEn: 'Cured',
    bg: 'rgba(26, 174, 57, 0.1)',
    text: 'var(--outcome-cured-text)',
    border: 'rgba(26, 174, 57, 0.25)',
  },
  {
    value: 'treatment_completed',
    labelTh: 'รักษาครบ',
    labelEn: 'Treatment completed',
    bg: 'rgba(42, 157, 153, 0.1)',
    text: 'var(--outcome-completed-text)',
    border: 'rgba(42, 157, 153, 0.25)',
  },
  {
    value: 'treatment_failed',
    labelTh: 'รักษาล้มเหลว',
    labelEn: 'Treatment failed',
    bg: 'rgba(221, 91, 0, 0.1)',
    text: 'var(--outcome-failed-text)',
    border: 'rgba(221, 91, 0, 0.25)',
  },
  {
    value: 'died',
    labelTh: 'เสียชีวิต',
    labelEn: 'Died',
    bg: 'rgba(49, 48, 46, 0.1)',
    text: 'var(--outcome-died-text)',
    border: 'rgba(49, 48, 46, 0.2)',
  },
  {
    value: 'lost_to_followup',
    labelTh: 'ขาดการรักษา',
    labelEn: 'Lost to follow-up',
    bg: 'rgba(221, 91, 0, 0.1)',
    text: 'var(--outcome-lost-text)',
    border: 'rgba(221, 91, 0, 0.25)',
  },
  {
    value: 'transferred_out',
    labelTh: 'ส่งต่อ',
    labelEn: 'Transferred out',
    bg: 'rgba(9, 127, 232, 0.1)',
    text: 'var(--outcome-transferred-text)',
    border: 'rgba(9, 127, 232, 0.25)',
  },
  {
    value: 'not_evaluated',
    labelTh: 'ไม่ได้ประเมิน',
    labelEn: 'Not evaluated',
    bg: 'rgba(0, 0, 0, 0.04)',
    text: 'var(--outcome-not-evaluated-text)',
    border: 'rgba(0, 0, 0, 0.1)',
  },
];

// -- Form state --

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FormState {
  outcome: string;
  outcome_date: string;
  treatment_end: string;
  notes: string;
  created_by: string;
}

function createEmptyForm(): FormState {
  return {
    outcome: '',
    outcome_date: todayISO(),
    treatment_end: todayISO(),
    notes: '',
    created_by: '',
  };
}

const form = ref<FormState>(createEmptyForm());
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

// Derived: selected outcome config for colored preview
const selectedOutcomeConfig = ref<OutcomeOption | null>(null);

watch(
  () => form.value.outcome,
  (val) => {
    selectedOutcomeConfig.value = OUTCOME_OPTIONS.find((o) => o.value === val) ?? null;
  },
);

// -- Reset on open --

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      form.value = createEmptyForm();
      submitError.value = null;
      selectedOutcomeConfig.value = null;
    }
  },
);

// -- Submit --

async function handleSubmit() {
  submitError.value = null;

  if (!form.value.outcome) {
    submitError.value = 'กรุณาเลือกผลการรักษา';
    return;
  }
  if (!form.value.outcome_date) {
    submitError.value = 'กรุณาระบุวันที่จำหน่าย';
    return;
  }

  isSubmitting.value = true;
  try {
    const input: OutcomeInput = {
      hn: props.hn,
      outcome: form.value.outcome,
      outcome_date: form.value.outcome_date,
      treatment_end: form.value.treatment_end || null,
      notes: form.value.notes.trim() || null,
      created_by: form.value.created_by.trim() || null,
    };
    await invoke('discharge_patient', { outcome: input });
    emit('discharged');
    close();
  } catch (e) {
    submitError.value = String(e);
  } finally {
    isSubmitting.value = false;
  }
}

// -- Close helpers --

function close() {
  if (isSubmitting.value) return;
  emit('update:modelValue', false);
}

function onOverlayPointerDown(e: MouseEvent) {
  if (e.target === e.currentTarget) close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        role="presentation"
        @pointerdown="onOverlayPointerDown"
        @keydown="onKeydown"
      >
        <!-- Dialog panel -->
        <div
          class="modal-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discharge-modal-title"
          tabindex="-1"
          @pointerdown.stop
        >
          <!-- Warning header -->
          <div class="modal-header">
            <div class="header-icon-wrap" aria-hidden="true">
              <LogOut :size="20" />
            </div>
            <div class="header-text">
              <h3 id="discharge-modal-title" class="header-title">จำหน่ายผู้ป่วย</h3>
              <p class="header-subtitle">
                <span class="patient-name-highlight">{{ patientName }}</span>
                <span class="header-sep" aria-hidden="true">·</span>
                <span class="header-hn">HN {{ hn }}</span>
              </p>
            </div>
          </div>

          <!-- Warning notice -->
          <div class="warning-notice" role="note">
            <AlertTriangle :size="13" class="warning-icon" aria-hidden="true" />
            <span>
              การดำเนินการนี้จะเปลี่ยนสถานะผู้ป่วยออกจากรายการกำลังรักษา
              และบันทึกผลการรักษาขั้นสุดท้าย
            </span>
          </div>

          <!-- Form -->
          <form
            id="discharge-form"
            class="discharge-form"
            @submit.prevent="handleSubmit"
            novalidate
          >
            <!-- Outcome select -->
            <div class="form-group">
              <label class="form-label" for="dc-outcome">
                ผลการรักษา
                <span class="required" aria-hidden="true">*</span>
              </label>
              <div class="select-wrap">
                <select
                  id="dc-outcome"
                  class="form-select"
                  v-model="form.outcome"
                  :disabled="isSubmitting"
                  required
                >
                  <option value="" disabled>— เลือกผลการรักษา —</option>
                  <option
                    v-for="opt in OUTCOME_OPTIONS"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.labelTh }} ({{ opt.labelEn }})
                  </option>
                </select>
              </div>

              <!-- Outcome preview badge -->
              <Transition name="badge-fade">
                <div
                  v-if="selectedOutcomeConfig"
                  class="outcome-preview"
                  :style="{
                    background: selectedOutcomeConfig.bg,
                    color: selectedOutcomeConfig.text,
                    borderColor: selectedOutcomeConfig.border,
                  }"
                  aria-live="polite"
                >
                  <span class="outcome-preview-dot"
                    :style="{ background: selectedOutcomeConfig.text }"
                  />
                  {{ selectedOutcomeConfig.labelTh }} — {{ selectedOutcomeConfig.labelEn }}
                </div>
              </Transition>
            </div>

            <!-- Dates row -->
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="dc-date">
                  วันที่จำหน่าย
                  <span class="required" aria-hidden="true">*</span>
                </label>
                <input
                  id="dc-date"
                  type="date"
                  class="form-input"
                  v-model="form.outcome_date"
                  required
                  :disabled="isSubmitting"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="dc-end">วันที่สิ้นสุดการรักษา</label>
                <input
                  id="dc-end"
                  type="date"
                  class="form-input"
                  v-model="form.treatment_end"
                  :disabled="isSubmitting"
                />
              </div>
            </div>

            <!-- Notes -->
            <div class="form-group">
              <label class="form-label" for="dc-notes">บันทึกเพิ่มเติม</label>
              <textarea
                id="dc-notes"
                class="form-textarea"
                v-model="form.notes"
                rows="3"
                placeholder="สาเหตุ เหตุการณ์สำคัญ หรือข้อสังเกตเพิ่มเติม..."
                :disabled="isSubmitting"
              />
            </div>

            <!-- Created by -->
            <div class="form-group">
              <label class="form-label" for="dc-by">บันทึกโดย</label>
              <input
                id="dc-by"
                type="text"
                class="form-input"
                v-model="form.created_by"
                placeholder="ชื่อเจ้าหน้าที่"
                :disabled="isSubmitting"
              />
            </div>

            <!-- Submit error -->
            <Transition name="badge-fade">
              <div v-if="submitError" class="form-error" role="alert">
                <AlertTriangle :size="14" style="flex-shrink: 0; margin-top: 1px" aria-hidden="true" />
                <span>{{ submitError }}</span>
              </div>
            </Transition>
          </form>

          <!-- Actions -->
          <div class="modal-actions">
            <button
              type="button"
              class="btn-cancel"
              @click="close"
              :disabled="isSubmitting"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              form="discharge-form"
              class="btn-discharge"
              :disabled="isSubmitting || !form.outcome"
            >
              <Loader2 v-if="isSubmitting" :size="14" class="spin" aria-hidden="true" />
              <LogOut v-else :size="14" aria-hidden="true" />
              <span>{{ isSubmitting ? 'กำลังบันทึก...' : 'จำหน่ายผู้ป่วย' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--modal-overlay);
}

.modal-panel {
  background: var(--modal-bg);
  border: var(--border-standard);
  border-radius: var(--modal-radius);
  box-shadow: var(--modal-shadow);
  max-width: var(--modal-max-sm);
  width: 100%;
  outline: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
  padding: var(--space-10) var(--space-12) var(--space-9);
  background: linear-gradient(
    135deg,
    var(--warning-tint-7) 0%,
    var(--warning-tint-3) 100%
  );
  border-bottom: 1px solid var(--warning-border-15);
}

.header-icon-wrap {
  width: 42px;
  height: 42px;
  background: var(--warning-bg-14);
  color: var(--color-warning);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.header-title {
  font-size: var(--text-heading);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  letter-spacing: -0.2px;
  margin: 0;
  line-height: var(--leading-tight);
}

.header-subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-body-sm);
  color: var(--color-text-secondary);
  margin: 0;
  flex-wrap: wrap;
}

.patient-name-highlight {
  font-weight: var(--weight-emphasis);
  color: var(--color-text);
}

.header-sep {
  color: var(--color-text-muted);
  line-height: 1;
}

.header-hn {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-weight: var(--weight-ui);
  font-variant-numeric: tabular-nums;
}

.warning-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  margin: var(--space-8) var(--space-12) 0;
  background: var(--tint-orange);
  border-left: 3px solid var(--warning-border-50);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 9px 12px;
  font-size: var(--text-sm);
  color: var(--palette-orange-dark);
  line-height: 1.55;
}

.warning-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning);
  opacity: 0.9;
}

.discharge-form {
  padding: var(--space-8) var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.form-row-2 {
  display: flex;
  gap: var(--space-6);
}

.form-row-2 > .form-group {
  flex: 1;
  min-width: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  color: var(--color-text-secondary);
  user-select: none;
}

.required {
  color: var(--color-warning);
  margin-left: 1px;
}

.form-input,
.form-textarea {
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  color: var(--color-text);
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-sm);
  padding: var(--input-padding-lg);
  width: 100%;
  transition: var(--transition-input);
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-warning);
  box-shadow: var(--shadow-focus-ring-error);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--color-surface-alt);
}

.form-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.55;
}

.select-wrap {
  position: relative;
}

.select-wrap::after {
  content: '';
  position: absolute;
  right: 11px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--color-text-muted);
  pointer-events: none;
}

.form-select {
  font-family: var(--font-family);
  font-size: var(--text-body-sm);
  color: var(--color-text);
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-sm);
  padding: var(--input-padding-lg) 30px var(--input-padding-lg) var(--space-5);
  width: 100%;
  appearance: none;
  cursor: pointer;
  transition: var(--transition-input);
}

.form-select:focus {
  outline: none;
  border-color: var(--color-warning);
  box-shadow: var(--shadow-focus-ring-error);
}

.form-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--color-surface-alt);
}

.outcome-preview {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-size: var(--text-sm);
  font-weight: var(--weight-emphasis);
  align-self: flex-start;
}

.outcome-preview-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-circle);
  flex-shrink: 0;
}

.form-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--alert-error-bg);
  border: 1px solid var(--border-color-error);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: var(--text-body-sm);
  font-weight: var(--weight-ui);
  color: var(--color-warning);
  line-height: 1.45;
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  padding: var(--space-7) var(--space-12);
  border-top: var(--border-standard);
  background: var(--color-surface-alt);
}

.btn-cancel {
  padding: var(--space-4) var(--space-9);
  background: var(--btn-secondary-bg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-emphasis);
  font-family: var(--font-family);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: var(--transition-btn);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--btn-secondary-hover);
}

.btn-discharge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: var(--space-4) var(--space-10);
  background: var(--btn-danger-bg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--text-body-sm);
  font-weight: var(--weight-heading);
  font-family: var(--font-family);
  cursor: pointer;
  color: var(--btn-danger-text);
  transition: var(--transition-btn-hover);
}

.btn-discharge:hover:not(:disabled) {
  background: var(--btn-danger-hover);
}

.btn-discharge:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-cancel:disabled,
.btn-discharge:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-enter-active {
  transition: var(--transition-modal);
}

.modal-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-panel {
  transition: opacity var(--duration-slow) var(--ease-standard),
    transform var(--duration-slow) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-leave-active .modal-panel {
  transition: opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}

.badge-fade-enter-active {
  transition: var(--transition-fade-slide);
}

.badge-fade-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.badge-fade-enter-from,
.badge-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.spin {
  animation: spin var(--duration-animate) linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>