# TB Plus — Agent Specification

## Project Overview

A Tauri 2.5 (Rust) + Vue 3.5 (TypeScript) desktop application for managing
tuberculosis (TB) clinic operations at Sabot Hospital (โรงพยาบาลสระโบสถ์). The
system bridges HOSxP's MySQL database (read-only) with a local SQLite database
for clinic-specific tracking data not available in HIS.

> **Version**: 1.8.0 — see `Cargo.toml` and `package.json`.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vue 3.5 Frontend                  │
│     (TypeScript + Pinia 4 + Vue Router 5)           │
│              @lucide/vue icon library                │
└────────────────────┬────────────────────────────────┘
                     │ Tauri IPC (invoke)
┌────────────────────▼────────────────────────────────┐
│              Tauri 2.5 Backend (Rust 2024)          │
│                                                     │
│   ┌──────────────────────────────────────────────┐ │
│   │              src-tauri (app crate)            │ │
│   │  main.rs · lib.rs · commands/ (10 modules)   │ │
│   └──────┬───────────┬──────────────┬────────────┘ │
│          │           │              │               │
│   ┌──────▼──────┐ ┌──▼──────────┐ ┌▼────────────┐ │
│   │  tb-models  │ │ tb-database │ │  tb-logic    │ │
│   │ (pure data) │ │(queries +   │ │ (alerts,     │ │
│   │             │ │ settings)   │ │  dosage,     │ │
│   │             │ │             │ │  geocoding)  │ │
│   └─────────────┘ └──────┬──────┘ └──────────────┘ │
│                          │                          │
│            ┌─────────────┼──────────────┐           │
│            ▼                           ▼            │
│   ┌──────────────────┐    ┌──────────────────────┐ │
│   │  MySQL Connector  │    │  SQLite (local DB)   │ │
│   │  (HOSxP read-only)│    │  (clinic tracking)   │ │
│   └──────────────────┘    └──────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Cargo Workspace Crates

| Crate | Path | Purpose |
|-------|------|---------|
| `tb-models` | `crates/tb-models/` | Pure data structs (patients, alerts, dispensing, dosage, mapping, reports, settings, treatment) |
| `tb-database` | `crates/tb-database/` | MySQL + SQLite query layer, encrypted settings manager (AES-256-GCM) |
| `tb-logic` | `crates/tb-logic/` | Pure business logic: alert computation, dosage assessment, address normalization/geocoding |
| `tb-plus` | `src-tauri/` | Tauri app entry, command handlers (depends on all three above) |

### Data Sources

| Source | Type | Purpose |
|--------|------|---------|
| HOSxP MySQL | Read-only | Patient demographics, drug dispensing records, appointments |
| Local SQLite | Read-Write | TB clinic enrollment, treatment plans, follow-up notes, geocoding cache, app settings |

### Dev vs Prod Data Isolation

> **Note**: `tauri.dev.conf.json` does **not** exist anymore — Tauri 2's CLI
> (2.11+) never reads it (verified in `tauri-cli` source: only `tauri.conf.json`,
> platform config, and `--config` flags are merged). Dev/prod isolation is
> instead enforced by the SQLite **database filename**, chosen in
> `sqlite_db_filename()` (`src-tauri/src/lib.rs`) via `cfg!(debug_assertions)`:

| Mode | Build Profile | Database File |
|------|---------------|---------------|
| `tauri dev` | debug | `%APPDATA%\tb-plus\tb_plus_dev.db` |
| Installed (prod) | release | `%APPDATA%\tb-plus\tb_plus.db` |

`backup_sqlite` / `restore_sqlite` and the `sqlite.db_filename` settings seed
all use the same helper, so dev and prod never share a SQLite database or lock
files (`-wal` / `-shm`).

> **Never** change the identifier in `tauri.conf.json` — it would
> orphan existing clinic data on users' machines.

> **Migration discipline**: migration files are checksummed (SHA-384) by sqlx
> and stored in `_sqlx_migrations`. Never edit an applied migration file
> (line-ending changes alone — e.g. CRLF↔LF — invalidate the checksum and panic
> with `VersionMismatch`). Always append a new `000N_*.sql` migration instead.

