<script setup lang="ts">
import { WifiOff } from '@lucide/vue';
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
      <div v-if="!settingsStore.isConnected" class="mysql-banner">
        <WifiOff :size="14" class="mysql-banner-icon" />
        <span>ยังไม่ได้เชื่อมต่อ HOSxP — ข้อมูลการจ่ายยาและข้อมูลผู้ป่วยอาจไม่เป็นปัจจุบัน</span>
      </div>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* -- App Shell Layout -- */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-surface-alt);
}

.app-main {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow-y: auto;
  background-color: var(--color-surface);
}

/* -- MySQL Disconnected Banner -- */
.mysql-banner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  background: var(--tint-orange);
  border-bottom: 1px solid var(--warning-border-15);
  font-size: var(--text-body-sm);
  color: var(--palette-orange-dark);
  line-height: var(--leading-body);
}

.mysql-banner-icon {
  flex-shrink: 0;
  opacity: 0.8;
}
</style>