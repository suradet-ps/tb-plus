<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onMounted, onUnmounted } from 'vue';

import AppSidebar from '@/components/layout/AppSidebar.vue';
import { useAlertStore } from '@/stores/alerts';
import { useAppointmentsStore } from '@/stores/appointments';
import { useSettingsStore } from '@/stores/settings';

const alertStore = useAlertStore();
const settingsStore = useSettingsStore();
const appointmentsStore = useAppointmentsStore();

let startupRetryTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await getCurrentWindow().show();
  const splashStart = Date.now();

  // Load everything (MySQL config + drug classes + regimens + HOSxP + alerts)
  await settingsStore.loadAllSettings();
  await settingsStore.checkConnection();
  alertStore.startAutoRefresh();
  appointmentsStore.fetchAppointments();

  if (!settingsStore.isConnected) {
    let attempts = 0;
    startupRetryTimer = setInterval(async () => {
      attempts++;
      await settingsStore.checkConnection();
      if (settingsStore.isConnected || attempts >= 5) {
        if (startupRetryTimer) {
          clearInterval(startupRetryTimer);
        }
        startupRetryTimer = null;
        if (settingsStore.isConnected) {
          appointmentsStore.fetchAppointments();
        }
      }
    }, 2000);
  }

  const elapsed = Date.now() - splashStart;
  setTimeout(
    () => {
      const overlay = document.getElementById('splash-overlay');
      if (overlay) {
        overlay.classList.add('splash-fade-out');
        setTimeout(() => overlay.remove(), 350);
      }
    },
    Math.max(0, 800 - elapsed),
  );
});

onUnmounted(() => {
  if (startupRetryTimer) {
    clearInterval(startupRetryTimer);
    startupRetryTimer = null;
  }
});
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* ─── App Shell Layout ──────────────────────────────────────────────── */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-bg-alt);
}

.app-main {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
  background-color: var(--color-bg);
}
</style>