---

## Database Schema

### HOSxP Tables Used (Read-Only)

#### `opitemrece` — Drug Dispensing Records

```sql
- an          VARCHAR  -- visit number
- hn          VARCHAR  -- hospital number (patient ID)
- vstdate     DATE     -- visit/dispensing date
- icode       VARCHAR  -- drug item code
- qty         DECIMAL  -- quantity dispensed
- unitprice   DECIMAL  -- unit price
```

#### `ovst` — Outpatient Visit Records

```sql
- hn          VARCHAR  -- hospital number
- vstdate     DATE     -- visit date
- vn          VARCHAR  -- visit number
- doctor      VARCHAR  -- doctor code
- diagtext    VARCHAR  -- diagnosis text
```

#### `patient` — Patient Demographics

```sql
- hn          VARCHAR  -- hospital number
- pname       VARCHAR  -- title
- fname       VARCHAR  -- first name
- lname       VARCHAR  -- last name
- birthday    DATE     -- date of birth
- sex         CHAR(1)  -- gender
- addrpart    VARCHAR  -- address
- phone       VARCHAR  -- phone number
```

#### `drugitems` — Drug Master

```sql
- icode       VARCHAR  -- drug code
- name        VARCHAR  -- drug name (full)
- shortname   VARCHAR  -- drug short name
- units       VARCHAR  -- dispensing unit
```

#### `oapp` — Outpatient Appointments

```sql
- hn          VARCHAR  -- hospital number
- vstdate     DATE     -- appointment date
- an          VARCHAR  -- visit number
- doctor      VARCHAR  -- doctor code
```

### TB Drug Codes (Sabot Hospital)

| icode | Drug Name | Thai Name |
|-------|-----------|-----------|
| 1430104 | Isoniazid (INH / H) | ไอโซไนอะซิด |
| 1000265 | Rifampicin (RIF / R) | ไรแฟมพิซิน |
| 1000264 | Rifampicin (RIF / R) | ไรแฟมพิซิน |
| 1600004 | Ethambutol (EMB / E) | อิแทมบูทอล |
| 1000129 | Ethambutol (EMB / E) | อีแทมบูทอล |
| 1000258 | Pyrazinamide (PZA / Z) | ไพราซินาไมด์ |

> Note: Rifampicin and Ethambutol each have two icodes — always query both when filtering.

### Local SQLite Schema

#### `tb_patients` — Enrolled TB Clinic Patients

```sql
CREATE TABLE tb_patients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hn              TEXT NOT NULL UNIQUE,
    enrolled_at     TEXT NOT NULL,          -- ISO date enrolled into TB clinic
    enrolled_by     TEXT,                   -- staff name who enrolled
    status          TEXT NOT NULL DEFAULT 'active',
                                            -- active | completed | transferred | died | defaulted
    tb_type         TEXT,                   -- pulmonary | extra_pulmonary
    diagnosis_date  TEXT,                   -- confirmed diagnosis date
    notes           TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
```

#### `tb_treatment_plans` — Treatment Regimen per Patient

```sql
CREATE TABLE tb_treatment_plans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hn              TEXT NOT NULL,
    regimen         TEXT NOT NULL,          -- e.g. "2HRZE/4HR", "2HRZE/6HR"
    phase           TEXT NOT NULL,          -- intensive | continuation
    phase_start     TEXT NOT NULL,          -- ISO date
    phase_end_expected TEXT,               -- calculated expected end date
    drugs           TEXT NOT NULL,          -- JSON array of drug codes in this phase
    duration_months INTEGER NOT NULL,
    is_current      INTEGER NOT NULL DEFAULT 1,  -- boolean
    notes           TEXT,
    created_at      TEXT NOT NULL
);
```

#### `tb_followups` — Monthly Follow-up Records

```sql
CREATE TABLE tb_followups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hn              TEXT NOT NULL,
    followup_date   TEXT NOT NULL,
    month_number    INTEGER,                -- treatment month (1, 2, 3...)
    weight_kg       REAL,
    sputum_result   TEXT,                   -- negative | positive | not_done
    xray_result     TEXT,                   -- improved | stable | worse | not_done
    side_effects    TEXT,                   -- JSON array of reported side effects
    adherence       TEXT,                   -- good | fair | poor
    dispensed_drugs TEXT,                   -- JSON snapshot of drugs dispensed this visit
    notes           TEXT,
    created_by      TEXT,
    created_at      TEXT NOT NULL
);
```

