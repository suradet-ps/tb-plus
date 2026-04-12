# Sabot TB Clinic Management System — Agent Specification

## Project Overview

A Tauri 2.5 (Rust) + Vue 3.5 (TypeScript) + lucide-vue desktop application for managing tuberculosis (TB) clinic operations at Sarabosot Hospital. The system bridges HOSxP's MySQL database (read-only) with a local SQLite database for clinic-specific tracking data not available in HIS.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Vue 3.5 Frontend                  │
│         (TypeScript + Pinia + Vue Router)           │
│              lucide-vue icon library                │
└────────────────────┬────────────────────────────────┘
                     │ Tauri IPC (invoke)
┌────────────────────▼────────────────────────────────┐
│                 Tauri 2.5 Backend (Rust)            │
│   ┌──────────────────┐  ┌──────────────────────┐   │
│   │  MySQL Connector  │  │  SQLite (local DB)   │   │
│   │  (HOSxP read-only)│  │  (clinic tracking)   │   │
│   └──────────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Data Sources

| Source | Type | Purpose |
|--------|------|---------|
| HOSxP MySQL | Read-only | Patient demographics, drug dispensing records |
| Local SQLite | Read-Write | TB clinic enrollment, treatment plans, follow-up notes |

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

### TB Drug Codes (Sarabosot Hospital)

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

---

## Application Modules

### Module 1: Screening — HN Drug Search (`/screening`)

**Purpose:** Query all HOSxP patients who have ever received TB drugs. This is the entry point for identifying and enrolling new patients into the TB clinic.

**Behavior:**

- Queries `opitemrece` joined with `patient` and `drugitems` for all 6 TB drug icodes
- Groups results by `hn` showing: HN, patient name, age, sex, first dispensing date, last dispensing date, total dispensing visits, drug names received
- Displays a badge/chip per drug class the patient has received (H, R, E, Z)
- Filters: date range (vstdate), drug filter (multi-select by drug class), enrollment status (all / not enrolled / enrolled)
- Each row has a checkbox; selecting rows and clicking **"นำเข้าคลินิก"** opens an enrollment modal
- Already-enrolled patients are visually marked with a green badge and cannot be re-enrolled
- Sorting by last dispensing date descending by default

**Key Queries:**

```sql
-- Base screening query
SELECT
    p.hn,
    CONCAT(p.pname, p.fname, ' ', p.lname) AS full_name,
    TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age,
    p.sex,
    MIN(o.vstdate) AS first_dispensed,
    MAX(o.vstdate) AS last_dispensed,
    COUNT(DISTINCT o.vstdate) AS visit_count,
    GROUP_CONCAT(DISTINCT d.name ORDER BY d.name SEPARATOR ', ') AS drug_names
FROM opitemrece o
JOIN patient p ON o.hn = p.hn
JOIN drugitems d ON o.icode = d.icode
WHERE o.icode IN (
    '1430104','1000265','1000264',
    '1600004','1000129','1000258'
)
GROUP BY p.hn
ORDER BY last_dispensed DESC;
```

**Enrollment Modal fields:**

- TB type (pulmonary / extra-pulmonary)
- Diagnosis confirmation date
- Initial regimen selection (dropdown: 2HRZE/4HR, 2HRZE/6HR, custom)
- Treatment start date
- Enrolled by (staff name, free text)
- Notes

---

### Module 2: Active Patients Dashboard (`/active`)

**Purpose:** Overview of currently active TB clinic patients with treatment progress tracking.

**Layout:** Card grid or sortable table showing each enrolled patient with:

- HN, name, age
- TB type badge
- Current treatment phase (Intensive / Continuation) with colored badge
- Regimen string (e.g. 2HRZE/4HR)
- Treatment month progress bar (e.g. Month 3 of 6) — **critical feature**
- Days since last dispensing (pulled from HOSxP opitemrece)
- Alert indicators:
  - 🔴 Overdue: expected drug not dispensed this month
  - 🟡 Phase transition due: time to switch from intensive to continuation
  - 🔴 Ethambutol overrun: E dispensed beyond expected phase end date
  - 🔴 Treatment overrun: total duration exceeded
