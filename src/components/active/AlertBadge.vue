<script setup lang="ts">
import type { PatientAlert } from '@/types/alert';

const props = defineProps<{ alert: PatientAlert }>();

const isRed = props.alert.severity === 'red';
</script>

<template>
  <span
    class="alert-badge"
    :class="isRed ? 'alert-badge--red' : 'alert-badge--yellow'"
    :title="alert.details ?? alert.message"
  >
    <span class="alert-badge__dot" />
    <span class="alert-badge__text">{{ alert.message }}</span>
  </span>
</template>

<style scoped>
.alert-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
  max-width: 200px;
}

.alert-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-circle);
  flex-shrink: 0;
}

.alert-badge__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-badge--red {
  background: rgba(221, 91, 0, 0.12);
  color: var(--color-alert-orange);
}

.alert-badge--red .alert-badge__dot {
  background: var(--color-alert-orange);
}

.alert-badge--yellow {
  background: rgba(245, 166, 35, 0.12);
  color: var(--color-alert-yellow);
}

.alert-badge--yellow .alert-badge__dot {
  background: var(--palette-amber);
}
</style>