#### `tb_outcomes` — Treatment Outcome on Discharge

```sql
CREATE TABLE tb_outcomes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hn              TEXT NOT NULL UNIQUE,
    outcome         TEXT NOT NULL,
                    -- cured | treatment_completed | treatment_failed |
                    -- died | lost_to_followup | not_evaluated | transferred_out
    outcome_date    TEXT NOT NULL,
    treatment_end   TEXT,
    notes           TEXT,
    created_by      TEXT,
    created_at      TEXT NOT NULL
);
```

#### `tb_patient_locations` — Geocoded Patient Addresses

```sql
CREATE TABLE tb_patient_locations (
    hn                  TEXT PRIMARY KEY,
    raw_address         TEXT NOT NULL,
    normalized_address  TEXT,
    lat                 REAL,
    lng                 REAL,
    jittered_lat        REAL,
    jittered_lng        REAL,
    geocode_status      TEXT NOT NULL DEFAULT 'pending',
    geocode_error       TEXT,
    geocode_attempts    INTEGER NOT NULL DEFAULT 0,
    geocoded_at         TEXT,
    updated_at          TEXT NOT NULL
);
```

#### `app_settings` — Key-Value Settings Store

```sql
-- Stores all app configuration: DB credentials (encrypted), drug classes,
-- regimen definitions, dosage rules, alert thresholds, HOSxP config, etc.
-- Managed by SettingsManager in tb-database crate.
```

---

## Application Modules

### Module 1: Screening — HN Drug Search (`/screening`)

**Purpose:** Query all HOSxP patients who have ever received TB drugs. Entry point for enrolling new patients.

**Behavior:**

- Queries `opitemrece` joined with `patient` and `drugitems` for all 6 TB drug icodes
- Groups results by `hn`: HN, patient name, age, sex, first/last dispensing date, visit count, drug names
- Drug class chips (H, R, E, Z) per patient
- Filters: date range, drug class multi-select, enrollment status (all / not enrolled / enrolled)
- Checkbox selection → **"นำเข้าคลินิก"** opens enrollment modal
- Already-enrolled patients marked with green badge, cannot re-enroll
- Sorting by last dispensing date descending

### Module 2: Active Patients Dashboard (`/active`)

**Purpose:** Overview of currently active TB clinic patients with treatment progress.

**Layout:** Sortable patient list with:

- HN, name, age, TB type badge
- Current treatment phase badge (Intensive / Continuation)
- Regimen string (e.g. 2HRZE/4HR)
- Treatment month progress bar — **critical feature**
- Days since last dispensing
- Alert indicators: overdue (red), phase transition due (yellow), ethambutol overrun (red), treatment overrun (red)
- Quick actions: View Details, Add Follow-up, Discharge

### Module 3: Patient Detail (`/patient/:hn`)

**Purpose:** Full clinical timeline for one enrolled TB patient.

**Sections:**

- **Patient Header**: Name, HN, age, sex, address, phone, TB type, enrollment info, status badge
- **Treatment Timeline**: Horizontal visual timeline with intensive/continuation bars, today marker, follow-up dots
- **Drug Dispensing History**: Table from HOSxP `opitemrece`, color-coded by drug class, highlights out-of-period dispensing
- **Follow-up Records**: Chronological list from SQLite, each entry: date, month, weight, sputum, X-ray, adherence, side effects, notes
- **Side Effect Tracker**: Checklist per drug class (H: neuropathy/hepatotoxicity, R: hepatotoxicity/flu-like, E: optic neuritis, Z: hyperuricemia)
- **Discharge / Outcome Recording**: **"จำหน่ายผู้ป่วย"** button → outcome form → creates `tb_outcomes` record, updates `tb_patients.status`

### Module 4: Discharged Patients (`/discharged`)

**Purpose:** View patients who have been discharged (completed, failed, died, transferred, defaulted).

