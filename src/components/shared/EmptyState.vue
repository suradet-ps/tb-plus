<script setup lang="ts">
import { Inbox } from '@lucide/vue';

defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="view-state">
    <div class="view-state__panel">
      <slot name="icon">
        <Inbox :size="44" class="view-state__icon" aria-hidden="true" />
      </slot>
      <span class="view-state__title">{{ title }}</span>
      <span v-if="subtitle" class="view-state__sub">{{ subtitle }}</span>
      <slot />
    </div>
  </div>
</template>
