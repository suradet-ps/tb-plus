import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AlertThresholds,
  type DbConfig,
  type DosageRule,
  type DrugClassEntry,
  type DrugItem,
  type HosxpSettings,
  type RegimenEntry,
  useSettingsStore,
} from '@/stores/settings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function createDbConfig(overrides: Partial<DbConfig> = {}): DbConfig {
  return {
    host: '192.168.1.100',
    port: 3306,
    database: 'hosxp',
    username: 'sa',
    password: 'secret',
    ...overrides,
  };
}

function createDrugClassEntry(overrides: Partial<DrugClassEntry> = {}): DrugClassEntry {
  return {
    class: 'H',
    icodes: ['1430104'],
    name: 'Isoniazid',
    ...overrides,
  };
}

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  /* ---------------------------------------------------------- */
  /*  dbConfig defaults                                          */
  /* ---------------------------------------------------------- */

  describe('dbConfig defaults', () => {
    it('should default to localhost:3306/hosxp', () => {
      const store = useSettingsStore();
      expect(store.dbConfig).toEqual({
        host: 'localhost',
        port: 3306,
        database: 'hosxp',
        username: 'root',
        password: '',
      });
    });
  });

  /* ---------------------------------------------------------- */
  /*  syncDrugCodesFromClasses                                   */
  /* ---------------------------------------------------------- */

  describe('syncDrugCodesFromClasses', () => {
    it('should build drugCode map from drugClasses', () => {
      const store = useSettingsStore();
      store.drugClasses = [
        { class: 'H', icodes: ['1430104'], name: 'Isoniazid' },
        { class: 'R', icodes: ['1000265', '1000264'], name: 'Rifampicin' },
        { class: 'E', icodes: ['1600004', '1000129'], name: 'Ethambutol' },
      ];
      store.syncDrugCodesFromClasses();

      expect(store.drugCodes).toEqual({
        H: ['1430104'],
        R: ['1000265', '1000264'],
        E: ['1600004', '1000129'],
      });
    });

    it('should normalize class letters to uppercase', () => {
      const store = useSettingsStore();
      store.drugClasses = [
        { class: 'h', icodes: ['1430104'], name: 'Isoniazid' },
        { class: 'r', icodes: ['1000265'], name: 'Rifampicin' },
      ];
      store.syncDrugCodesFromClasses();

      expect(store.drugCodes).toEqual({
        H: ['1430104'],
        R: ['1000265'],
      });
    });

    it('should produce empty map when drugClasses is empty', () => {
      const store = useSettingsStore();
      store.drugClasses = [];
      store.syncDrugCodesFromClasses();
      expect(store.drugCodes).toEqual({});
    });
  });

  /* ---------------------------------------------------------- */
  /*  testConnection                                              */
  /* ---------------------------------------------------------- */

  describe('testConnection', () => {
    it('should return true on successful backend response', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await store.testConnection(createDbConfig());
      expect(result).toBe(true);
      expect(store.isConnecting).toBe(false);
    });

    it('should return false on backend reported failure', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(false);

      const result = await store.testConnection(createDbConfig());
      expect(result).toBe(false);
    });

    it('should return false and set connectionError on thrown exception', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Connection refused'));

      const result = await store.testConnection(createDbConfig());
      expect(result).toBe(false);
      expect(store.connectionError).toContain('Connection refused');
      expect(store.isConnecting).toBe(false);
    });

    it('should set isConnecting to true during the call', async () => {
      const store = useSettingsStore();
      const { promise: pending, resolve: resolveInvoke } = Promise.withResolvers<unknown>();
      vi.mocked(invoke).mockReturnValue(pending);

      const resultPromise = store.testConnection(createDbConfig());
      expect(store.isConnecting).toBe(true);

      resolveInvoke(true);
      await resultPromise;
      expect(store.isConnecting).toBe(false);
    });
  });

  /* ---------------------------------------------------------- */
  /*  connect                                                     */
  /* ---------------------------------------------------------- */

  describe('connect', () => {
    it('should save config, set connected, and persist settings', async () => {
      const store = useSettingsStore();
      const config = createDbConfig();
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // connect_mysql
        .mockResolvedValueOnce(undefined); // save_db_config

      await store.connect(config);

      expect(invoke).toHaveBeenCalledWith('connect_mysql', { config });
      expect(store.dbConfig).toEqual(config);
      expect(store.isConnected).toBe(true);
      expect(store.isConnecting).toBe(false);
    });

    it('should set connection error on connect failure', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockRejectedValue(new Error('Auth failed'));

      await store.connect(createDbConfig());

      expect(store.connectionError).toContain('Auth failed');
      expect(store.isConnected).toBe(false);
      expect(store.isConnecting).toBe(false);
    });

    it('should warn when save fails after successful connect', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke)
        .mockResolvedValueOnce(undefined) // connect_mysql ok
        .mockRejectedValueOnce(new Error('fs error')); // save_db_config fails

      await store.connect(createDbConfig());

      expect(store.isConnected).toBe(true);
      expect(store.connectionError).toContain('เชื่อมต่อสำเร็จ');
      expect(store.connectionError).toContain('fs error');
    });
  });

  /* ---------------------------------------------------------- */
  /*  checkConnection                                             */
  /* ---------------------------------------------------------- */

  describe('checkConnection', () => {
    it('should set isConnected from backend status', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(true);

      await store.checkConnection();

      expect(store.isConnected).toBe(true);
      expect(invoke).toHaveBeenCalledWith('get_mysql_status');
    });

    it('should set isConnected to false on error', async () => {
      const store = useSettingsStore();
      store.isConnected = true;
      vi.mocked(invoke).mockRejectedValue(new Error('timeout'));

      await store.checkConnection();

      expect(store.isConnected).toBe(false);
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveAllSettings                                              */
  /* ---------------------------------------------------------- */

  describe('saveAllSettings', () => {
    it('should call save_db_config with app config', async () => {
      const store = useSettingsStore();
      store.dbConfig = createDbConfig();
      store.staffNames = ['คุณหมอใจดี', 'คุณหมอสมหมาย'];
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.saveAllSettings();

      expect(invoke).toHaveBeenCalledWith('save_db_config', {
        config: expect.objectContaining({
          host: '192.168.1.100',
          port: 3306,
          database: 'hosxp',
          staff_names: ['คุณหมอใจดี', 'คุณหมอสมหมาย'],
        }),
      });
    });
  });

  /* ---------------------------------------------------------- */
  /*  loadSavedConfig / deleteSavedConfig                         */
  /* ---------------------------------------------------------- */

  describe('loadSavedConfig', () => {
    it('should populate dbConfig from saved data', async () => {
      const store = useSettingsStore();
      const saved = {
        host: '10.0.0.5',
        port: 3307,
        database: 'myhosxp',
        username: 'admin',
        password: 'pw',
        staff_names: [],
        regimens: [],
      };
      vi.mocked(invoke).mockResolvedValue(saved);

      await store.loadSavedConfig();

      expect(store.dbConfig.host).toBe('10.0.0.5');
      expect(store.dbConfig.port).toBe(3307);
      expect(store.dbConfig.database).toBe('myhosxp');
    });

    it('should not change dbConfig when saved is null', async () => {
      const store = useSettingsStore();
      const original = { ...store.dbConfig };
      vi.mocked(invoke).mockResolvedValue(null);

      await store.loadSavedConfig();

      expect(store.dbConfig).toEqual(original);
    });

    it('should not throw when backend fails', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockRejectedValue(new Error('file not found'));

      await expect(store.loadSavedConfig()).resolves.toBeUndefined();
    });
  });

  describe('deleteSavedConfig', () => {
    it('should reset dbConfig to defaults and call delete backend', async () => {
      const store = useSettingsStore();
      store.dbConfig = createDbConfig();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.deleteSavedConfig();

      expect(invoke).toHaveBeenCalledWith('delete_db_config');
      expect(store.dbConfig).toEqual({
        host: 'localhost',
        port: 3306,
        database: 'hosxp',
        username: 'root',
        password: '',
      });
    });

    it('should reset to defaults even if backend call fails', async () => {
      const store = useSettingsStore();
      store.dbConfig = createDbConfig();
      vi.mocked(invoke).mockRejectedValue(new Error('permission denied'));

      await store.deleteSavedConfig();

      expect(store.dbConfig.host).toBe('localhost');
    });
  });

  /* ---------------------------------------------------------- */
  /*  loadAllSettings                                             */
  /* ---------------------------------------------------------- */

  describe('loadAllSettings', () => {
    it('should load drugClasses, regimens, dosageRules, and config', async () => {
      const store = useSettingsStore();
      const drugClasses: DrugClassEntry[] = [createDrugClassEntry()];
      const regimens: RegimenEntry[] = [{ name: '2HRZE/4HR', phases: [] }];
      const dosageRules: DosageRule[] = [];
      const hosxpConfig: HosxpSettings = { clinic_code: 'CL001' };
      const alertConfig: AlertThresholds = {
        overdue_days: 40,
        lost_followup_days: 90,
        e_overrun_lookback_days: 45,
        phase_transition_lookback_days: 50,
      };
      const savedConfig = {
        host: '10.0.0.1',
        port: 3306,
        database: 'h1',
        username: 'u',
        password: 'p',
        staff_names: ['A'],
        regimens: [],
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce(drugClasses) // load_drug_classes
        .mockResolvedValueOnce(regimens) // get_regimen_definitions
        .mockResolvedValueOnce(dosageRules) // load_dosage_rules
        .mockResolvedValueOnce(hosxpConfig) // load_hosxp_config
        .mockResolvedValueOnce(alertConfig) // load_alert_config
        .mockResolvedValueOnce(savedConfig); // load_db_config

      await store.loadAllSettings();

      expect(store.drugClasses).toEqual(drugClasses);
      expect(store.drugCodes.H).toEqual(['1430104']);
      expect(store.regimenDefinitions).toEqual(regimens);
      expect(store.dosageRules).toEqual(dosageRules);
      expect(store.hosxpSettings).toEqual(hosxpConfig);
      expect(store.alertThresholds).toEqual(alertConfig);
      expect(store.dbConfig.host).toBe('10.0.0.1');
      expect(store.staffNames).toEqual(['A']);
    });

    it('should keep defaults when individual load calls fail', async () => {
      const store = useSettingsStore();
      const defaultThresholds = { ...store.alertThresholds };

      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error('fail')) // drug_classes
        .mockRejectedValueOnce(new Error('fail')) // regimens
        .mockRejectedValueOnce(new Error('fail')) // dosage
        .mockRejectedValueOnce(new Error('fail')) // hosxp
        .mockRejectedValueOnce(new Error('fail')) // alerts
        .mockRejectedValueOnce(new Error('fail')); // config

      await store.loadAllSettings();

      expect(store.drugClasses).toEqual([]);
      expect(store.alertThresholds).toEqual(defaultThresholds);
    });

    it('should not update dbConfig when load_db_config returns null', async () => {
      const store = useSettingsStore();
      store.dbConfig.host = 'unchanged';
      store.dbConfig.port = 9999;

      vi.mocked(invoke)
        .mockResolvedValueOnce([]) // drug_classes
        .mockResolvedValueOnce([]) // regimens
        .mockResolvedValueOnce([]) // dosage
        .mockResolvedValueOnce({}) // hosxp
        .mockResolvedValueOnce({}) // alerts
        .mockResolvedValueOnce(null); // load_db_config returns null

      await store.loadAllSettings();

      expect(store.dbConfig.host).toBe('unchanged');
      expect(store.dbConfig.port).toBe(9999);
    });

    it('should default staffNames to empty when config has no staff_names field', async () => {
      const store = useSettingsStore();
      const configWithoutStaff = {
        host: '10.0.0.1',
        port: 3306,
        database: 'h1',
        username: 'u',
        password: 'p',
        regimens: [],
      };

      vi.mocked(invoke)
        .mockResolvedValueOnce([]) // drug_classes
        .mockResolvedValueOnce([]) // regimens
        .mockResolvedValueOnce([]) // dosage
        .mockResolvedValueOnce({}) // hosxp
        .mockResolvedValueOnce({}) // alerts
        .mockResolvedValueOnce(configWithoutStaff); // load_db_config without staff_names

      await store.loadAllSettings();

      expect(store.staffNames).toEqual([]);
    });
  });

  /* ---------------------------------------------------------- */
  /*  addStaffName                                                */
  /* ---------------------------------------------------------- */

  describe('addStaffName', () => {
    it('should add a new staff name and persist', async () => {
      const store = useSettingsStore();
      store.staffNames = ['คุณหมอใจดี'];
      vi.mocked(invoke).mockResolvedValue(undefined); // save_db_config

      const result = await store.addStaffName('คุณหมอสมหมาย');

      expect(result).toBe(true);
      expect(store.staffNames).toContain('คุณหมอสมหมาย');
      expect(invoke).toHaveBeenCalledWith('save_db_config', expect.any(Object));
    });

    it('should reject empty string', async () => {
      const store = useSettingsStore();
      const result = await store.addStaffName('');
      expect(result).toBe(false);
    });

    it('should reject whitespace-only string', async () => {
      const store = useSettingsStore();
      const result = await store.addStaffName('   ');
      expect(result).toBe(false);
    });

    it('should reject duplicate names case-sensitively', async () => {
      const store = useSettingsStore();
      store.staffNames = ['คุณหมอใจดี'];

      const result = await store.addStaffName('คุณหมอใจดี');
      expect(result).toBe(false);
      expect(store.staffNames).toHaveLength(1);
    });

    it('should trim whitespace from the name', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.addStaffName('  คุณหมอสมหมาย  ');

      expect(store.staffNames).toContain('คุณหมอสมหมาย');
    });

    it('should roll back if save throws', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockRejectedValue(new Error('disk full'));

      await expect(store.addStaffName('คุณหมอใจดี')).rejects.toThrow('disk full');
      expect(store.staffNames).toEqual([]);
    });
  });

  /* ---------------------------------------------------------- */
  /*  removeStaffName                                             */
  /* ---------------------------------------------------------- */

  describe('removeStaffName', () => {
    it('should remove an existing staff name and persist', async () => {
      const store = useSettingsStore();
      store.staffNames = ['A', 'B', 'C'];
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await store.removeStaffName('B');

      expect(result).toBe(true);
      expect(store.staffNames).toEqual(['A', 'C']);
    });

    it('should return false when name is not found', async () => {
      const store = useSettingsStore();
      store.staffNames = ['A', 'B'];

      const result = await store.removeStaffName('C');

      expect(result).toBe(false);
      expect(store.staffNames).toHaveLength(2);
    });

    it('should roll back if save throws', async () => {
      const store = useSettingsStore();
      store.staffNames = ['A', 'B'];
      vi.mocked(invoke).mockRejectedValue(new Error('io error'));

      await expect(store.removeStaffName('A')).rejects.toThrow('io error');
      expect(store.staffNames).toEqual(['A', 'B']);
    });
  });

  /* ---------------------------------------------------------- */
  /*  searchDrugs                                                 */
  /* ---------------------------------------------------------- */

  describe('searchDrugs', () => {
    it('should return drug items matching the query', async () => {
      const store = useSettingsStore();
      const mockDrugs: DrugItem[] = [
        {
          icode: '1430104',
          name: 'Isoniazid (INH) 100 mg',
          shortname: 'INH',
          strength: '100',
          units: 'เม็ด',
        },
      ];
      vi.mocked(invoke).mockResolvedValue(mockDrugs);

      const result = await store.searchDrugs('isoniazid');

      expect(result).toEqual(mockDrugs);
      expect(invoke).toHaveBeenCalledWith('search_hosxp_drugs', { query: 'isoniazid' });
    });
  });

  /* ---------------------------------------------------------- */
  /*  searchClinics                                               */
  /* ---------------------------------------------------------- */

  describe('searchClinics', () => {
    it('should return clinics matching the query', async () => {
      const store = useSettingsStore();
      const clinics = [{ clinic: '001', name: 'คลินิกวัณโรค' }];
      vi.mocked(invoke).mockResolvedValue(clinics);

      const result = await store.searchClinics('วัณ');

      expect(result).toEqual(clinics);
      expect(invoke).toHaveBeenCalledWith('search_hosxp_clinics', { query: 'วัณ' });
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveDrugClasses                                             */
  /* ---------------------------------------------------------- */

  describe('saveDrugClasses', () => {
    it('should sync drugCodes and persist classes', async () => {
      const store = useSettingsStore();
      store.drugClasses = [{ class: 'R', icodes: ['1000265', '1000264'], name: 'Rifampicin' }];
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.saveDrugClasses();

      expect(store.drugCodes.R).toEqual(['1000265', '1000264']);
      expect(invoke).toHaveBeenCalledWith('save_drug_classes', { classes: store.drugClasses });
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveRegimenDefinitions                                      */
  /* ---------------------------------------------------------- */

  describe('saveRegimenDefinitions', () => {
    it('should persist regimen definitions', async () => {
      const store = useSettingsStore();
      const regimens: RegimenEntry[] = [{ name: '2HRZE/4HR', phases: [] }];
      store.regimenDefinitions = regimens;
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.saveRegimenDefinitions();

      expect(invoke).toHaveBeenCalledWith('save_regimen_definitions', { regimens });
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveDosageRules                                             */
  /* ---------------------------------------------------------- */

  describe('saveDosageRules', () => {
    it('should persist dosage rules', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(undefined);
      store.dosageRules = [
        {
          class: 'H',
          icode: '1430104',
          drug_name: 'Isoniazid',
          strength: '100',
          units: 'เม็ด',
          min_mg_per_kg_day: 5,
          max_mg_per_kg_day: 10,
        },
      ];

      await store.saveDosageRules();

      expect(invoke).toHaveBeenCalledWith('save_dosage_rules', { rules: store.dosageRules });
    });
  });

  /* ---------------------------------------------------------- */
  /*  loadConfiguredDosageDrugs                                   */
  /* ---------------------------------------------------------- */

  describe('loadConfiguredDosageDrugs', () => {
    it('should return dosage drug candidates', async () => {
      const store = useSettingsStore();
      const drugs = [
        { class: 'H', icode: '1430104', drug_name: 'INH', strength: '100', units: 'เม็ด' },
      ];
      vi.mocked(invoke).mockResolvedValue(drugs);

      const result = await store.loadConfiguredDosageDrugs();
      expect(result).toEqual(drugs);
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveHosxpSettings                                           */
  /* ---------------------------------------------------------- */

  describe('saveHosxpSettings', () => {
    it('should persist HOSxP settings', async () => {
      const store = useSettingsStore();
      store.hosxpSettings = { clinic_code: 'TB001' };
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.saveHosxpSettings();

      expect(invoke).toHaveBeenCalledWith('save_hosxp_config', {
        config: { clinic_code: 'TB001' },
      });
    });
  });

  /* ---------------------------------------------------------- */
  /*  saveAlertThresholds                                         */
  /* ---------------------------------------------------------- */

  describe('saveAlertThresholds', () => {
    it('should persist alert thresholds', async () => {
      const store = useSettingsStore();
      const thresholds: AlertThresholds = {
        overdue_days: 50,
        lost_followup_days: 100,
        e_overrun_lookback_days: 60,
        phase_transition_lookback_days: 45,
      };
      store.alertThresholds = thresholds;
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.saveAlertThresholds();

      expect(invoke).toHaveBeenCalledWith('save_alert_config', { config: thresholds });
    });
  });

  /* ---------------------------------------------------------- */
  /*  markSetupComplete / isSetupComplete                         */
  /* ---------------------------------------------------------- */

  describe('markSetupComplete', () => {
    it('should call the backend command', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(undefined);

      await store.markSetupComplete();

      expect(invoke).toHaveBeenCalledWith('mark_setup_complete');
    });
  });

  describe('isSetupComplete', () => {
    it('should return true when backend says setup is done', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockResolvedValue(true);

      const result = await store.isSetupComplete();
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const store = useSettingsStore();
      vi.mocked(invoke).mockRejectedValue(new Error('unknown'));

      const result = await store.isSetupComplete();
      expect(result).toBe(false);
    });
  });

  /* ---------------------------------------------------------- */
  /*  default alert thresholds                                    */
  /* ---------------------------------------------------------- */

  describe('default alert thresholds', () => {
    it('should have sensible default values', () => {
      const store = useSettingsStore();
      expect(store.alertThresholds).toEqual({
        overdue_days: 35,
        lost_followup_days: 60,
        e_overrun_lookback_days: 30,
        phase_transition_lookback_days: 35,
      });
    });
  });
});