- Lists all patients with `tb_patients.status != 'active'`
- Shows outcome label and color from `tb_outcomes`
- Filterable by outcome type

### Module 5: Appointments (`/appointments`)

**Purpose:** View upcoming HOSxP appointments for TB patients.

- Queries HOSxP `oapp` table for enrolled patients
- Day-range filter (today, next 7 days, next 30 days)
- Shows patient name, appointment date, doctor

### Module 6: Dosage Assessment (`/dosage-assessment`)

**Purpose:** Weight-based dosage calculator for TB drugs per regimen phase.

- Input: patient HN → fetch weight from last follow-up
- Calculates mg/kg dose per drug class (H, R, Z, E)
- Shows suggested unit strength and quantity
- Highlights when dose exceeds configured max
- Uses `dosage_rules` from settings (configurable per drug)

### Module 7: Patient Mapping (`/mapping`)

**Purpose:** Geographical visualization of enrolled patient locations for epidemiological insight.

- Leaflet map with patient markers
- Batch geocoding via Nominatim (with rate limiting)
- Coordinate jittering for privacy
- Filter by treatment phase, alert status
- Patient location data stored in `tb_patient_locations`

### Module 8: Reports (`/reports`)

**Purpose:** Summary statistics and exportable reports for HA accreditation.

**Report types:**

| Report | Description |
|--------|-------------|
| Patient Census | Count of active / completed / defaulted by period |
| Treatment Success Rate | Cured + Completed / all enrolled (%) |
| Drug Consumption | Total TB drugs dispensed per month by type |
| Ethambutol Overrun Log | Patients who received E beyond planned duration |
| Lost to Follow-up | Patients with no dispensing record > 60 days |
| Monthly Cohort | Cohort analysis by enrollment month |

**Export:** CSV export for all reports.

### Module 9: Settings (`/settings`)

**Purpose:** Configure database connections, drug codes, regimens, and application preferences.

**Sections:**

- **MySQL Connection**: host, port, database, username, password (AES-256-GCM encrypted), test connection
- **HOSxP Config**: HOSxP-specific settings (drug code search, clinic search)
- **TB Drug Codes**: view/edit drug class ↔ icode mappings
- **Regimen Definitions**: configure regimens (e.g. 2HRZE/4HR) with phase durations and drug lists
- **Dosage Rules**: weight-based dosage rules per drug class
- **Alert Config**: configurable thresholds (overdue days, lost-to-followup days)
- **Staff Names**: manage list for "created by" dropdowns
- **Backup**: export/import SQLite database file

### Module 10: About (`/about`)

**Purpose:** Application information, feature list, security explanation, system info.

---

## Tauri Commands (Rust Backend)

41 commands across 10 modules, all registered in `src-tauri/src/lib.rs`.

### Screening (2)

| Command | Purpose |
|---------|---------|
| `search_tb_patients` | Search HOSxP for patients with TB drug dispensing history |
| `get_dispensing_history` | Get all TB drug dispensing records for one HN |

### Patients (5)

| Command | Purpose |
|---------|---------|
| `enroll_patient` | Enroll a patient into the TB clinic (SQLite) |
| `get_active_patients` | Get all active TB clinic patients |
| `get_patient_detail` | Full patient detail (SQLite + HOSxP demographics) |
| `discharge_patient` | Record treatment outcome, change status |
| `get_discharged_patients` | Get all discharged patients |

### Follow-ups (2)

| Command | Purpose |
|---------|---------|
| `add_followup` | Add a monthly follow-up record |
| `update_treatment_phase` | Transition treatment plan to next phase |

### Dosage (2)

| Command | Purpose |
|---------|---------|
| `get_configured_dosage_drugs` | Get drug list with dosage rules from settings |
| `assess_patient_dosage` | Calculate weight-based dosage assessment |

### Mapping (4)

| Command | Purpose |
|---------|---------|
| `get_mapping_patients` | Get patients with location data for map display |
| `get_mapping_summary` | Aggregate mapping statistics |
| `geocode_patient_address` | Geocode a single patient address via Nominatim |
| `batch_geocode_patients` | Batch geocode multiple patients with rate limiting |

