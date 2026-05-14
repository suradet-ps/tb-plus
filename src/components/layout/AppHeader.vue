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
  padding: 24px 32px 0 32px;
}

.app-header__title {
  font-family: var(--font);
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.25px;
  line-height: 1.27;
}

.app-header__subtitle {
  font-family: var(--font);
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.43;
}
</style>