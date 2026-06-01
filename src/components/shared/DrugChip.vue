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
  H: { bg: 'var(--drug-H-bg)', color: 'var(--drug-H)', title: 'Isoniazid (INH)', label: 'H' },
  R: { bg: 'var(--drug-R-bg)', color: 'var(--drug-R)', title: 'Rifampicin (RIF)', label: 'R' },
  Z: { bg: 'var(--drug-Z-bg)', color: 'var(--drug-Z)', title: 'Pyrazinamide (PZA)', label: 'Z' },
  E: { bg: 'var(--drug-E-bg)', color: 'var(--drug-E)', title: 'Ethambutol (EMB)', label: 'E' },
};

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
  return icodeToClass[props.drug] ?? null;
});

const config = computed<DrugConfig>(() => {
  if (resolvedClass.value) {
    return drugMap[resolvedClass.value];
  }
  return {
    bg: 'var(--tint-active)',
    color: 'var(--color-text-secondary)',
    title: props.drug,
    label: props.drug,
  };
});
</script>

<template>
  <span
    class="chip"
    :class="`chip--${size}`"
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
/*
 * Uses global .chip / .chip--sm / .chip--md classes from base.css.
 * No component-specific overrides needed — all values are tokenized.
 */
</style>