### Alerts (1)

| Command | Purpose |
|---------|---------|
| `get_patient_alerts` | Compute alerts for all active patients |

### Settings (22)

| Command | Purpose |
|---------|---------|
| `test_mysql_connection` | Test MySQL connectivity with given config |
| `connect_mysql` | Establish MySQL connection pool |
| `get_mysql_status` | Check current MySQL connection status |
| `save_db_config` | Save MySQL config (encrypted) |
| `load_db_config` | Load saved MySQL config |
| `delete_db_config` | Delete saved MySQL config |
| `save_hosxp_config` | Save HOSxP-specific settings |
| `load_hosxp_config` | Load HOSxP-specific settings |
| `save_drug_classes` | Save drug class ↔ icode mappings |
| `load_drug_classes` | Load drug class mappings |
| `save_regimen_definitions` | Save regimen definitions |
| `get_regimen_definitions` | Get regimen definitions |
| `save_dosage_rules` | Save dosage rules per drug |
| `load_dosage_rules` | Load dosage rules |
| `save_alert_config` | Save alert thresholds |
| `load_alert_config` | Load alert thresholds |
| `search_hosxp_drugs` | Search HOSxP drugitems |
| `search_hosxp_clinics` | Search HOSxP clinic list |
| `backup_sqlite` | Export SQLite database |
| `restore_sqlite` | Import SQLite database (with validation) |
| `mark_setup_complete` | Mark setup wizard as completed |
| `is_setup_complete` | Check if setup wizard is done |

### Appointments (1)

| Command | Purpose |
|---------|---------|
| `get_appointments` | Get upcoming HOSxP appointments for enrolled patients |

### Reports (1)

| Command | Purpose |
|---------|---------|
| `get_drug_consumption` | Get drug consumption data by month for reports |

---

## Vue Router Structure

| Route | View | Thai Title |
|-------|------|------------|
| `/` | redirect → `/screening` | — |
| `/screening` | ScreeningView | คัดกรองผู้ป่วย |
| `/active` | ActiveView | ผู้ป่วยในการรักษา |
| `/discharged` | DischargedView | ผู้ป่วยจำหน่ายแล้ว |
| `/appointments` | AppointmentsView | การนัดหมาย |
| `/dosage-assessment` | DosageAssessmentView | การประเมินขนาดยา |
| `/patient/:hn` | PatientDetailView | รายละเอียดผู้ป่วย |
| `/mapping` | MappingView | แผนที่การกระจายโรค |
| `/reports` | ReportsView | รายงาน |
| `/settings` | SettingsView | ตั้งค่า |
| `/about` | AboutView | เกี่ยวกับโปรแกรม |

---

## Pinia Stores

| Store | File | Responsibility |
|-------|------|----------------|
| `usePatientStore` | `stores/patient.ts` | Active/discharged patients, enrollment, detail, followup, discharge |
| `useScreeningStore` | `stores/screening.ts` | HOSxP search results, filters, selection |
| `useSettingsStore` | `stores/settings.ts` | DB config, drug classes, regimens, dosage rules, alerts, HOSxP config |
| `useAlertStore` | `stores/alerts.ts` | Alert list, auto-refresh (30min interval), computed counts |
| `useAppointmentsStore` | `stores/appointments.ts` | Appointment fetching, today/upcoming computed |
| `useMappingStore` | `stores/mapping.ts` | Patient mapping data, geocoding, batch operations |

---

## TypeScript Types

| File | Key Types |
|------|-----------|
| `types/patient.ts` | `TbPatient`, `PatientDemographics`, `PatientDrugRecord`, `EnrollmentInput`, `PatientDetail`, `ActivePatientRow`, `SearchFilters` |
| `types/treatment.ts` | `TreatmentPlan`, `TreatmentPlanUpdate`, `Followup`, `FollowupInput`, `Outcome`, `OutcomeInput` |
| `types/alert.ts` | `PatientAlert` (5 alert types: overdue, ethambutol_overrun, phase_transition, treatment_complete, lost_to_followup) |
| `types/dispensing.ts` | `DispensingRecord` |
| `types/dosage.ts` | `DosagePatientSummary`, `DosageAssessmentItem`, `DosageAssessmentPhase`, `DosageAssessmentResult` |
| `types/mapping.ts` | `MappingPatientRow`, `MappingSummary`, `BatchGeocodeResult` |
| `types/reports.ts` | `DrugConsumptionRow` |