- Quick action buttons: View Details, Add Follow-up, Discharge

**Treatment Progress Logic:**

- Intensive phase duration is stored in `tb_treatment_plans` (usually 2 months)
- Continuation phase duration is stored separately
- Current month number = months elapsed since `phase_start` of the first plan
- Expected end date = `phase_start` + total duration months
- Ethambutol alert fires if: today > `phase_end_expected` of the intensive phase AND E was dispensed in the last 30 days

---

### Module 3: Patient Detail (`/patient/:hn`)

**Purpose:** Full clinical timeline for one enrolled TB patient.

**Sections:**

#### 3a. Patient Header

- Name, HN, age, sex, address, phone (from HOSxP `patient`)
- TB type, enrollment date, enrolled by
- Current status badge (active / completed / transferred / died / defaulted)

#### 3b. Treatment Timeline

- Visual horizontal timeline showing:
  - Intensive phase bar (e.g. months 1-2, colored red-orange)
  - Continuation phase bar (e.g. months 3-8, colored green)
  - Today marker
  - Each follow-up visit marked as a dot on the timeline
- Current phase and month clearly labelled

#### 3c. Drug Dispensing History (from HOSxP)

- Table of all TB drug dispensing records from `opitemrece`
- Columns: date, drug name, quantity, unit
- Color-coded rows by drug class
- Highlights any dispensing that falls outside expected treatment period

#### 3d. Follow-up Records

- Chronological list of recorded follow-ups (from SQLite `tb_followups`)
- Each entry: date, month number, weight, sputum, X-ray, adherence, side effects, notes
- **"+ Add Follow-up"** button opens a side panel form

#### 3e. Side Effect Tracker

- Checklist of common TB drug side effects per drug:
  - H: peripheral neuropathy, hepatotoxicity
  - R: hepatotoxicity, flu-like syndrome, thrombocytopenia
  - E: optic neuritis (visual disturbance) — **priority alert**
  - Z: hyperuricemia (gout), hepatotoxicity
- Alert if E-related optic neuritis reported AND patient still receiving E

#### 3f. Discharge / Outcome Recording

- Button: **"จำหน่ายผู้ป่วย"** → opens outcome form
- Outcome options: Cured, Treatment Completed, Treatment Failed, Died, Lost to Follow-up, Transferred Out
- Sets `tb_patients.status` to `completed` (or appropriate)
- Creates record in `tb_outcomes`

---

### Module 4: Reports (`/reports`)

**Purpose:** Summary statistics and exportable reports for TB clinic audit and accreditation (HA Standard).

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

---

### Module 5: Settings (`/settings`)

**Purpose:** Configure database connections and application preferences.

**Sections:**

- **HOSxP MySQL Connection**: host, port, database name, username, password, test connection button
- **TB Drug Codes**: view/edit the 6 drug icode mappings (in case hospital changes codes)
- **Staff Names**: manage list of staff names for "created by" dropdowns
- **Backup**: export SQLite database file

---

## Tauri Commands (Rust Backend)

### MySQL Commands

```rust
// Search all patients with TB drugs in HOSxP
#[tauri::command]
async fn search_tb_patients(db: State<MySqlPool>, filters: SearchFilters) -> Result<Vec<PatientDrugRecord>>

// Get all TB drug dispensing records for one HN
#[tauri::command]
async fn get_dispensing_history(db: State<MySqlPool>, hn: String) -> Result<Vec<DispensingRecord>>

// Test MySQL connection
#[tauri::command]
async fn test_mysql_connection(config: DbConfig) -> Result<bool>
```

### SQLite Commands

