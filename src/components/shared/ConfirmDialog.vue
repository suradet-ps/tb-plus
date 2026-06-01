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
        <div
          class="dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          tabindex="-1"
          @pointerdown.stop
        >
          <h3 id="confirm-dialog-title" class="dialog-title">
            {{ title }}
          </h3>

          <p id="confirm-dialog-message" class="dialog-message">
            {{ message }}
          </p>

          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" @click="onCancel">
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="btn"
              :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
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
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--color-overlay-light);
}

.dialog-panel {
  background: var(--color-surface);
  border: var(--border-standard);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-deep);
  max-width: var(--dialog-max);
  width: 100%;
  padding: var(--dialog-padding);
  outline: none;
}

.dialog-title {
  font-family: var(--font-family);
  font-size: var(--text-heading-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  letter-spacing: -0.125px;
  line-height: var(--leading-snug);
  margin: 0;
}

.dialog-message {
  font-family: var(--font-family);
  font-size: var(--text-body);
  font-weight: var(--weight-body);
  color: var(--color-text-secondary);
  line-height: var(--leading-body);
  margin-top: var(--space-4);
}

.dialog-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-top: var(--space-12);
}

/* -- Transition classes -- */
.dialog-enter-active {
  transition: var(--transition-modal);
}

.dialog-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog-panel {
  transition: opacity var(--duration-slow) var(--ease-standard),
    transform var(--duration-slow) var(--ease-standard);
}

.dialog-leave-active .dialog-panel {
  transition: opacity var(--duration-base) var(--ease-standard),
    transform var(--duration-base) var(--ease-standard);
}

.dialog-enter-from .dialog-panel,
.dialog-leave-to .dialog-panel {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
</style>