---

## Alert Engine

Runs on app startup and every 30 minutes (configurable). For each active patient:

1. **Overdue dispensing**: No TB drug dispensed in HOSxP in the last N days (default 35, configurable)
2. **Ethambutol overrun**: Patient still receiving E (icode 1600004 or 1000129) but intensive phase end date has passed
3. **Phase transition due**: Current date >= `phase_end_expected` of intensive phase but plan not yet updated
4. **Treatment complete**: Current date >= expected total treatment end date
5. **Lost to follow-up**: No dispensing in HOSxP for > N days (default 60, configurable)

Alerts are computed in Rust (`tb-logic::alerts`), stored in Pinia `useAlertStore`, and shown as:

- Red badges on the sidebar nav icon
- Inline row highlights on `/active` dashboard
- Top-of-page notification bar on `/patient/:hn`

---

## Design System

> **`docs/DESIGN.md` is the single source of truth for all visual design decisions.**
> Read `docs/DESIGN.md` in full before writing any UI code.

Key pointers:

- **Colors** — warm neutral palette; Notion Blue (`#0075de`) is the sole saturated accent
- **CSS tokens** — 3-tier hierarchy in `variables.css` (primitive → semantic → component); all ~46 inline hex colors eliminated, CI-enforced
- **Typography** — full type hierarchy (Display → Body → Badge) with negative letter-spacing at larger sizes
- **Spacing** — 8px base unit; sidebar + main content layout
- **Borders & Shadows** — whisper border (`1px solid rgba(0,0,0,0.1)`); multi-layer shadow stacks
- **Border Radius** — 4px buttons/inputs, 12px cards, 9999px pill badges
- **Components** — buttons (primary blue, secondary, ghost), cards, inputs, pill badges, navigation
- **Alert semantics** — Orange (`#dd5b00`) for overrun/overdue, Teal (`#2a9d99`) for success
- **Drug class chips** — one semantic accent per class (H, R, Z, E) across chips, timelines, and table highlights
- **Icons** — `@lucide/vue` exclusively
- **Accessibility** — focus rings, contrast ratios, interactive states

---

## Testing

### Rust Tests

- 46+ unit tests across crates: alert logic (11), date arithmetic (7), duration parsing (6), icode mapping (13), crypto (5), dosage (3), settings (3)
- Clippy with strict lints: `unwrap_used = "deny"`, `expect_used = "deny"`, `panic = "deny"`, `todo = "deny"`

### Frontend Tests

- 6 store test files (~1,500 lines) in `src/stores/__tests__/`
- Test factories in `src/__tests__/factories/`
- Tauri invoke mocks in `src/__tests__/mocks/`
- **No component tests yet** — views and components are untested (see ROADMAP Phase 2)

### CI (5 merge-gate jobs)

1. `No Inline Hex Colors` — grep gate on `.vue` and `.css` files
2. `Cargo Audit` — supply-chain advisory check
3. `Frontend Lint & Format` — `biome ci .`
4. `Frontend Tests` — `vitest run`
5. `Cargo Deny` — advisories + licenses + bans

Plus `rust-safety` (clippy + miri on pure crates) and `test-build` (full Tauri build).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.5 |
| Backend language | Rust 2024 edition (rust-version 1.94.1) |
| MySQL driver | `sqlx` 0.9 with MySQL feature |
| SQLite driver | `sqlx` 0.9 with SQLite feature |
| Encryption | `encryptman` 0.2.0 + `encryptman-keyring` 0.1 (AES-256-GCM) |
| HTTP client | `reqwest` 0.13 (for geocoding) |
| Frontend framework | Vue 3.5 (Composition API, `<script setup>`) |
| Language | TypeScript 6.0.3 (vue-tsc) + TypeScript 7.0.2 Go compiler (`@typescript/native`) |
| State management | Pinia 4 |
| Routing | Vue Router 5 |
| Icons | @lucide/vue |
| Maps | Leaflet 1.9 |
| Build tool | Vite 8 |
| Package manager | bun |
| Formatter/Linter | Biome 2.5 |
| Test runner | Vitest 4 |
| Styling | **See `docs/DESIGN.md`** |