```rust
// Enroll patient into TB clinic
#[tauri::command]
async fn enroll_patient(db: State<SqlitePool>, enrollment: EnrollmentInput) -> Result<i64>

// Get all active TB clinic patients
#[tauri::command]
async fn get_active_patients(db: State<SqlitePool>) -> Result<Vec<TbPatientRow>>

// Get full patient detail (combines SQLite + triggers MySQL fetch)
#[tauri::command]
async fn get_patient_detail(sqlite: State<SqlitePool>, mysql: State<MySqlPool>, hn: String) -> Result<PatientDetail>

// Add follow-up record
#[tauri::command]
async fn add_followup(db: State<SqlitePool>, followup: FollowupInput) -> Result<i64>

// Update treatment plan (phase transition)
#[tauri::command]
async fn update_treatment_phase(db: State<SqlitePool>, plan: TreatmentPlanUpdate) -> Result<()>

// Discharge patient with outcome
#[tauri::command]
async fn discharge_patient(db: State<SqlitePool>, outcome: OutcomeInput) -> Result<()>

// Get alert summary for all active patients
#[tauri::command]
async fn get_patient_alerts(sqlite: State<SqlitePool>, mysql: State<MySqlPool>) -> Result<Vec<PatientAlert>>
```

---

## Vue Router Structure

```
/                    → redirect to /screening
/screening           → Module 1: Drug screening from HOSxP
/active              → Module 2: Active patients dashboard
/patient/:hn         → Module 3: Patient detail
/reports             → Module 4: Reports
/settings            → Module 5: Settings
```

---

## Pinia Stores

| Store | Responsibility |
|-------|----------------|
| `usePatientStore` | Active patient list, enrollment actions |
| `useScreeningStore` | HOSxP search results, pending enrollment |
| `useSettingsStore` | DB config, drug code mappings |
| `useAlertStore` | Computed alerts across all active patients |

---

## Alert Engine

Runs on app startup and every 30 minutes. For each active patient:

1. **Overdue dispensing**: Query HOSxP — no TB drug dispensed in the last 35 days
2. **Ethambutol overrun**: Patient still receiving E (icode 1600004 or 1000129) but intensive phase end date has passed
3. **Phase transition due**: Current date >= `phase_end_expected` of intensive phase but plan not yet updated to continuation
4. **Treatment complete**: Current date >= expected total treatment end date
5. **Lost to follow-up**: No dispensing in HOSxP for > 60 days

Alerts are stored in memory (Pinia `useAlertStore`) and shown as:

- Red badges on the sidebar nav icon
- Inline row highlights on `/active` dashboard
- Top-of-page notification bar on `/patient/:hn`

---

## Design System

> **`DESIGN.md` is the single source of truth for all visual design decisions.**
> Read `DESIGN.md` in full before writing any UI code. Every color value, typography size, spacing unit, border style, shadow stack, border radius, and component state described below refers to definitions in that file — do not hardcode arbitrary values.

Key pointers into `DESIGN.md`:

- **Colors** — use the warm neutral palette and semantic accent colors defined in the Color Palette section. Notion Blue (`#0075de`) is the only saturated accent; use it for primary CTAs and interactive states only.
- **Typography** — follow the full type hierarchy table (Display → Body → Badge). Apply negative letter-spacing at larger sizes exactly as specified.
- **Spacing & Layout** — 8px base unit; sidebar + main content layout; page padding and max-width from the Layout Principles section.
- **Borders & Shadows** — whisper border (`1px solid rgba(0,0,0,0.1)`) throughout; multi-layer shadow stacks from the Depth & Elevation section.
- **Border Radius** — 4px for buttons/inputs, 12px for cards, 9999px for pill badges, per the radius scale.
- **Components** — buttons (primary blue, secondary, ghost), cards, inputs, pill badges, and navigation all have exact specs in the Component Stylings section.
- **Alert semantics** — map overrun/overdue alerts to Orange (`#dd5b00`), phase-transition warnings to the same, success/completion to Teal (`#2a9d99`) or Green (`#1aae39`), as defined under Semantic Accent Colors.
- **Drug class chips** — assign one semantic accent color per drug class (H, R, Z, E) consistently across chips, timeline bars, and table row highlights; pick from the accent palette in DESIGN.md.
- **Icons** — `lucide-vue-next` exclusively; size and stroke follow DESIGN.md guidance.
- **Accessibility** — focus rings, contrast ratios, and interactive states are specified in the Accessibility & States section.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.5 |
| Backend language | Rust (stable) |
| MySQL driver | `sqlx` with MySQL feature |
| SQLite driver | `sqlx` with SQLite feature |
| Frontend framework | Vue 3.5 (Composition API, `<script setup>`) |
| Language | TypeScript 5 |
| State management | Pinia |
| Routing | Vue Router 4 |
| Icons | lucide-vue-next |
| Build tool | Vite |
| Styling | **See `DESIGN.md`** — all colors, typography, spacing, and component styles are defined there |

