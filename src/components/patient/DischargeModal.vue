<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle, Loader2, LogOut } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import type { OutcomeInput } from '@/types/treatment';

// ── Props & Emits ─────────────────────────────────────────────────────────

const props = defineProps<{
  modelValue: boolean;
  hn: string;
  patientName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'discharged'): void;
}>();

// ── Outcome options ───────────────────────────────────────────────────────

interface OutcomeOption {
  value: string;
  labelTh: string;
  labelEn: string;
  color: string;
}

const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    value: 'cured',
    labelTh: 'หาย',
    labelEn: 'Cured',
    color: '#1aae39',
  },
  {
    value: 'treatment_completed',
    labelTh: 'รักษาครบ',
    labelEn: 'Treatment completed',
    color: '#2a9d99',
  },
  {
    value: 'treatment_failed',
    labelTh: 'รักษาล้มเหลว',
    labelEn: 'Treatment failed',
    color: '#dd5b00',
  },
  {
    value: 'died',
    labelTh: 'เสียชีวิต',
    labelEn: 'Died',
    color: '#615d59',
  },
  {
    value: 'lost_to_followup',
    labelTh: 'ขาดการรักษา',
    labelEn: 'Lost to follow-up',
    color: '#dd5b00',
  },
  {
    value: 'transferred_out',
    labelTh: 'ส่งต่อ',
    labelEn: 'Transferred out',
    color: '#097fe8',
  },
  {
    value: 'not_evaluated',
    labelTh: 'ไม่ได้ประเมิน',
    labelEn: 'Not evaluated',
    color: '#a39e98',
  },
];

// ── Form state ────────────────────────────────────────────────────────────

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

// ── Reset on open ─────────────────────────────────────────────────────────

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

// ── Submit ────────────────────────────────────────────────────────────────

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

// ── Close helpers ─────────────────────────────────────────────────────────

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
          <!-- ── Warning header ──────────────────────────────────── -->
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

          <!-- ── Warning notice ──────────────────────────────────── -->
          <div class="warning-notice" role="note">
            <AlertTriangle :size="13" class="warning-icon" aria-hidden="true" />
            <span>
              การดำเนินการนี้จะเปลี่ยนสถานะผู้ป่วยออกจากรายการกำลังรักษา
              และบันทึกผลการรักษาขั้นสุดท้าย
            </span>
          </div>

          <!-- ── Form ────────────────────────────────────────────── -->
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
                    background: selectedOutcomeConfig.color + '18',
                    color: selectedOutcomeConfig.color,
                    borderColor: selectedOutcomeConfig.color + '40',
                  }"
                  aria-live="polite"
                >
                  <span class="outcome-preview-dot"
                    :style="{ background: selectedOutcomeConfig.color }"
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

          <!-- ── Actions ──────────────────────────────────────────── -->
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
/* ── Backdrop ──────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.35);
}

/* ── Dialog panel ──────────────────────────────────────────────────── */
.modal-panel {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-deep);
  max-width: 500px;
  width: 100%;
  outline: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Warning header ────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px 18px;
  background: linear-gradient(
    135deg,
    rgba(221, 91, 0, 0.07) 0%,
    rgba(221, 91, 0, 0.03) 100%
  );
  border-bottom: 1px solid rgba(221, 91, 0, 0.15);
}

.header-icon-wrap {
  width: 42px;
  height: 42px;
  background: rgba(221, 91, 0, 0.14);
  color: var(--color-orange);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.2px;
  margin: 0;
  line-height: 1.2;
}

.header-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  flex-wrap: wrap;
}

.patient-name-highlight {
  font-weight: 600;
  color: var(--color-text);
}

.header-sep {
  color: var(--color-text-muted);
  line-height: 1;
}

.header-hn {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

/* ── Warning notice ────────────────────────────────────────────────── */
.warning-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 16px 24px 0;
  background: rgba(221, 91, 0, 0.06);
  border-left: 3px solid rgba(221, 91, 0, 0.5);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 9px 12px;
  font-size: 12px;
  color: #b84a00;
  line-height: 1.55;
}

.warning-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-orange);
  opacity: 0.9;
}

/* ── Form ──────────────────────────────────────────────────────────── */
.discharge-form {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row-2 {
  display: flex;
  gap: 12px;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  user-select: none;
}

.required {
  color: var(--color-orange);
  margin-left: 1px;
}

/* ── Inputs ────────────────────────────────────────────────────────── */
.form-input,
.form-textarea {
  font-family: var(--font);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  width: 100%;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-orange);
  box-shadow: 0 0 0 3px rgba(221, 91, 0, 0.1);
}

.form-input:disabled,
.form-textarea:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--color-bg-alt);
}

.form-textarea {
  resize: vertical;
  min-height: 72px;
  line-height: 1.55;
}

/* ── Select wrapper ────────────────────────────────────────────────── */
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
  font-family: var(--font);
  font-size: 13px;
  color: var(--color-text);
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 30px 8px 10px;
  width: 100%;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-select:focus {
  outline: none;
  border-color: var(--color-orange);
  box-shadow: 0 0 0 3px rgba(221, 91, 0, 0.1);
}

.form-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  background: var(--color-bg-alt);
}

/* ── Outcome preview badge ─────────────────────────────────────────── */
.outcome-preview {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 600;
  align-self: flex-start;
}

.outcome-preview-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Form error ────────────────────────────────────────────────────── */
.form-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(221, 91, 0, 0.08);
  border: 1px solid rgba(221, 91, 0, 0.22);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-orange);
  line-height: 1.45;
}

/* ── Actions ───────────────────────────────────────────────────────── */
.modal-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 24px;
  border-top: var(--border);
  background: var(--color-bg-alt);
}

.btn-cancel {
  padding: 8px 18px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.btn-cancel:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.09);
}

.btn-discharge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 20px;
  background: var(--color-orange);
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  color: #fff;
  transition: background 0.15s, transform 0.1s;
}

.btn-discharge:hover:not(:disabled) {
  background: #b84a00;
}

.btn-discharge:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-cancel:disabled,
.btn-discharge:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── Modal enter/leave transitions ─────────────────────────────────── */
.modal-enter-active {
  transition: opacity 0.2s ease;
}

.modal-leave-active {
  transition: opacity 0.16s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-panel {
  transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-leave-active .modal-panel {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}

/* ── Badge / error fade ─────────────────────────────────────────────── */
.badge-fade-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.badge-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.badge-fade-enter-from,
.badge-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Spin animation ─────────────────────────────────────────────────── */
.spin {
  animation: spin 0.9s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>