> **Package manager**: Always use `bun` (not npm, not pnpm). Lock file is `bun.lockb`.

---

## Key Dependencies

### Rust (`Cargo.toml`)

```toml
# src-tauri (app crate)
tauri = "2"
tauri-plugin-dialog = "2.7.0"
tauri-plugin-opener = "2.5.3"
sqlx = { version = "0.9", features = ["mysql", "sqlite", "runtime-tokio", "chrono"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.13", features = ["json", "rustls"] }
anyhow = "1"
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# crates/tb-database
encryptman = "0.2.0"
encryptman-keyring = "0.1"
```

### Workspace Lints

```toml
[workspace.lints.clippy]
pedantic = { level = "warn", priority = -1 }
nursery = { level = "warn", priority = -1 }
unwrap_used = "deny"
expect_used = "deny"
panic = "deny"
todo = "deny"
unimplemented = "deny"
dbg_macro = "deny"
```

---

## Project File Structure

```
tb-plus/
├── Cargo.toml                    # Workspace root (4 members)
├── crates/
│   ├── tb-models/src/
│   │   ├── lib.rs
│   │   ├── alert.rs              # PatientAlert
│   │   ├── dispensing.rs         # DispensingRecord
│   │   ├── dosage.rs             # DosageAssessment*, DosageDrugCandidate
│   │   ├── mapping.rs            # MappingPatientRow, BatchGeocodeResult
│   │   ├── patient.rs            # TbPatient, PatientDrugRecord, EnrollmentInput, PatientDetail, SearchFilters
│   │   ├── reports.rs            # DrugConsumptionRow
│   │   ├── settings.rs           # DbConfig, DrugClassEntry, RegimenEntry, DosageRule, AlertConfig
│   │   └── treatment.rs          # TreatmentPlan, Followup, Outcome, OutcomeInput
│   ├── tb-database/src/
│   │   ├── lib.rs                # Re-exports SettingsManager
│   │   ├── mysql.rs              # HOSxP queries (search, dispensing, demographics, appointments)
│   │   ├── sqlite.rs             # Local DB queries (enrollment, followups, treatment, geocoding)
│   │   └── settings/
│   │       ├── mod.rs            # SettingsManager (encrypted key-value store)
│   │       └── crypto.rs         # Master key generation
│   └── tb-logic/src/
│       ├── lib.rs
│       ├── alerts.rs             # compute_alerts_for_patient()
│       ├── dosage.rs             # build_assessment_result(), parse_regimen_durations()
│       └── address.rs            # Thai address normalization, geocoding
├── src-tauri/
│   ├── src/
│   │   ├── main.rs               # Entry point → tb_plus_lib::run()
│   │   ├── lib.rs                # Tauri builder, SQLite init, MySQL auto-connect, 41 commands
│   │   └── commands/
│   │       ├── mod.rs
│   │       ├── screening.rs      # search_tb_patients, get_dispensing_history
│   │       ├── patients.rs       # enroll, get_active, get_detail, discharge, get_discharged
│   │       ├── followups.rs      # add_followup, update_treatment_phase
│   │       ├── dosage.rs         # get_configured_dosage_drugs, assess_patient_dosage
│   │       ├── mapping.rs        # get_mapping_patients, geocode, batch_geocode
│   │       ├── alerts.rs         # get_patient_alerts
│   │       ├── settings.rs       # 22 settings commands
│   │       ├── appointments.rs   # get_appointments
│   │       └── reports.rs        # get_drug_consumption
│   ├── migrations/
│   │   ├── 0001_initial.sql      # tb_patients, tb_treatment_plans, tb_followups, tb_outcomes
│   │   ├── 0002_fix_drug_classes.sql
│   │   ├── 0003_settings_appointments.sql  # app_settings table
│   │   └── 0004_mapping_locations.sql      # tb_patient_locations
│   ├── Cargo.toml
│   ├── tauri.conf.json          # prod identifier: "tb-plus"
│   └── tauri.dev.conf.json      # dev identifier: "tb-plus-dev" (overrides on `tauri dev`)
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/index.ts           # 10 routes + redirect
│   ├── stores/
│   │   ├── patient.ts
│   │   ├── screening.ts
│   │   ├── settings.ts
│   │   ├── alerts.ts
│   │   ├── appointments.ts
│   │   ├── mapping.ts
│   │   └── __tests__/            # 6 store test files
│   ├── views/
│   │   ├── ScreeningView.vue
│   │   ├── ActiveView.vue
│   │   ├── DischargedView.vue
│   │   ├── AppointmentsView.vue
│   │   ├── DosageAssessmentView.vue
│   │   ├── PatientDetailView.vue
│   │   ├── MappingView.vue
│   │   ├── ReportsView.vue
│   │   ├── SettingsView.vue
│   │   └── AboutView.vue
│   ├── components/
│   │   ├── layout/               # AppSidebar, AppHeader
│   │   ├── screening/            # PatientTable, EnrollModal
│   │   ├── active/               # PatientCard, AlertBadge, ProgressBar
│   │   ├── patient/              # TreatmentTimeline, DispensingTable, FollowupList,
│   │   │                         # FollowupForm, SideEffectTracker, DischargeModal
│   │   ├── mapping/              # MapCanvas, MapFilters
│   │   └── shared/               # StatusBadge, DrugChip, ConfirmDialog, TbClinicLogo
│   ├── types/
│   │   ├── patient.ts, treatment.ts, alert.ts, dispensing.ts,
│   │   ├── dosage.ts, mapping.ts, reports.ts
│   ├── __tests__/
│   │   ├── factories/            # Test data factories
│   │   └── mocks/tauri.ts        # Tauri invoke mock
│   ├── styles/
│   │   ├── variables.css         # Design tokens (501 lines, CI-enforced)
│   │   └── base.css              # Global styles (639 lines)
│   └── vite-env.d.ts
├── docs/
│   ├── DESIGN.md                 # Design system (single source of truth)
│   ├── ROADMAP.md                # Phased development plan
│   └── AGENTS-RUST.md            # Rust-specific agent notes
├── .github/workflows/
│   ├── rust-safety.yml           # clippy + miri
│   ├── test-build.yml            # vitest + biome + cargo build
│   └── release.yml               # Cross-platform publish
└── biome.json, vitest.config.ts, tsconfig.json, etc.
```