---

## Cargo.toml Key Dependencies

```toml
[dependencies]
tauri = { version = "2", features = [] }
sqlx = { version = "0.8", features = ["mysql", "sqlite", "runtime-tokio", "chrono"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
```

---

## Project File Structure

```
tb-clinic/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── mysql.rs        # HOSxP connection & queries
│   │   │   └── sqlite.rs       # Local DB migrations & queries
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── screening.rs    # search_tb_patients, get_dispensing_history
│   │   │   ├── patients.rs     # enroll, get_active, discharge
│   │   │   ├── followups.rs    # add_followup, update_plan
│   │   │   ├── alerts.rs       # get_patient_alerts
│   │   │   └── settings.rs     # test_connection, config
│   │   └── models/
│   │       ├── mod.rs
│   │       ├── patient.rs
│   │       ├── dispensing.rs
│   │       ├── treatment.rs
│   │       └── alert.rs
│   └── Cargo.toml
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── router/index.ts
│   ├── stores/
│   │   ├── patient.ts
│   │   ├── screening.ts
│   │   ├── settings.ts
│   │   └── alerts.ts
│   ├── views/
│   │   ├── ScreeningView.vue
│   │   ├── ActiveView.vue
│   │   ├── PatientDetailView.vue
│   │   ├── ReportsView.vue
│   │   └── SettingsView.vue
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue
│   │   │   └── AppHeader.vue
│   │   ├── screening/
│   │   │   ├── PatientTable.vue
│   │   │   └── EnrollModal.vue
│   │   ├── active/
│   │   │   ├── PatientCard.vue
│   │   │   ├── AlertBadge.vue
│   │   │   └── ProgressBar.vue
│   │   ├── patient/
│   │   │   ├── TreatmentTimeline.vue
│   │   │   ├── DispensingTable.vue
│   │   │   ├── FollowupList.vue
│   │   │   ├── FollowupForm.vue
│   │   │   ├── SideEffectTracker.vue
│   │   │   └── DischargeModal.vue
│   │   └── shared/
│   │       ├── StatusBadge.vue
│   │       ├── DrugChip.vue
│   │       └── ConfirmDialog.vue
│   └── types/
│       ├── patient.ts
│       ├── dispensing.ts
│       ├── treatment.ts
│       └── alert.ts
├── DESIGN.md
└── agents.md
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

---

## Notes for Implementation

- Use `sqlx::migrate!()` macro with SQLite for automatic schema migration on first run
- Store MySQL credentials encrypted using Tauri's `stronghold` or OS keychain plugin
- The alert engine should run as a background Tokio task, updating Pinia store via Tauri event emission (`tauri::Emitter`)
- Consider caching HOSxP query results in SQLite with a TTL (e.g. 5 minutes) to reduce repeated queries over Tailscale
- All date arithmetic should use `chrono` on the Rust side; pass ISO strings to frontend
- The `/screening` module may return thousands of rows — implement server-side pagination in the Tauri command
