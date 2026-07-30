import { invoke } from '@tauri-apps/api/core';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface AppConfig extends DbConfig {
  staff_names: string[];
  regimens: string[];
}

export interface HosxpSettings {
  clinic_code: string;
}

export interface AlertThresholds {
  overdue_days: number;
  lost_followup_days: number;
  e_overrun_lookback_days: number;
  phase_transition_lookback_days: number;
}

export interface DrugClassEntry {
  class: string;
  icodes: string[];
  name: string;
}

export interface DrugItem {
  icode: string;
  name: string;
  shortname: string | null;
  strength: string | null;
  units: string | null;
}

export interface DosageDrugCandidate {
  class: string;
  icode: string;
  drug_name: string;
  strength: string | null;
  units: string | null;
}

export interface DosageRule {
  class: string;
  icode: string;
  drug_name: string;
  strength: string | null;
  units: string | null;
  min_mg_per_kg_day: number;
  max_mg_per_kg_day: number;
}

export interface RegimenPhase {
  phase: string;
  months: number;
  drug_classes: string[];
}

export interface RegimenEntry {
  name: string;
  phases: RegimenPhase[];
}

const DEFAULT_HOST = {
  host: 'localhost',
  port: 3306,
  database: 'hosxp',
  username: 'root',
  password: '',
};

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