---

## Key Business Rules

1. **Dual Rifampicin codes**: Always query BOTH `1000265` and `1000264` together and display as one drug class (R).
2. **Dual Ethambutol codes**: Always query BOTH `1600004` and `1000129` together and display as one drug class (E).
3. **Standard regimen durations**:
   - `2HRZE/4HR`: 2 months intensive (H+R+Z+E), 4 months continuation (H+R) — total 6 months
   - `2HRZE/6HR`: 2 months intensive (H+R+Z+E), 6 months continuation (H+R) — total 8 months
4. **Ethambutol safety rule**: E should NOT be dispensed after the intensive phase ends. Any dispensing of E beyond month 2 (for standard regimens) triggers a red alert.
5. **HOSxP is read-only**: Never write to HOSxP MySQL. All clinic tracking data lives in SQLite only.
6. **Buddhist Era dates**: HOSxP `vstdate` stores Gregorian dates (CE) internally; display in Thai (BE) format as `วัน/เดือน/พ.ศ.` in the UI.
7. **Enrollment is additive**: Enrolling a patient does not modify HOSxP. It only creates a record in the local `tb_patients` SQLite table.
8. **Discharge removes from active list**: Setting outcome changes `tb_patients.status` from `active` to the appropriate terminal state, removing the patient from the `/active` dashboard.
9. **Encrypted credentials**: MySQL passwords are stored AES-256-GCM encrypted via `encryptman`. The master key is derived per-app-installation and never logged.
10. **Configurable alerts**: Overdue and lost-to-followup thresholds are user-configurable in Settings, not hardcoded.
