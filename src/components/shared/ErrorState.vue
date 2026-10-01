<script setup lang="ts">
import { AlertTriangle, RefreshCw } from '@lucide/vue';

withDefaults(
  defineProps<{
    message: string;
    title?: string;
    retryLabel?: string;
  }>(),
  {
    title: 'ไม่สามารถโหลดข้อมูลได้',
    retryLabel: 'ลองใหม่',
  },
);

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <div class="view-state" role="alert">
    <div class="view-state__panel">
      <AlertTriangle
        :size="44"
        class="view-state__icon view-state__icon--error"
        aria-hidden="true"
      />
      <span class="view-state__title">{{ title }}</span>
      <span class="view-state__sub">{{ message }}</span>
      <button type="button" class="btn btn-ghost view-state__retry" @click="emit('retry')">
        <RefreshCw :size="13" aria-hidden="true" />
        {{ retryLabel }}
      </button>
    </div>
  </div>
</template>
