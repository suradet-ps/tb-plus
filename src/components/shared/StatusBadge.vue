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
  active: { label: 'กำลังรักษา', bg: 'rgba(26, 174, 57, 0.1)', color: '#1aae39' },
  completed: { label: 'รักษาหาย/ครบ', bg: 'rgba(42, 157, 153, 0.1)', color: '#2a9d99' },
  transferred: { label: 'ส่งต่อ', bg: '#f2f9ff', color: '#097fe8' },
  died: { label: 'เสียชีวิต', bg: 'rgba(49, 48, 46, 0.1)', color: '#615d59' },
  defaulted: { label: 'ขาดการรักษา', bg: 'rgba(221, 91, 0, 0.1)', color: '#dd5b00' },
};

const _config = computed<StatusConfig>(() => {
  return (
    statusMap[props.status as Status] ?? {
      label: props.status,
      bg: 'rgba(0, 0, 0, 0.06)',
      color: 'var(--color-text-secondary)',
    }
  );
});
</script>

<template>
  <span
    class="status-badge"
    :style="{
      backgroundColor: config.bg,
      color: config.color,
    }"
  >
    {{ config.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  padding: 3px 10px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.125px;
  line-height: 1.33;
  white-space: nowrap;
  user-select: none;
  /* no border per spec */
}
</style>