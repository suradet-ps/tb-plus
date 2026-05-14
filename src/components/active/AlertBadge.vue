<script setup lang="ts">
import type { PatientAlert } from '@/types/alert';

const props = defineProps<{ alert: PatientAlert }>();

const _isRed = props.alert.severity === 'red';
</script>

<template>
  <span
    class="alert-badge"
    :class="isRed ? 'alert-red' : 'alert-yellow'"
    :title="alert.details ?? alert.message"
  >
    <span class="alert-dot" />
    <span class="alert-text">{{ alert.message }}</span>
  </span>
</template>

<style scoped>
.alert-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  max-width: 200px;
}

.alert-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.alert-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alert-red {
  background: rgba(221, 91, 0, 0.12);
  color: #dd5b00;
}

.alert-red .alert-dot {
  background: #dd5b00;
}

.alert-yellow {
  background: rgba(245, 166, 35, 0.12);
  color: #c78b00;
}

.alert-yellow .alert-dot {
  background: #f5a623;
}
</style>