<script setup lang="ts">
import { WifiOff } from '@lucide/vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { onMounted, onUnmounted, ref, watch } from 'vue';

import AppSidebar from '@/components/layout/AppSidebar.vue';
import { useAlertStore } from '@/stores/alerts';
import { useAppointmentsStore } from '@/stores/appointments';
import { usePatientStore } from '@/stores/patient';
import { useScreeningStore } from '@/stores/screening';
import { useSettingsStore } from '@/stores/settings';

const alertStore = useAlertStore();
const settingsStore = useSettingsStore();
const appointmentsStore = useAppointmentsStore();
const patientStore = usePatientStore();
const screeningStore = useScreeningStore();

const connectionAnnounce = ref('');
let prevConnected: boolean | null = null;

watch(
  () => settingsStore.isConnected,
  (connected) => {
    if (prevConnected !== null && prevConnected !== connected) {
      connectionAnnounce.value = connected
        ? 'เชื่อมต่อ HOSxP สำเร็จ'
        : 'ขาดการเชื่อมต่อ HOSxP — ข้อมูลอาจไม่เป็นปัจจุบัน';
    }
    prevConnected = connected;
  },
);

function handleReconnect() {
  alertStore.refresh();
  appointmentsStore.fetchAppointments();
  patientStore.fetchActivePatients();
  if (screeningStore.results.length > 0) {
    screeningStore.search();
  }
}

let startupRetryTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  await getCurrentWindow().show();
  const splashStart = Date.now();

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

  settingsStore.startConnectionMonitor(handleReconnect);

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
  settingsStore.stopConnectionMonitor();
  if (startupRetryTimer) {
    clearInterval(startupRetryTimer);
    startupRetryTimer = null;
  }
});
</script>

<template>
  <div class="app-shell">
    <!-- Skip to main content link (visible on keyboard focus only) -->
    <a href="#main-content" class="skip-link">ข้ามไปยังเนื้อหา</a>

    <AppSidebar />
    <main id="main-content" class="app-main" tabindex="-1">
      <div v-if="settingsStore.connectionStatus === 'checking'" class="mysql-banner mysql-banner--checking" role="status">
        <span class="mysql-banner-icon" aria-hidden="true">...</span>
        <span>กำลังตรวจสอบการเชื่อมต่อ HOSxP...</span>
      </div>
      <div v-else-if="!settingsStore.isConnected" class="mysql-banner" role="alert">
        <WifiOff :size="14" class="mysql-banner-icon" aria-hidden="true" />
        <span>ไม่สามารถเชื่อมต่อ HOSxP ได้ — ข้อมูลการจ่ายยาและข้อมูลผู้ป่วยอาจไม่เป็นปัจจุบัน</span>
      </div>
      <RouterView />
    </main>

    <!-- Live region for connection status announcements -->
    <div class="sr-only" role="status" aria-live="polite">{{ connectionAnnounce }}</div>
  </div>
</template>

<style scoped>
/* -- Skip to content link -- */
.skip-link {
  position: absolute;
  top: -100px;
  left: var(--space-4);
  z-index: 9999;
  padding: var(--space-4) var(--space-6);
  background: var(--color-accent);
  color: var(--color-text-inverse);
  font-family: var(--font-family);
  font-size: var(--text-body);
  font-weight: var(--weight-emphasis);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: top var(--duration-fast) var(--ease-standard);
}

.skip-link:focus {
  top: var(--space-4);
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

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

.mysql-banner--checking {
  background: var(--tint-blue);
  border-bottom-color: rgba(0, 117, 222, 0.15);
  color: var(--palette-blue);
}

.mysql-banner-icon {
  flex-shrink: 0;
  opacity: 0.8;
}
</style>