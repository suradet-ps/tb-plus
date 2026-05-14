<script setup lang="ts">
type DialogVariant = 'default' | 'danger';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: DialogVariant;
  }>(),
  {
    confirmText: 'ยืนยัน',
    cancelText: 'ยกเลิก',
    variant: 'default',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function close() {
  emit('update:modelValue', false);
}

function onConfirm() {
  emit('confirm');
  close();
}

function onCancel() {
  emit('cancel');
  close();
}

function onOverlayPointerDown(event: MouseEvent) {
  // Only close when clicking directly on the backdrop, not on the dialog panel
  if (event.target === event.currentTarget) {
    onCancel();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    onCancel();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="modelValue"
        class="dialog-overlay"
        role="presentation"
        @pointerdown="onOverlayPointerDown"
        @keydown="onKeydown"
      >
        <!-- Dialog panel — stop propagation so clicks inside don't hit the overlay -->
        <div
          class="dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          tabindex="-1"
          @pointerdown.stop
        >
          <!-- Title -->
          <h3 id="confirm-dialog-title" class="dialog-title">
            {{ title }}
          </h3>

          <!-- Message -->
          <p id="confirm-dialog-message" class="dialog-message">
            {{ message }}
          </p>

          <!-- Actions -->
          <div class="dialog-actions">
            <button type="button" class="btn btn-cancel" @click="onCancel">
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="btn btn-confirm"
              :class="{ 'btn-confirm--danger': variant === 'danger' }"
              @click="onConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop overlay ───────────────────────────────────────────────── */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
}

/* ── Dialog panel ───────────────────────────────────────────────────── */
.dialog-panel {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card); /* 12px */
  box-shadow: var(--shadow-deep);
  max-width: 400px;
  width: 100%;
  padding: 24px;
  outline: none; /* focus managed via focustrap / tabindex */
}

/* ── Title ──────────────────────────────────────────────────────────── */
.dialog-title {
  font-family: var(--font);
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.125px;
  line-height: 1.3;
  margin: 0;
}

/* ── Message ────────────────────────────────────────────────────────── */
.dialog-message {
  font-family: var(--font);
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-top: 8px;
}

/* ── Actions row ────────────────────────────────────────────────────── */
.dialog-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}

/* ── Shared button base ─────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm); /* 4px */
  padding: 6px 14px;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition:
    background 120ms ease,
    transform 80ms ease,
    box-shadow 120ms ease;
}

.btn:focus-visible {
  outline: 2px solid var(--color-blue);
  outline-offset: 2px;
}

.btn:active {
  transform: scale(0.97);
}

/* ── Cancel (secondary) ─────────────────────────────────────────────── */
.btn-cancel {
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
}

.btn-cancel:hover {
  background: rgba(0, 0, 0, 0.09);
}

.btn-cancel:active {
  background: rgba(0, 0, 0, 0.13);
}

/* ── Confirm (primary blue, default) ────────────────────────────────── */
.btn-confirm {
  background: var(--color-blue);
  color: #ffffff;
}

.btn-confirm:hover {
  background: var(--color-blue-active);
}

/* ── Confirm (danger — orange) ──────────────────────────────────────── */
.btn-confirm--danger {
  background: var(--color-orange);
  color: #ffffff;
}

.btn-confirm--danger:hover {
  /* darken orange ~15% */
  background: #b84a00;
}

/* ── Enter/leave transitions ────────────────────────────────────────── */

/* 1. Overlay backdrop: fade opacity */
.dialog-enter-active {
  transition: opacity 200ms ease;
}

.dialog-leave-active {
  transition: opacity 160ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

/*
 * 2. Dialog panel: scale + translate upward while overlay fades.
 *    Using descendant selector — both overlay and panel share the
 *    same component scope attribute, so scoped CSS resolves correctly.
 */
.dialog-enter-active .dialog-panel {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.dialog-leave-active .dialog-panel {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
</style>