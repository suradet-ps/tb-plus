<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { reactive, ref, watch } from 'vue';
import { type DbConfig, type RegimenPhase, useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

// ── Section navigation ───────────────────────────────────────────────
type Section = 'mysql' | 'hosxp' | 'drugcodes' | 'alerts' | 'staff' | 'backup';
const activeSection = ref<Section>('mysql');

const _navItems: { id: Section; label: string; icon: string }[] = [
  { id: 'mysql', label: 'ฐานข้อมูล MySQL', icon: 'Database' },
  { id: 'hosxp', label: 'คลินิกวัณโรค', icon: 'Server' },
  { id: 'drugcodes', label: 'ยาและสูตรยา', icon: 'Pill' },
  { id: 'alerts', label: 'การแจ้งเตือน', icon: 'AlertTriangle' },
  { id: 'staff', label: 'ผู้ใช้งาน', icon: 'Users' },
  { id: 'backup', label: 'สำรองข้อมูล', icon: 'HardDrive' },
];

// ── MySQL connection form ────────────────────────────────────────────
const mysqlForm = reactive<DbConfig>({ ...settingsStore.dbConfig });
const testResult = ref<'idle' | 'testing' | 'success' | 'fail'>('idle');
const testError = ref('');
const isSaving = ref(false);
const savedSuccess = ref(false);
const settingsSaveError = ref<string | null>(null);
const settingsSaveSuccess = ref<string | null>(null);

// Keep the form in sync with the store — handles loadSavedConfig() being called
// after this component mounts (e.g. navigating to /settings after app init).
watch(
  () => settingsStore.dbConfig,
  (cfg) => {
    Object.assign(mysqlForm, cfg);
  },
  { immediate: true },
);

watch(activeSection, () => {
  settingsSaveError.value = null;
  settingsSaveSuccess.value = null;
});

async function _testConnection() {
  testResult.value = 'testing';
  testError.value = '';
  const ok = await settingsStore.testConnection(mysqlForm);
  testResult.value = ok ? 'success' : 'fail';
  if (!ok) testError.value = settingsStore.connectionError ?? 'การเชื่อมต่อล้มเหลว';
}

async function _saveAndConnect() {
  isSaving.value = true;
  savedSuccess.value = false;
  testResult.value = 'idle';
  try {
    await settingsStore.connect({ ...mysqlForm });
    if (settingsStore.isConnected) {
      savedSuccess.value = true;
      setTimeout(() => {
        savedSuccess.value = false;
      }, 3000);
    }
  } finally {
    isSaving.value = false;
  }
}

function showSettingsSaved(message: string) {
  settingsSaveError.value = null;
  settingsSaveSuccess.value = message;
  setTimeout(() => {
    if (settingsSaveSuccess.value === message) {
      settingsSaveSuccess.value = null;
    }
  }, 2500);
}

function showSettingsSaveError(error: unknown) {
  settingsSaveSuccess.value = null;
  settingsSaveError.value = String(error);
}

// ── HOSxP clinic search ────────────────────────────────────────────
const clinicSearchQuery = ref('');
const clinicSearchResults = ref<{ clinic: string; name: string | null }[]>([]);
const isClinicSearching = ref(false);
const clinicSearchError = ref('');

async function _searchClinics() {
  if (!clinicSearchQuery.value.trim()) return;
  isClinicSearching.value = true;
  clinicSearchError.value = '';
  clinicSearchResults.value = [];
  try {
    clinicSearchResults.value = await settingsStore.searchClinics(clinicSearchQuery.value.trim());
    if (clinicSearchResults.value.length === 0) {
      clinicSearchError.value = 'ไม่พบคลินิก';
    }
  } catch (e) {
    clinicSearchError.value = String(e);
  } finally {
    isClinicSearching.value = false;
  }
}

function _selectClinic(code: string) {
  settingsStore.hosxpSettings.clinic_code = code;
}

// ── HOSxP / Alert save ──────────────────────────────────────────────
const hosxpSaved = ref(false);
async function _saveHosxp() {
  await settingsStore.saveHosxpSettings();
  hosxpSaved.value = true;
  setTimeout(() => {
    hosxpSaved.value = false;
  }, 2500);
}

const alertsSaved = ref(false);
async function _saveAlerts() {
  await settingsStore.saveAlertThresholds();
  alertsSaved.value = true;
  setTimeout(() => {
    alertsSaved.value = false;
  }, 2500);
}

// ── Drug class management — search-first flow ────────────────────────
const drugSearchQuery = ref('');
const drugSearchResults = ref<any[]>([]);
const isSearching = ref(false);
const assignLetters = ref<Record<string, string>>({});

const searchErrorMsg = ref('');

async function _searchDrugs() {
  if (!drugSearchQuery.value.trim()) return;
  isSearching.value = true;
  searchErrorMsg.value = '';
  drugSearchResults.value = [];
  try {
    drugSearchResults.value = await settingsStore.searchDrugs(drugSearchQuery.value.trim());
    assignLetters.value = {};
    if (drugSearchResults.value.length === 0) {
      searchErrorMsg.value = 'ไม่พบรายการยา — ตรวจสอบชื่อหรือ icode';
    }
  } catch (e) {
    searchErrorMsg.value = String(e);
  } finally {
    isSearching.value = false;
  }
}

function _assignIcodeToClass(icode: string, drugName: string) {
  const letter = assignLetters.value[icode]?.trim().toUpperCase();
  if (!letter) return;
  let entry = settingsStore.drugClasses.find((c) => c.class === letter);
  if (!entry) {
    // Create new class with this icode
    settingsStore.drugClasses.push({ class: letter, icodes: [icode], name: drugName });
  } else if (!entry.icodes.includes(icode)) {
    entry.icodes.push(icode);
  }
  assignLetters.value[icode] = '';
  settingsStore.syncDrugCodesFromClasses();
  saveDrugClasses();
}

function _removeDrugClass(cls: string) {
  settingsStore.drugClasses = settingsStore.drugClasses.filter((c) => c.class !== cls);
  settingsStore.syncDrugCodesFromClasses();
  saveDrugClasses();
}

function _removeDrugIcode(cls: string, icode: string) {
  const entry = settingsStore.drugClasses.find((c) => c.class === cls);
  if (entry && entry.icodes.length > 1) {
    entry.icodes = entry.icodes.filter((c) => c !== icode);
    settingsStore.syncDrugCodesFromClasses();
    saveDrugClasses();
  }
}

async function saveDrugClasses() {
  try {
    await settingsStore.saveDrugClasses();
    showSettingsSaved('บันทึกกลุ่มยาแล้ว');
  } catch (e) {
    showSettingsSaveError(e);
  }
}

// ── Regimen management (structured) ─────────────────────────────────
const newRegimenName = ref('');
const editingRegimen = ref<{ name: string; phases: RegimenPhase[] } | null>(null);
const editingRegimenIdx = ref(-1);

function _addRegimenEntry() {
  const name = newRegimenName.value.trim().toUpperCase();
  if (!name) return;
  if (settingsStore.regimenDefinitions.find((r) => r.name === name)) return;
  settingsStore.regimenDefinitions.push({ name, phases: [] });
  newRegimenName.value = '';
  saveRegimens();
}

function _removeRegimenEntry(name: string) {
  settingsStore.regimenDefinitions = settingsStore.regimenDefinitions.filter(
    (r) => r.name !== name,
  );
  saveRegimens();
}

function _editRegimenPhases(name: string) {
  const entry = settingsStore.regimenDefinitions.find((r) => r.name === name);
  if (entry) {
    editingRegimenIdx.value = settingsStore.regimenDefinitions.indexOf(entry);
    editingRegimen.value = {
      name: entry.name,
      phases: entry.phases.map((p) => ({ ...p, drug_classes: [...p.drug_classes] })),
    };
  }
}

function _addPhase() {
  if (!editingRegimen.value) return;
  editingRegimen.value.phases.push({ phase: '', months: 2, drug_classes: [] });
}

function _removePhase(idx: number) {
  if (!editingRegimen.value) return;
  editingRegimen.value.phases.splice(idx, 1);
}

function _savePhaseEdit() {
  if (!editingRegimen.value) return;
  if (editingRegimenIdx.value >= 0) {
    settingsStore.regimenDefinitions[editingRegimenIdx.value] = { ...editingRegimen.value };
  }
  editingRegimen.value = null;
  editingRegimenIdx.value = -1;
  saveRegimens();
}

function _togglePhaseDrug(phase: RegimenPhase, cls: string) {
  const idx = phase.drug_classes.indexOf(cls);
  if (idx >= 0) phase.drug_classes.splice(idx, 1);
  else phase.drug_classes.push(cls);
}

async function saveRegimens() {
  try {
    await settingsStore.saveRegimenDefinitions();
    showSettingsSaved('บันทึกสูตรการรักษาแล้ว');
  } catch (e) {
    showSettingsSaveError(e);
  }
}

// ── Staff names ──────────────────────────────────────────────────────
const newStaff = ref('');

async function _addStaff() {
  try {
    const changed = await settingsStore.addStaffName(newStaff.value);
    if (changed) {
      newStaff.value = '';
      showSettingsSaved('บันทึกรายชื่อผู้ใช้งานแล้ว');
    }
  } catch (e) {
    showSettingsSaveError(e);
  }
}

async function _removeStaff(name: string) {
  try {
    const changed = await settingsStore.removeStaffName(name);
    if (changed) {
      showSettingsSaved('ลบรายชื่อผู้ใช้งานแล้ว');
    }
  } catch (e) {
    showSettingsSaveError(e);
  }
}

// ── Backup ───────────────────────────────────────────────────────────
const isBackingUp = ref(false);
const backupError = ref<string | null>(null);
const backupSuccess = ref(false);

async function _downloadBackup() {
  isBackingUp.value = true;
  backupError.value = null;
  backupSuccess.value = false;
  try {
    const targetPath = await saveDialog({
      defaultPath: `tb-plus-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [
        {
          name: 'SQLite Database',
          extensions: ['db', 'sqlite', 'sqlite3'],
        },
      ],
    });
    if (!targetPath) {
      return;
    }

    await invoke('backup_sqlite', { targetPath });
    backupSuccess.value = true;
    setTimeout(() => {
      backupSuccess.value = false;
    }, 4000);
  } catch (e) {
    backupError.value = String(e);
  } finally {
    isBackingUp.value = false;
  }
}
</script>

<template>
  <div class="view-root">

    <!-- ── Page header ── -->
    <div class="view-header">
      <h1>ตั้งค่า</h1>
      <p>การตั้งค่าระบบ การเชื่อมต่อฐานข้อมูล และการจัดการผู้ใช้งาน</p>
    </div>

    <div class="settings-layout">

      <!-- ── Left sidebar nav ── -->
      <nav class="settings-nav" aria-label="เมนูตั้งค่า">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="nav-item"
          :class="{ active: activeSection === item.id }"
          :aria-current="activeSection === item.id ? 'page' : undefined"
          @click="activeSection = item.id"
        >
          <Database      v-if="item.icon === 'Database'"      :size="15" />
          <Server        v-else-if="item.icon === 'Server'"        :size="15" />
          <Pill          v-else-if="item.icon === 'Pill'"          :size="15" />
          <AlertTriangle v-else-if="item.icon === 'AlertTriangle'" :size="15" />
          <Users         v-else-if="item.icon === 'Users'"         :size="15" />
          <HardDrive     v-else-if="item.icon === 'HardDrive'"     :size="15" />
          {{ item.label }}
        </button>
      </nav>

      <!-- ── Right content area ── -->
      <div class="settings-content">

        <!-- ══════════════════════════════════════════════════
             Section 1 — MySQL Connection
        ══════════════════════════════════════════════════ -->
        <template v-if="activeSection === 'mysql'">
          <div class="settings-card">

            <!-- Card header row with connection-status pill -->
            <div class="card-top-row">
              <div>
                <h2 class="card-title">การเชื่อมต่อฐานข้อมูล HOSxP</h2>
                <p class="card-subtitle">
                  กำหนดค่าการเชื่อมต่อ MySQL สำหรับดึงข้อมูลจาก HOSxP (อ่านอย่างเดียว)
                </p>
              </div>
              <span
                class="connection-status"
                :class="settingsStore.isConnected ? 'status-connected' : 'status-disconnected'"
              >
                <Wifi    v-if="settingsStore.isConnected" :size="11" />
                <WifiOff v-else                           :size="11" />
                {{ settingsStore.isConnected ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ' }}
              </span>
            </div>

            <!-- Form grid -->
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="db-host">Host</label>
                <input
                  id="db-host"
                  v-model="mysqlForm.host"
                  class="form-input"
                  placeholder="localhost"
                  autocomplete="off"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="db-port">Port</label>
                <input
                  id="db-port"
                  v-model.number="mysqlForm.port"
                  class="form-input"
                  type="number"
                  min="1"
                  max="65535"
                  placeholder="3306"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="db-name">Database</label>
                <input
                  id="db-name"
                  v-model="mysqlForm.database"
                  class="form-input"
                  placeholder="hosxp"
                  autocomplete="off"
                />
              </div>
              <div class="form-group">
                <label class="form-label" for="db-user">Username</label>
                <input
                  id="db-user"
                  v-model="mysqlForm.username"
                  class="form-input"
                  placeholder="root"
                  autocomplete="username"
                />
              </div>
              <div class="form-group full">
                <label class="form-label" for="db-pass">Password</label>
                <input
                  id="db-pass"
                  v-model="mysqlForm.password"
                  class="form-input"
                  type="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
              </div>
            </div>

            <!-- Action row -->
            <div class="form-actions">
              <button
                class="btn-secondary"
                :disabled="testResult === 'testing' || settingsStore.isConnecting"
                @click="testConnection"
              >
                <Loader2 v-if="testResult === 'testing'" :size="13" class="spin" />
                <Server  v-else                          :size="13" />
                ทดสอบการเชื่อมต่อ
              </button>

              <button
                class="btn-primary"
                :disabled="isSaving"
                @click="saveAndConnect"
              >
                <Loader2 v-if="isSaving" :size="13" class="spin" />
                บันทึกและเชื่อมต่อ
              </button>

              <button
                class="btn-ghost-danger"
                :disabled="isSaving"
                @click="settingsStore.deleteSavedConfig()"
                title="ล้างการตั้งค่าที่บันทึกและคืนค่าเริ่มต้น"
              >
                ลบการตั้งค่าที่บันทึก
              </button>

              <span v-if="savedSuccess" class="test-result test-success">
                <CheckCircle :size="14" />
                บันทึกการตั้งค่าแล้ว
              </span>
              <span v-else-if="testResult === 'success'" class="test-result test-success">
                <CheckCircle :size="14" />
                เชื่อมต่อสำเร็จ
              </span>
              <span v-else-if="testResult === 'fail'" class="test-result test-fail">
                <XCircle :size="14" />
                {{ testError }}
              </span>
            </div>

            <!-- Store-level error shown after failed save+connect -->
            <p v-if="settingsStore.connectionError && testResult === 'idle'" class="error-note">
              ข้อผิดพลาด: {{ settingsStore.connectionError }}
            </p>
          </div>
        </template>

        <!-- ══════════════════════════════════════════════════
             Section 2 — HOSxP clinic code
        ══════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'hosxp'">
          <div class="settings-card">
            <h2 class="card-title">ค้นหาและกำหนดรหัสคลินิกวัณโรค</h2>
            <p class="card-subtitle">ค้นหารหัสคลินิกวัณโรคในฐานข้อมูล HOSxP เพื่อใช้กรองข้อมูลนัดหมาย</p>

            <div class="drug-search-row">
              <input
                v-model="clinicSearchQuery"
                class="form-input"
                placeholder="ค้นหารหัสหรือชื่อคลินิก..."
                @keydown.enter="searchClinics"
              />
              <button class="btn-primary" :disabled="isClinicSearching" @click="searchClinics">
                <Search :size="14" /> ค้นหา
              </button>
            </div>

            <div v-if="clinicSearchResults.length" class="search-results-box">
              <div class="sr-header">
                <span class="sr-h">รหัส</span>
                <span class="sr-h">ชื่อคลินิก</span>
                <span class="sr-h">เลือก</span>
              </div>
              <div
                v-for="item in clinicSearchResults"
                :key="item.clinic"
                class="sr-row"
                :class="{ 'sr-row--assigned': settingsStore.hosxpSettings.clinic_code === item.clinic }"
              >
                <span class="sr-icode">{{ item.clinic }}</span>
                <span class="sr-name">{{ item.name ?? '—' }}</span>
                <div class="sr-assign">
                  <button
                    class="sr-btn"
                    :disabled="settingsStore.hosxpSettings.clinic_code === item.clinic"
                    @click="selectClinic(item.clinic)"
                  >
                    {{ settingsStore.hosxpSettings.clinic_code === item.clinic ? '✓ เลือกแล้ว' : 'เลือก' }}
                  </button>
                </div>
              </div>
            </div>

            <p v-if="clinicSearchError" class="error-note">{{ clinicSearchError }}</p>

            <div v-if="settingsStore.hosxpSettings.clinic_code" class="current-clinic">
              <h4>คลินิกที่เลือก</h4>
              <div class="clinic-badge">
                รหัส: <strong>{{ settingsStore.hosxpSettings.clinic_code }}</strong>
              </div>
            </div>

            <div class="form-actions">
              <button class="btn-primary" @click="saveHosxp">
                <CheckCircle :size="13" /> บันทึก
              </button>
              <span v-if="hosxpSaved" class="test-result test-success">
                <CheckCircle :size="14" /> บันทึกแล้ว
              </span>
            </div>
          </div>
        </template>

        <!-- ══════════════════════════════════════════════════
             Section 3 — Drug Codes
        ══════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'drugcodes'">
          <div class="settings-card">
            <h2 class="card-title">ยาและสูตรยา</h2>
            <p class="card-subtitle">ตั้งค่ารหัสยา TB และสูตรการรักษาที่ใช้ในระบบ</p>

            <!-- Drug Classes sub-section -->
            <div class="sub-section">
              <h3 class="sub-title">ค้นหาและกำหนดกลุ่มยา</h3>
              <p class="sub-desc">ค้นหารหัสยาจากฐานข้อมูล HOSxP แล้วกำหนดตัวย่อสำหรับใช้ในสูตรการรักษา</p>

              <div class="drug-search-row">
                <input
                  v-model="drugSearchQuery"
                  class="form-input"
                  placeholder="ค้นหาชื่อยาหรือ icode จาก HOSxP..."
                  @keydown.enter="searchDrugs"
                />
                <button class="btn-primary" :disabled="isSearching" @click="searchDrugs">
                  <Search :size="14" /> ค้นหา
                </button>
              </div>

              <!-- Search results -->
              <div v-if="drugSearchResults.length" class="search-results-box">
                <div class="sr-header">
                  <span class="sr-h">icode</span>
                  <span class="sr-h">ชื่อยา</span>
                  <span class="sr-h">กำหนดตัวย่อ</span>
                </div>
                <div
                  v-for="item in drugSearchResults"
                  :key="item.icode"
                  class="sr-row"
                  :class="{ 'sr-row--assigned': settingsStore.drugClasses.some(c => c.icodes.includes(item.icode)) }"
                >
                  <span class="sr-icode">{{ item.icode }}</span>
                  <span class="sr-name">{{ item.name }}</span>
                  <div class="sr-assign">
                    <input
                      v-model="assignLetters[item.icode]"
                      class="sr-input"
                      placeholder="ตัวย่อ"
                      maxlength="2"
                      @keydown.enter="assignIcodeToClass(item.icode, item.name)"
                    />
                    <button
                      class="sr-btn"
                      :disabled="!assignLetters[item.icode]?.trim()"
                      @click="assignIcodeToClass(item.icode, item.name)"
                    >
                      กำหนด
                    </button>
                    <span
                      v-if="settingsStore.drugClasses.some(c => c.icodes.includes(item.icode))"
                      class="sr-done"
                    >✓</span>
                  </div>
                </div>
              </div>
              <p v-if="searchErrorMsg" class="error-note">
                {{ searchErrorMsg }}
              </p>

              <!-- Configured classes -->
              <div v-if="settingsStore.drugClasses.length" class="classes-summary">
                <h4 class="sub-title" style="margin-top:16px">กลุ่มยาที่กำหนดแล้ว</h4>
                <div v-for="cls in settingsStore.drugClasses" :key="cls.class" class="class-summary-card">
                  <div class="cs-top">
                    <DrugChip :drug="cls.class" size="md" />
                    <span class="cs-name">{{ cls.name }}</span>
                    <button class="btn-ghost-danger-sm" @click="removeDrugClass(cls.class)" title="ลบกลุ่มยา">
                      <Trash2 :size="12" />
                    </button>
                  </div>
                  <div class="cs-icodes">
                    <span v-for="code in cls.icodes" :key="code" class="cs-icode">
                      {{ code }}
                      <button class="cs-remove" @click="removeDrugIcode(cls.class, code)" :disabled="cls.icodes.length <= 1">×</button>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Regimens sub-section -->
            <div class="sub-section">
              <h3 class="sub-title">สูตรการรักษา (Treatment Regimens)</h3>
              <p class="sub-desc">เพิ่มหรือแก้ไขสูตรยา แต่ละสูตรประกอบด้วยหลายระยะ (phase)</p>

              <div class="add-class-row">
                <input v-model="newRegimenName" class="form-input" placeholder="ชื่อสูตร เช่น 2HRZE/4HR" @keydown.enter="addRegimenEntry" />
                <button class="btn-primary" @click="addRegimenEntry">
                  <Plus :size="14" /> เพิ่มสูตร
                </button>
              </div>

              <div v-if="settingsStore.regimenDefinitions.length" class="regimen-list">
                <div
                  v-for="reg in settingsStore.regimenDefinitions"
                  :key="reg.name"
                  class="regimen-item"
                >
                  <div class="regimen-info">
                    <span class="regimen-name">{{ reg.name }}</span>
                    <div class="regimen-phases">
                      <span v-for="(ph, i) in reg.phases" :key="i" class="phase-tag">
                        {{ ph.phase }} {{ ph.months }}m [{{ ph.drug_classes.join(',') }}]
                      </span>
                    </div>
                  </div>
                  <div class="class-header-actions">
                    <button class="btn-secondary-sm" @click="editRegimenPhases(reg.name)">แก้ไข</button>
                    <button class="staff-delete" @click="removeRegimenEntry(reg.name)" :title="`ลบสูตร ${reg.name}`">
                      <Trash2 :size="14" />
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="empty-hint">
                ยังไม่มีสูตรยา — เพิ่มสูตรยาด้านบน
              </div>

              <span v-if="settingsSaveSuccess" class="test-result test-success">
                <CheckCircle :size="14" />
                {{ settingsSaveSuccess }}
              </span>
              <p v-if="settingsSaveError" class="error-note">
                บันทึกสูตรการรักษาไม่สำเร็จ: {{ settingsSaveError }}
              </p>
            </div>

            <!-- Phase editor modal -->
            <Teleport to="body">
              <div v-if="editingRegimen" class="modal-overlay" @click.self="editingRegimen = null">
                <div class="modal-card">
                  <h3 style="margin-bottom:16px">{{ editingRegimen.name }}</h3>
                  <div v-for="(ph, idx) in editingRegimen.phases" :key="idx" class="phase-row">
                    <input v-model="ph.phase" class="form-input" style="width:130px" placeholder="intensive" />
                    <input v-model.number="ph.months" class="form-input" style="width:60px" type="number" min="1" placeholder="2" />
                    <span class="phase-label">เดือน</span>
                    <div class="drug-toggle-group">
                      <button
                        v-for="cls in settingsStore.drugClasses"
                        :key="cls.class"
                        class="toggle-btn"
                        :class="{ active: ph.drug_classes.includes(cls.class) }"
                        @click="togglePhaseDrug(ph, cls.class)"
                      >
                        {{ cls.class }}
                      </button>
                    </div>
                    <button class="btn-ghost-danger-sm" @click="removePhase(idx)">
                      <Trash2 :size="13" />
                    </button>
                  </div>
                  <div class="phase-actions">
                    <button class="btn-secondary" @click="addPhase"><Plus :size="13" /> เพิ่มระยะ</button>
                    <button class="btn-primary" @click="savePhaseEdit">บันทึก</button>
                  </div>
                </div>
              </div>
            </Teleport>
          </div>
        </template>

        <!-- ══════════════════════════════════════════════════
             Section 4 — Alert Thresholds
        ══════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'alerts'">
          <div class="settings-card">
            <h2 class="card-title">ค่าการแจ้งเตือน</h2>
            <p class="card-subtitle">กำหนดเกณฑ์การแจ้งเตือนสำหรับระบบติดตามผู้ป่วย TB</p>
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">overdue_days</label>
                <input v-model.number="settingsStore.alertThresholds.overdue_days" class="form-input" type="number" min="1" />
                <span class="input-hint">จำนวนวันที่ไม่ได้รับยา → overdue alert</span>
              </div>
              <div class="form-group">
                <label class="form-label">lost_followup_days</label>
                <input v-model.number="settingsStore.alertThresholds.lost_followup_days" class="form-input" type="number" min="1" />
                <span class="input-hint">จำนวนวันที่ขาดติดตาม → lost to follow-up</span>
              </div>
              <div class="form-group">
                <label class="form-label">e_overrun_lookback_days</label>
                <input v-model.number="settingsStore.alertThresholds.e_overrun_lookback_days" class="form-input" type="number" min="1" />
                <span class="input-hint">ย้อนหลังตรวจสอบ Ethambutol overrun</span>
              </div>
              <div class="form-group">
                <label class="form-label">phase_transition_lookback_days</label>
                <input v-model.number="settingsStore.alertThresholds.phase_transition_lookback_days" class="form-input" type="number" min="1" />
                <span class="input-hint">ย้อนหลังตรวจสอบ phase transition</span>
              </div>
            </div>
            <div class="form-actions">
              <button class="btn-primary" @click="saveAlerts">
                <CheckCircle :size="13" /> บันทึก
              </button>
              <span v-if="alertsSaved" class="test-result test-success">
                <CheckCircle :size="14" /> บันทึกแล้ว
              </span>
            </div>
          </div>
        </template>

        <!-- ══════════════════════════════════════════════════
             Section 5 — Staff Names
        ══════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'staff'">
          <div class="settings-card">
            <h2 class="card-title">รายชื่อผู้ใช้งาน</h2>
            <p class="card-subtitle">
              ชื่อเหล่านี้จะปรากฏใน dropdown "ผู้บันทึก" ทั่วทั้งระบบ
              เช่น การลงทะเบียนผู้ป่วย การบันทึกการติดตาม และการจำหน่ายผู้ป่วย
            </p>

            <!-- Staff list -->
            <div v-if="settingsStore.staffNames.length" class="staff-list">
              <div
                v-for="name in settingsStore.staffNames"
                :key="name"
                class="staff-item"
              >
                <div class="staff-item-left">
                  <div class="staff-avatar">{{ name.charAt(0) }}</div>
                  <span class="staff-name">{{ name }}</span>
                </div>
                  <button
                    class="staff-delete"
                    @click="removeStaff(name)"
                    :title="`ลบ ${name}`"
                  >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <!-- Empty state -->
            <p v-else class="staff-empty">
              ยังไม่มีรายชื่อผู้ใช้งาน — กรุณาเพิ่มด้านล่าง
            </p>

            <!-- Add staff row -->
            <div class="staff-add-row">
              <input
                v-model="newStaff"
                class="form-input"
                placeholder="พิมพ์ชื่อผู้ใช้งาน แล้วกด Enter หรือปุ่มเพิ่ม..."
                @keydown.enter="addStaff"
              />
              <button class="btn-primary" @click="addStaff">
                <Plus :size="14" />
                เพิ่ม
              </button>
            </div>

            <span v-if="settingsSaveSuccess" class="test-result test-success">
              <CheckCircle :size="14" />
              {{ settingsSaveSuccess }}
            </span>
            <p v-if="settingsSaveError" class="error-note">
              บันทึกรายชื่อผู้ใช้งานไม่สำเร็จ: {{ settingsSaveError }}
            </p>
          </div>
        </template>

        <!-- ══════════════════════════════════════════════════
             Section 4 — Backup
        ══════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'backup'">
          <div class="settings-card">
            <h2 class="card-title">สำรองข้อมูล SQLite</h2>
            <p class="card-subtitle">
              ดาวน์โหลดและบันทึกไฟล์ฐานข้อมูลสำหรับการสำรองข้อมูล โดยเลือกตำแหน่งปลายทางก่อนทุกครั้ง
            </p>

            <div class="backup-body">
              <!-- Info box -->
              <div class="backup-info-box">
                <div class="backup-icon-wrap">
                  <HardDrive :size="26" />
                </div>
                <div class="backup-info-text">
                  <p class="backup-info-title">ฐานข้อมูลท้องถิ่น (SQLite)</p>
                  <p class="backup-info-desc">
                    ไฟล์ฐานข้อมูลถูกเก็บไว้ที่ App Data Directory ของระบบ
                    ประกอบด้วยข้อมูลผู้ป่วย TB คลินิก ประวัติการติดตามรายเดือน
                    แผนการรักษา และผลลัพธ์การรักษาทั้งหมด
                    (ข้อมูลจาก HOSxP จะไม่รวมอยู่ในไฟล์นี้)
                  </p>
                </div>
              </div>

              <!-- Download button -->
              <button
                class="btn-ghost-download"
                :disabled="isBackingUp"
                @click="downloadBackup"
              >
                <Loader2   v-if="isBackingUp"   :size="14" class="spin" />
                <Download  v-else               :size="14" />
                เลือกตำแหน่งและบันทึกไฟล์ฐานข้อมูล
              </button>

              <!-- Success / error feedback -->
              <span v-if="backupSuccess" class="test-result test-success">
                <CheckCircle :size="14" />
                สำรองข้อมูลสำเร็จ
              </span>
              <p v-if="backupError" class="error-note">
                ไม่สามารถสำรองข้อมูลได้: {{ backupError }}
              </p>
            </div>

            <div class="info-note">
              <strong>คำแนะนำ:</strong>
              ควรสำรองข้อมูลเป็นประจำทุกสัปดาห์หรือทุกเดือน
              เก็บไฟล์ไว้ในที่ปลอดภัย เช่น Google Drive หรือ USB Flash Drive
            </div>
          </div>
        </template>

      </div><!-- /settings-content -->
    </div><!-- /settings-layout -->
  </div><!-- /view-root -->
</template>

<style scoped>
/* ── Page root ──────────────────────────────────────────────────────── */
.view-root {
  padding: 32px 32px 48px;
  max-width: 900px;
}

/* ── Page header ────────────────────────────────────────────────────── */
.view-header {
  margin-bottom: 28px;
}

.view-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.25px;
  color: var(--color-text);
  margin: 0 0 4px;
}

.view-header p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ── Two-column layout ──────────────────────────────────────────────── */
.settings-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* ── Left sidebar nav ───────────────────────────────────────────────── */
.settings-nav {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 24px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  transition: background 0.13s, color 0.13s;
}

.nav-item:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--color-badge-bg);
  color: var(--color-blue);
  font-weight: 600;
}

/* ── Right content area ─────────────────────────────────────────────── */
.settings-content {
  flex: 1;
  min-width: 0;
}

/* ── Settings card ──────────────────────────────────────────────────── */
.settings-card {
  background: var(--color-bg);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  padding: 24px;
}

/* Card top row: title block + status pill side by side */
.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.card-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.15px;
  color: var(--color-text);
  margin: 0 0 5px;
}

/* When card-title is direct child (no card-top-row wrapper) */
.settings-card > .card-title {
  margin-bottom: 5px;
}

.card-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0 0 20px;
  line-height: 1.5;
}

/* ── Connection status pill ─────────────────────────────────────────── */
.connection-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-connected {
  background: rgba(26, 174, 57, 0.1);
  color: var(--color-green);
}

.status-disconnected {
  background: rgba(163, 158, 152, 0.15);
  color: var(--color-text-muted);
}

/* ── Form grid ──────────────────────────────────────────────────────── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group.full {
  grid-column: 1 / -1;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.form-input {
  padding: 7px 10px;
  border: 1px solid #dddddd;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: var(--font);
  color: var(--color-text);
  background: var(--color-bg);
  outline: none;
  width: 100%;
  transition: border-color 0.13s, box-shadow 0.13s;
}

.form-input:focus {
  border-color: var(--color-blue);
  box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.1);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

/* ── Form actions row ───────────────────────────────────────────────── */
.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 18px;
  align-items: center;
  flex-wrap: wrap;
}

/* ── Buttons ────────────────────────────────────────────────────────── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-blue);
  color: #fff;
  border: none;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background 0.13s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-blue-active);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: var(--border);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-bg-alt);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ghost-download {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: var(--color-bg);
  border: var(--border);
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: background 0.13s, border-color 0.13s;
}

.btn-ghost-download:hover:not(:disabled) {
  background: var(--color-bg-alt);
  border-color: rgba(0, 0, 0, 0.18);
}

.btn-ghost-download:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── Test-result inline feedback ────────────────────────────────────── */
/* ── Ghost danger button (delete config) ───────────────────────────── */
.btn-ghost-danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: #b91c1c;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.btn-ghost-danger:hover:not(:disabled) {
  background: rgba(185, 28, 28, 0.07);
  color: #991b1b;
}

.btn-ghost-danger:disabled {
  opacity: 0.4;
  cursor: default;
}

.test-result {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
}

.test-success { color: var(--color-green); }
.test-fail    { color: var(--color-orange); }

/* ── Error note ─────────────────────────────────────────────────────── */
.error-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-orange);
  line-height: 1.5;
}

/* ── Info note ──────────────────────────────────────────────────────── */
.info-note {
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: 11px 14px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-top: 16px;
}

.info-note strong {
  color: var(--color-text);
}

/* ── Staff list ─────────────────────────────────────────────────────── */
/* ── Sub-section layout ──────────────────────────────────────────────── */
.sub-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
}

.sub-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.sub-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px;
}

.sub-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}

/* ── Regimen management ──────────────────────────────────────────────────────── */
.regimen-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.regimen-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
  border: var(--border);
  gap: 8px;
}

.regimen-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  font-family: 'SF Mono', 'Roboto Mono', monospace;
}

.staff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.staff-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-md);
  transition: background 0.1s;
}

.staff-item:hover {
  background: #efede9;
}

.staff-item-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.staff-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-badge-bg);
  color: var(--color-blue);
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.staff-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.staff-delete {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: color 0.13s, background 0.13s;
  flex-shrink: 0;
}

.staff-delete:hover {
  color: var(--color-orange);
  background: rgba(221, 91, 0, 0.08);
}

.staff-empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 16px 0 10px;
  text-align: center;
  border: 1px dashed rgba(0, 0, 0, 0.12);
  border-radius: var(--radius-md);
  margin-bottom: 14px;
}

.staff-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.staff-add-row .form-input {
  flex: 1;
}

/* ── Backup section ─────────────────────────────────────────────────── */
.backup-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 4px;
}

.backup-info-box {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.backup-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.backup-info-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.backup-info-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.backup-info-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* ── Spin animation ─────────────────────────────────────────────────── */
.spin {
  animation: spin 0.85s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Drug search — search-first flow ── */
.drug-search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.drug-search-row .form-input { flex: 1; }

.search-results-box {
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: 12px;
}

.sr-header {
  display: flex;
  gap: 10px;
  padding: 7px 12px;
  background: var(--color-bg-alt);
  border-bottom: var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.sr-h:nth-child(1) { width: 90px; }
.sr-h:nth-child(2) { flex: 1; }
.sr-h:nth-child(3) { width: 180px; }

.sr-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  font-size: 13px;
  transition: background 0.1s;
}
.sr-row:last-child { border-bottom: none; }
.sr-row:hover { background: rgba(0,0,0,0.02); }
.sr-row--assigned { background: rgba(26,174,57,0.04); }

.sr-icode { font-family: monospace; font-weight: 600; width: 90px; color: var(--color-text); }
.sr-name { flex: 1; }
.sr-assign { display: flex; gap: 4px; align-items: center; width: 180px; }

.sr-input {
  width: 50px;
  padding: 3px 6px;
  border: 1px solid rgba(0,0,0,0.15);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: monospace;
  font-weight: 600;
  text-transform: uppercase;
  text-align: center;
  outline: none;
  background: var(--color-bg);
}
.sr-input:focus { border-color: var(--color-blue); box-shadow: 0 0 0 2px rgba(0,117,222,0.1); }

.sr-btn {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--color-blue);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font);
}
.sr-btn:disabled { opacity: 0.4; cursor: default; }

.sr-done { color: var(--color-green); font-weight: 700; font-size: 14px; }

/* ── Configured classes summary ── */
.classes-summary {
  margin-top: 4px;
}

.class-summary-card {
  background: var(--color-bg-alt);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  margin-bottom: 6px;
}

.cs-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cs-name { font-size: 13px; font-weight: 600; flex: 1; }

.cs-icodes {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.cs-icode {
  font-family: monospace;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-bg);
  padding: 2px 7px;
  border-radius: 3px;
  border: var(--border);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cs-remove {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1;
  padding: 0;
}
.cs-remove:hover { color: var(--color-orange); }
.cs-remove:disabled { opacity: 0.3; cursor: default; }

/* ── Input hint ── */
.input-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.empty-hint {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 16px;
  text-align: center;
  border: 1px dashed rgba(0,0,0,0.12);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}
.empty-hint a { color: var(--color-blue); }

.regimen-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.regimen-phases {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.phase-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-badge-bg);
  color: var(--color-blue);
}

/* ── Add class/regimen row ── */
.add-class-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

/* ── Button variants ── */
.btn-secondary-sm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
  border: var(--border);
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: background 0.13s;
}
.btn-secondary-sm:hover { background: var(--color-bg-alt); }

.btn-ghost-danger-sm {
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: 4px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color 0.13s, background 0.13s;
}
.btn-ghost-danger-sm:hover { color: var(--color-orange); background: rgba(221,91,0,0.08); }

/* ── Phase editor modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  background: var(--color-bg);
  border-radius: var(--radius-card);
  padding: 24px;
  min-width: 520px;
  max-width: 640px;
  box-shadow: var(--shadow-deep);
}

.phase-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-md);
}

.phase-label {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.drug-toggle-group {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: var(--border);
  background: var(--color-bg);
  font-size: 12px;
  font-weight: 600;
  font-family: monospace;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.1s;
}
.toggle-btn.active {
  background: var(--color-blue);
  color: #fff;
  border-color: var(--color-blue);
}

.phase-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* ── Clinic search ── */
.current-clinic {
  margin-top: 12px;
}
.current-clinic h4 {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.clinic-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--color-badge-bg);
  color: var(--color-blue);
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
}
.clinic-badge strong {
  font-family: monospace;
  font-size: 16px;
}
</style>
