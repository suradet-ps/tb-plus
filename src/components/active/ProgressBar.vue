<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  currentMonth: number | null;
  totalMonths: number | null;
  phase?: string | null;
}>();

const pct = computed(() => {
  if (!props.currentMonth || !props.totalMonths || props.totalMonths === 0) return 0;
  return Math.min(100, Math.round((props.currentMonth / props.totalMonths) * 100));
});

const isOverrun = computed(() => (props.currentMonth ?? 0) > (props.totalMonths ?? 999));

const barColor = computed(() => {
  if (isOverrun.value) return '#dd5b00';
  if (props.phase === 'intensive') return '#dd5b00';
  return '#2a9d99';
});
</script>

<template>
  <div class="progress-wrapper">
    <div class="progress-labels">
      <span class="progress-text">
        เดือนที่ {{ currentMonth ?? '?' }} / {{ totalMonths ?? '?' }}
      </span>
      <span class="progress-pct" :style="{ color: barColor }">{{ pct }}%</span>
    </div>
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: pct + '%', background: barColor }"
        :class="{ 'progress-overrun': isOverrun }"
      />
    </div>
  </div>
</template>

<style scoped>
.progress-wrapper {
  width: 100%;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.progress-text {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.progress-pct {
  font-size: 11px;
  font-weight: 600;
}

.progress-track {
  height: 5px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width 0.4s ease;
}

.progress-overrun {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
</style>