<script setup lang="ts">
import { Loader2 } from '@lucide/vue';

withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
  }>(),
  {
    title: 'กำลังโหลดข้อมูล...',
  },
);
</script>

<template>
  <div class="view-state" role="status">
    <div class="view-state__panel">
      <Loader2
        :size="34"
        class="spin view-state__icon view-state__icon--loading"
        aria-hidden="true"
      />
      <span class="view-state__title">{{ title }}</span>
      <span v-if="subtitle" class="view-state__sub">{{ subtitle }}</span>
    </div>
  </div>
</template>
