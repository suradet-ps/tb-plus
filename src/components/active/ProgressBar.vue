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
  if (isOverrun.value) return 'var(--color-phase-intensive)';
  if (props.phase === 'intensive') return 'var(--color-phase-intensive)';
  return 'var(--color-phase-continuation)';
});
</script>

<template>
  <div class="progress">
    <div class="progress__labels">
      <span class="progress__text">
        เดือนที่ {{ currentMonth ?? '?' }} / {{ totalMonths ?? '?' }}
      </span>
      <span class="progress__pct" :style="{ color: barColor }">{{ pct }}%</span>
    </div>
    <div class="progress__track">
      <div
        class="progress__fill"
        :class="{ 'progress__fill--overrun': isOverrun }"
        :style="{ width: pct + '%', background: barColor }"
      />
    </div>
  </div>
</template>

<style scoped>
.progress {
  width: 100%;
}

.progress__labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.progress__text {
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.progress__pct {
  font-size: var(--text-caption);
  font-weight: var(--weight-emphasis);
}

.progress__track {
  height: var(--progress-height);
  background: var(--progress-track-bg);
  border-radius: var(--progress-radius);
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  border-radius: var(--progress-radius);
  transition: var(--transition-progress);
}

.progress__fill--overrun {
  animation: pulse var(--duration-loop) ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
