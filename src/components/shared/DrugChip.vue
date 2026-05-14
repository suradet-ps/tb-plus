<script setup lang="ts">
import { computed } from 'vue';

type DrugClass = 'H' | 'R' | 'Z' | 'E';
type ChipSize = 'sm' | 'md';

const props = withDefaults(
  defineProps<{
    drug: string;
    size?: ChipSize;
  }>(),
  {
    size: 'sm',
  },
);

interface DrugConfig {
  bg: string;
  color: string;
  title: string;
  label: string;
}

const drugMap: Record<DrugClass, DrugConfig> = {
  H: { bg: '#e8f8f7', color: '#2a9d99', title: 'Isoniazid (INH)', label: 'H' },
  R: { bg: '#fdf0e8', color: '#dd5b00', title: 'Rifampicin (RIF)', label: 'R' },
  Z: { bg: '#f0ebe6', color: '#523410', title: 'Pyrazinamide (PZA)', label: 'Z' },
  E: { bg: '#e8f2fd', color: '#0075de', title: 'Ethambutol (EMB)', label: 'E' },
};

/** Map HOSxP drug icodes → drug class letter.
 *  Handles legacy enrollment data that stored icodes instead of class letters.
 */
const icodeToClass: Record<string, DrugClass> = {
  '1430104': 'H',
  '1000265': 'R',
  '1000264': 'R',
  '1600004': 'E',
  '1000129': 'E',
  '1000258': 'Z',
};

const resolvedClass = computed<DrugClass | null>(() => {
  const upper = props.drug.toUpperCase() as DrugClass;
  if (drugMap[upper]) return upper;
  // Fall back to icode lookup (legacy data)
  return icodeToClass[props.drug] ?? null;
});

const config = computed<DrugConfig>(() => {
  if (resolvedClass.value) {
    return drugMap[resolvedClass.value];
  }
  return {
    bg: 'rgba(0, 0, 0, 0.06)',
    color: 'var(--color-text-secondary)',
    title: props.drug,
    label: props.drug,
  };
});
</script>

<template>
  <span
    class="drug-chip"
    :class="`drug-chip--${size}`"
    :style="{
      backgroundColor: config.bg,
      color: config.color,
    }"
    :title="config.title"
    :aria-label="config.title"
  >
    {{ config.label }}
  </span>
</template>

<style scoped>
/* ── Base chip ── */
.drug-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  font-family: var(--font);
  font-weight: 600;
  letter-spacing: 0.125px;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

/* ── Size variants ── */
.drug-chip--sm {
  font-size: 11px;
  padding: 2px 8px;
}

.drug-chip--md {
  font-size: 13px;
  padding: 3px 10px;
}
</style>