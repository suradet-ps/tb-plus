<script setup lang="ts">
import { computed } from 'vue';

type Status = 'active' | 'completed' | 'transferred' | 'died' | 'defaulted';

const props = defineProps<{
  status: string;
}>();

interface StatusConfig {
  label: string;
  bg: string;
  color: string;
}

const statusMap: Record<Status, StatusConfig> = {
  active: { label: 'กำลังรักษา', bg: 'var(--status-active-bg)', color: 'var(--status-active-text)' },
  completed: {
    label: 'รักษาหาย/ครบ',
    bg: 'var(--status-completed-bg)',
    color: 'var(--status-completed-text)',
  },
  transferred: {
    label: 'ส่งต่อ',
    bg: 'var(--status-transferred-bg)',
    color: 'var(--status-transferred-text)',
  },
  died: { label: 'เสียชีวิต', bg: 'var(--status-died-bg)', color: 'var(--status-died-text)' },
  defaulted: {
    label: 'ขาดการรักษา',
    bg: 'var(--status-defaulted-bg)',
    color: 'var(--status-defaulted-text)',
  },
};

const config = computed<StatusConfig>(() => {
  return (
    statusMap[props.status as Status] ?? {
      label: props.status,
      bg: 'var(--tint-active)',
      color: 'var(--color-text-secondary)',
    }
  );
});
</script>

<template>
  <span
    class="badge"
    :style="{
      backgroundColor: config.bg,
      color: config.color,
    }"
  >
    {{ config.label }}
  </span>
</template>

<style scoped>
/*
 * Uses global .badge class from base.css.
 * Scoped block only for any component-specific overrides.
 * All token values are CSS variables — no hardcoded values.
 */
</style>