export const useSettingsStore = defineStore('settings', () => {
  const dbConfig = ref<DbConfig>({ ...DEFAULT_HOST });
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const connectionError = ref<string | null>(null);
  const connectionStatus = ref<ConnectionStatus>('disconnected');
  const lastConnectedAt = ref<string | null>(null);

  // Connection monitor state
  let connectionMonitorTimer: ReturnType<typeof setInterval> | null = null;
  let onReconnectCallback: (() => void) | null = null;

  // Hospital-specific — start empty, filled by setup wizard or loadAllSettings()
  const staffNames = ref<string[]>([]);
  const drugClasses = ref<DrugClassEntry[]>([]);
  const regimenDefinitions = ref<RegimenEntry[]>([]);
  const dosageRules = ref<DosageRule[]>([]);
  const hosxpSettings = ref<HosxpSettings>({ clinic_code: '' });
  const alertThresholds = ref<AlertThresholds>({
    overdue_days: 35,
    lost_followup_days: 60,
    e_overrun_lookback_days: 30,
    phase_transition_lookback_days: 35,
  });

  // -- Backward-compat: drugCodes derived from drugClasses --
  const drugCodes = ref<Record<string, string[]>>({});

  function syncDrugCodesFromClasses() {
    const map: Record<string, string[]> = {};
    for (const entry of drugClasses.value) {
      map[entry.class.toUpperCase()] = entry.icodes;
    }
    drugCodes.value = map;
  }

  function buildAppConfig(): AppConfig {
    return {
      ...dbConfig.value,
      staff_names: [...staffNames.value],
      regimens: [],
    };
  }

  async function saveAllSettings(): Promise<void> {
    await invoke('save_db_config', { config: buildAppConfig() });
  }

  // -- MySQL connection --

  async function testConnection(config: DbConfig): Promise<boolean> {
    try {
      isConnecting.value = true;
      connectionError.value = null;
      return await invoke<boolean>('test_mysql_connection', { config });
    } catch (e) {
      connectionError.value = String(e);
      return false;
    } finally {
      isConnecting.value = false;
    }
  }

  async function connect(config: DbConfig): Promise<void> {
    try {
      isConnecting.value = true;
      connectionStatus.value = 'checking';
      connectionError.value = null;
      await invoke('connect_mysql', { config });
      dbConfig.value = { ...config };
      isConnected.value = true;
      connectionStatus.value = 'connected';
      lastConnectedAt.value = new Date().toISOString();
      try {
        await saveAllSettings();
      } catch (saveErr) {
        connectionError.value = `เชื่อมต่อสำเร็จ แต่บันทึกการตั้งค่าไม่สำเร็จ: ${String(saveErr)}`;
      }
    } catch (e) {
      connectionError.value = String(e);
      isConnected.value = false;
      connectionStatus.value = 'disconnected';
    } finally {
      isConnecting.value = false;
    }
  }

  async function checkConnection(): Promise<void> {
    try {
      const connected = await invoke<boolean>('get_mysql_status');
      const wasDisconnected = !isConnected.value;
      isConnected.value = connected;
      connectionStatus.value = connected ? 'connected' : 'disconnected';
      if (connected) {
        lastConnectedAt.value = new Date().toISOString();
        // If we just reconnected, notify the app so it can refresh data
        if (wasDisconnected && onReconnectCallback) {
          onReconnectCallback();
        }
      }
    } catch {
      isConnected.value = false;
      connectionStatus.value = 'disconnected';
    }
  }

  /**
   * Start periodic connection monitoring. Checks every 30 seconds.
   * When connection transitions from disconnected → connected, fires onReconnect callback.
   */
  function startConnectionMonitor(onReconnect: () => void): void {
    stopConnectionMonitor();
    onReconnectCallback = onReconnect;
    connectionMonitorTimer = setInterval(() => {
      void checkConnection();
    }, 30_000);
  }

  function stopConnectionMonitor(): void {
    if (connectionMonitorTimer) {
      clearInterval(connectionMonitorTimer);
      connectionMonitorTimer = null;
    }
    onReconnectCallback = null;
  }

  async function loadSavedConfig(): Promise<void> {
    try {
      const saved = await invoke<AppConfig | null>('load_db_config');
      if (saved) {
        dbConfig.value = {
          host: saved.host,
          port: saved.port,
          database: saved.database,
          username: saved.username,
          password: saved.password,
        };
      }
    } catch (e) {
      console.warn('Could not load saved config:', e);
    }
  }

  async function deleteSavedConfig(): Promise<void> {
    try {
      await invoke('delete_db_config');
    } catch (e) {
      console.warn('Could not delete saved config:', e);
    } finally {
      dbConfig.value = { ...DEFAULT_HOST };
    }
  }

  // -- Load ALL settings from backend (after restart) --

  async function loadAllSettings(): Promise<void> {
    try {
      drugClasses.value = await invoke<DrugClassEntry[]>('load_drug_classes');
      syncDrugCodesFromClasses();
    } catch {
      drugClasses.value = [];
    }
    try {
      regimenDefinitions.value = await invoke<RegimenEntry[]>('get_regimen_definitions');
    } catch {
      regimenDefinitions.value = [];
    }
    try {
      dosageRules.value = await invoke<DosageRule[]>('load_dosage_rules');
    } catch {
      dosageRules.value = [];
    }
    try {
      hosxpSettings.value = await invoke<HosxpSettings>('load_hosxp_config');
    } catch {
      /* keep defaults */
    }
    try {
      alertThresholds.value = await invoke<AlertThresholds>('load_alert_config');
    } catch {
      /* keep defaults */
    }
    try {
      const saved = await invoke<AppConfig | null>('load_db_config');
      if (saved) {
        dbConfig.value = {
          host: saved.host,
          port: saved.port,
          database: saved.database,
          username: saved.username,
          password: saved.password,
        };
        staffNames.value = saved.staff_names ?? [];
      }
    } catch {
      /* keep empty */
    }
  }

  // -- Staff names --

  async function addStaffName(name: string): Promise<boolean> {
    const trimmedName = name.trim();
    if (!trimmedName || staffNames.value.includes(trimmedName)) return false;
    const previous = [...staffNames.value];
    staffNames.value = [...previous, trimmedName];
    try {
      await saveAllSettings();
      return true;
    } catch (e) {
      staffNames.value = previous;
      throw e;
    }
  }

  async function removeStaffName(name: string): Promise<boolean> {
    const previous = [...staffNames.value];
    const next = previous.filter((item) => item !== name);
    if (next.length === previous.length) return false;
    staffNames.value = next;
    try {
      await saveAllSettings();
      return true;
    } catch (e) {
      staffNames.value = previous;
      throw e;
    }
  }

  // -- Drug search (setup wizard) --

  async function searchDrugs(query: string): Promise<DrugItem[]> {
    return await invoke<DrugItem[]>('search_hosxp_drugs', { query });
  }

  async function searchClinics(query: string): Promise<{ clinic: string; name: string | null }[]> {
    return await invoke<{ clinic: string; name: string | null }[]>('search_hosxp_clinics', {
      query,
    });
  }

  // -- Drug classes --

  async function saveDrugClasses(): Promise<void> {
    syncDrugCodesFromClasses();
    await invoke('save_drug_classes', { classes: drugClasses.value });
  }

  // -- Regimen definitions (structured) --

  async function saveRegimenDefinitions(): Promise<void> {
    await invoke('save_regimen_definitions', { regimens: regimenDefinitions.value });
  }

  async function saveDosageRules(): Promise<void> {
    await invoke('save_dosage_rules', { rules: dosageRules.value });
  }

  async function loadConfiguredDosageDrugs(): Promise<DosageDrugCandidate[]> {
    return await invoke<DosageDrugCandidate[]>('get_configured_dosage_drugs');
  }

  // -- HOSxP config --

  async function saveHosxpSettings(): Promise<void> {
    await invoke('save_hosxp_config', { config: hosxpSettings.value });
  }

  // -- Alert thresholds --

  async function saveAlertThresholds(): Promise<void> {
    await invoke('save_alert_config', { config: alertThresholds.value });
  }

  // -- Setup status --

  async function markSetupComplete(): Promise<void> {
    try {
      await invoke('mark_setup_complete');
    } catch (e) {
      console.error('Failed to mark setup complete:', e);
      throw e;
    }
  }

  async function isSetupComplete(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_setup_complete');
    } catch {
      return false;
    }
  }

  return {
    dbConfig,
    isConnected,
    isConnecting,
    connectionError,
    connectionStatus,
    lastConnectedAt,
    staffNames,
    drugCodes,
    drugClasses,
    regimenDefinitions,
    dosageRules,
    hosxpSettings,
    alertThresholds,
    syncDrugCodesFromClasses,
    testConnection,
    connect,
    checkConnection,
    startConnectionMonitor,
    stopConnectionMonitor,
    saveAllSettings,
    loadSavedConfig,
    deleteSavedConfig,
    addStaffName,
    removeStaffName,
    searchDrugs,
    searchClinics,
    saveDrugClasses,
    saveRegimenDefinitions,
    saveDosageRules,
    loadConfiguredDosageDrugs,
    loadAllSettings,
    saveHosxpSettings,
    saveAlertThresholds,
    markSetupComplete,
    isSetupComplete,
  };
});
