<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <header class="app-header">
    <h1 class="app-header__title">{{ title }}</h1>
    <p v-if="subtitle" class="app-header__subtitle">{{ subtitle }}</p>
  </header>
</template>

<style scoped>
.app-header {
  padding: var(--space-12) var(--space-16) 0 var(--space-16);
}

.app-header__title {
  font-family: var(--font-family);
  font-size: var(--text-display-sm);
  font-weight: var(--weight-heading);
  color: var(--color-text);
  letter-spacing: var(--tracking-heading);
  line-height: 1.27;
}

.app-header__subtitle {
  font-family: var(--font-family);
  font-size: var(--text-body);
  font-weight: var(--weight-body);
  color: var(--color-text-secondary);
  margin-top: var(--space-2);
  line-height: 1.43;
}
</style>
