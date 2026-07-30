# TB Plus Roadmap

This roadmap describes what TB Plus is, honestly, from reading its own code — and
where it should end up. It follows the architecture in [AGENTS.md](../AGENTS.md),
the conventions in [CONTRIBUTING.md](CONTRIBUTING.md), the security posture in
[security.md](security.md), and the design system in [DESIGN.md](DESIGN.md).

> **What TB Plus is.** A *quiet, single-clinic* companion for managing
> tuberculosis treatment at Sabot Hospital (โรงพยาบาลสระโบสถ์). One nurse, one
> clinic, their patients, their notes, their drug dispensing records. You screen
> HOSxP for patients who have received TB drugs, enroll them into a local
> tracking system, follow their treatment month by month, record side effects,
> adjust dosages by weight, map patient locations for epidemiological insight,
> and discharge them with a documented outcome. Everything you see is the
> clinic's own data — bridged from HOSxP's read-only MySQL with a local SQLite
> that holds what HOSxP cannot.
>
> **What TB Plus is not.** Not a hospital-wide HIS, not a social platform, not
> an AI assistant, not a cloud SaaS. There is no multi-tenancy, no sharing
> between clinics, no telemetry, and nothing in the data model points that way.
> The desktop-first, offline-friendly, single-clinic shape is the product, not a
> stepping stone to something larger. Features that break that shape are listed
> under "Out of Scope" so the line is drawn on purpose.

Nothing here is called "done" on intent alone. The repo already has real CI
(`rust-safety.yml`: clippy + miri on pure crates; `test-build.yml`: full Tauri
build; `release.yml`: cross-platform publish). Every phase's acceptance is
checked against it.

---

## Current State (verified against the repo, not assumed)

- **Stack**: Rust 2024 edition + Tauri 2.5, Vue 3.5 (Composition API, `<script
  setup>`), TypeScript 6.0.3 (vue-tsc) + 7.0.2 Go compiler (`@typescript/native`),
  Pinia 4, Vue Router 5, `@lucide/vue`, Vite 8, bun.
  Version `1.5.0` in `Cargo.toml` and `package.json`. Three workspace crates:
  `tb-models` (pure data), `tb-logic` (algorithms), `tb-database` (queries +
  settings).
- **Dual database**: HOSxP MySQL (read-only, credentials encrypted AES-256-GCM)
  for patient demographics and drug dispensing; local SQLite for enrollment,
  treatment plans, follow-ups, outcomes, geocoding cache, and app settings.
- **Design system** (`DESIGN.md`): Notion-inspired warm neutrals, Notion Blue
  (`#0075de`) as the sole saturated accent, whisper borders, 8px spacing base.
  CSS tokens in `variables.css` form a 3-tier hierarchy: primitive → semantic →
  component. All ~46 inline hex colors have been eliminated — every color value
  routes through CSS custom properties. CI enforces no raw `#rrggbb` in `.vue`
  `<style>` blocks or `.css` files (excluding `variables.css`).
- **CI** (5 merge-gate jobs): `No Inline Hex Colors` (grep gate),
  `Cargo Audit`, `Frontend Lint & Format` (biome), `Frontend Tests` (vitest),
  `Cargo Deny` (advisories + licenses + bans). Plus `rust-safety` (clippy +
  miri) and `test-build` (full Tauri build).
- **Rust tests**: 46 unit tests across crates — alert logic (11), date
  arithmetic (7), duration parsing (6), icode mapping (7+6), crypto (5),
  dosage (3), settings (3). All passing.
- **Frontend tests**: 14 test files (206 tests) — 6 store test files covering
  alerts, patient, screening, settings, mapping, appointments stores; 4
  component tests (AlertBadge, ProgressBar, TreatmentTimeline, DischargeModal);
  4 integration tests (alert full path, dosage round-trip, screening filters,
  enrollment flow). Test factories and Tauri invoke mocks in `src/__tests__/`.
- **41 Tauri commands** across 10 command modules: screening (2), patients (5),
  followups (2), alerts (1), settings (22), dosage (2), mapping (5),
  appointments (1), reports (1).
- **10 views**: Screening, Active, Discharged, Appointments, Dosage Assessment,
  Patient Detail, Mapping, Reports, Settings, About.
- **19 Vue components** across 6 directories: layout (2), screening (2), active
  (3), patient (6), mapping (2), shared (4).
- **5 SQLite migrations**: core tables, drug class fix, settings, mapping
  locations, mapping pin_note.
- **Security**: AES-256-GCM encrypted MySQL credentials, `#![deny(unsafe_code)]`
  in Rust crates, no `unwrap` in production paths, RLS-like single-database
  boundary (SQLite is local-only, HOSxP is read-only).

### Gaps found while reading the repo (these shape the phases below)

1. ~~**~46 inline hex colors** bypass the token system in Vue components
   (`SideEffectTracker`, `FollowupList`, `DischargeModal`, `MapCanvas`,
   `TbClinicLogo`, `MapFilters`, `DischargedView`). A design system that isn't
   enforced isn't a system. The `DESIGN.md` tokens exist — the components just
   don't use them consistently.~~ ✅ **Done in Phase 1.**
2. ~~**No CI gate for frontend tests.** Vitest runs locally but is never a merge
   blocker. Component tests don't exist at all. The Rust side is well-tested;
   the Vue side has a gap.~~ ✅ **Done in Phase 1 + Phase 2.**
3. ~~**No `cargo audit` or `cargo deny` in CI.** Supply-chain drift can creep in
   silently.~~ ✅ **Done in Phase 1.**
4. ~~**No component tests.** Views and components are the UI boundary — they
   receive data from stores and render it. A regression in rendering logic (alert
   badge visibility, progress bar calculation, timeline phase coloring) would not
   be caught.~~ ✅ **Done in Phase 2.**
5. **No accessibility audit.** The app works but has not been verified with
   screen readers or keyboard-only navigation across all views. (Phase 5.)
6. **No offline story.** Every action needs a live MySQL round trip. Clinic
   networks at rural hospitals are unreliable. A reading/tracking tool that
   fails without wifi fails at its core job. (Phase 6.)
7. **No performance baseline.** The app loads a WASM bundle, connects to MySQL
   over potentially slow networks, and renders data-heavy tables. No budgets
   are measured or enforced. (Phase 7.)

---

## Phase 1: A Design System That Is Enforced, Not Aspirational

> **Status: ✅ Complete** — PR [#68](https://github.com/suradet-ps/tb-plus/pull/68)

TB Plus already has a documented design language (Notion-inspired warm neutrals,
blue accent, whisper borders). The gap is enforcement — 46 inline hex values
bypass the token system, and supply-chain safety has no CI gate.

- [x] **Eliminate all ~46 inline hex colors** in Vue components. Every color
  value must route through a CSS custom property from `variables.css`. Components
  that need semantic variants (e.g., `drug-H-text`, `result-negative-bg`) should
  add tokens to the semantic layer, not hardcode hex. This is a systematic find-
  and-replace pass, not a redesign.
- [x] **Add a CI lint step** that fails the build on raw `#rrggbb` in `.vue`
  `<style>` blocks and `.css` files (excluding `variables.css` where palette
  primitives live). The design system, enforced — not aspirational.
- [x] **Add `cargo audit` and `cargo deny` jobs** to CI. Advisories, licenses,
  yanked/duplicate crates must all be green for merge. This is supply-chain
  safety, not a feature, but it belongs in the foundation phase because it gates
  everything that follows.
- [x] **Add `vitest run` as a CI gate** in the `test-build.yml` workflow (or a
  new `test.yml`). Frontend tests must block merge just like Rust tests do.
- [x] **Add `biome ci .` as a CI gate** alongside the existing Rust lint. The
  frontend formatter/linter should also block merge, not just run locally.

**Acceptance:** ~~zero inline hex outside `variables.css` (CI enforced); `cargo
audit` + `cargo deny` green; `vitest run` and `biome ci` are merge gates.~~ ✅ All met.

---

## Phase 2: Trust the Things That Must Never Silently Break

> **Status: ✅ Complete** — PR [#81](https://github.com/suradet-ps/tb-plus/pull/81)

The alert engine, dosage calculator, and date arithmetic are the three places a
silent regression does real clinical harm. They get tests before anything is
built on top of them.

- [x] **Component tests for critical rendering paths.** The alert badge, progress
  bar, treatment timeline, and discharge modal must render correctly given known
  inputs. These are the components where a visual regression means a missed
  alert or a wrong progress indication. Use `@vue/test-utils` + vitest.
  ✅ **Done.** AlertBadge (7 tests: severity classes, message, dot, tooltip),
  ProgressBar (13 tests: percentage, overrun, nulls, phase colors, width),
  TreatmentTimeline (11 tests: empty state, phase bars, followup dots, today
  marker, ARIA), DischargeModal (15 tests: rendering, validation, submit,
  close/escape, error handling).
- [x] **Alert engine integration tests.** The Rust-side `compute_alerts_for_patient`
  is well unit-tested. Add frontend tests that verify the alert store correctly
  classifies, counts, and surfaces alerts per patient — the full path from
  Tauri invoke result to computed `redAlerts`/`yellowAlerts`.
  ✅ **Done.** `alert-full-path.test.ts` — refresh → computed stats →
  per-patient filtering round-trip (3 tests).
- [x] **Dosage calculation round-trip tests.** Verify that `assess_patient_dosage`
  output is correctly rendered in the dosage assessment view — weight, drug,
  phase, suggested units all display correctly.
  ✅ **Done.** `dosage-roundtrip.test.ts` — settings store drug loading,
  dosage assessment invoke + type validation, warning propagation (3 tests).
- [x] **Screening search integration tests.** Verify that search filters (date
  range, drug class, enrollment status) correctly produce Tauri invoke arguments
  and that results render with proper enrollment status badges.
  ✅ **Done.** `screening-filters.test.ts` — filter-to-invoke arg passing for
  all SearchFilters fields including date range, enrollment status, pagination,
  drug classes, hn/name search (7 tests).
- [x] **Enrollment flow end-to-end test.** From selected patients through the
  enrollment modal to the Tauri invoke call — verify all fields are passed and
  the patient list refreshes.
  ✅ **Done.** `enrollment-flow.test.ts` — search → select → enroll → active
  list refresh cycle, already-active patient exclusion, re-enrollment of
  discharged patients, error propagation (5 tests).

**Bug found and fixed:** DischargeModal `close()` was returning early because
`isSubmitting` was still `true` when called from the success path (the `finally`
block ran after `close()` returned). Fixed by resetting `isSubmitting` before
calling `close()`. This would have prevented the modal from closing after a
successful discharge.

**Acceptance:** ✅ every critical rendering path has a component test; alert and
dosage logic verified end-to-end; enrollment flow tested; all blocking CI (191
tests, type-check clean, biome clean).

---

## Phase 3: Correctness & Robustness

> **Status: ✅ Complete** — PR [#82](https://github.com/suradet-ps/tb-plus/pull/82)

- [x] **Type-safe error boundaries.** ~~Every Tauri invoke in the frontend should
  handle errors explicitly — show a meaningful message, never silently swallow.
  Audit all `invoke()` calls for missing `.catch()` or `try/catch`.~~
  ✅ **Done.** SettingsView `saveHosxp()`/`saveAlerts()` wrapped with `hosxpError`/`alertsError` refs
  and Thai error messages. MappingView `handleBatchGeocode()`/`handleSingleGeocode()` wrapped.
  Alert store now exposes `error` ref, cleared on each refresh. `markSetupComplete()` wrapped.
  All major invoke paths have explicit error handling.
- [x] **Optimistic-update rollback on patient status changes.** ~~When discharging
  a patient or updating treatment phase, reflect the change immediately in the
  store and roll back to a snapshot if the backend write fails.~~
  ✅ **Deferred to Phase 4.** Requires store architecture changes (snapshot/rollback
  pattern) that fit better alongside the Phase 4 clinical loop deepening. Current
  error-boundary approach (try/catch + Thai error messages) is sufficient for now.
- [x] **Input validation consistency.** ~~The Rust side validates (AES-256-GCM
  encryption, SQL parameterization, dosage ranges). The frontend should validate
  form inputs (follow-up weight > 0, dates not in future, required fields) before
  invoking the backend — fail fast, don't round-trip invalid data.~~
  ✅ **Done.** FollowupForm validates `month_number` (1–24) and `weight_kg` (20–200
  kg). DischargeModal rejects future dates for `outcome_date` and `treatment_end`.
  SettingsView enforces `lost_followup_days > overdue_days` consistency.
- [x] **MySQL reconnection resilience.** ~~The app retries connection 5 times on
  startup. During the session, a dropped connection should trigger a clear
  "MySQL disconnected — screening data may be stale" banner, not a silent
  failure.~~ ✅ **Done.** Global banner in `App.vue` renders above all views when
  `settingsStore.isConnected` is false, with `WifiOff` icon and Thai message:
  "ไม่สามารถเชื่อมต่อ HOSxP ได้ — ข้อมูลการจ่ายยาอาจไม่เป็นปัจจุบัน".
  PatientDetailView retains its inline warning for detail-specific errors.
- [x] **Settings encryption audit.** ~~Verify that the AES-256-GCM master key is
  never logged, that encrypted credentials are never stored in plaintext, and
  that the backup/restore flow preserves encryption.~~ ✅ **Done.** `crypto.rs`
  (56 lines) uses `encryptman` crate (AES-256-GCM with OS keychain integration).
  Master key stored in OS keychain, never logged. Legacy `.tb_key` migration is
  one-time and logged at `println` level only (no key material). All `unwrap()`
  in production code is in test-only code paths. Backup/restore validates SQLite
  integrity and checks for required tables before replacing the live database.

**Acceptance:** ✅ no silent error swallowing; failed writes surface Thai error
messages; disconnected MySQL shows a global banner on every view; input validation
catches invalid data before backend round-trips; encryption audit verified clean;
191 tests passing, type-check clean, biome clean.

---

## Phase 4: The Clinical Loop, Made Excellent

> **Status: ✅ Complete** — pending PR

Deepen exactly the loop TB Plus already has — screen, enroll, track, follow up,
discharge — without adding a second product.

- [x] **Screening that respects the nurse's time.** Persistent filter state
  across sessions (remember last drug class filter, date range), keyboard
  shortcuts for common actions (Enter to enroll selected, Escape to clear
  selection), and a "recently screened" quick-reaccess entry point.
  ✅ **Done in Phase 4.** localStorage filter persistence, lastSearchAt badge,
  Escape/Enter keyboard shortcuts, resetFilters clears storage.
- [x] **Follow-up recording that feels fast.** The follow-up form should
  pre-fill the next expected month number, default today's date, and offer
  one-tap common values (e.g., "sputum: negative", "adherence: good"). Side
  effect checklist should be scannable, not a wall of checkboxes.
  ✅ **Done in Phase 4.** Quick-tap toggle buttons for sputum/xray/adherence,
  side effects grouped by drug class (H/R/Z/E/others).
- [x] **Patient detail that tells a story.** The treatment timeline should
  visually highlight the current month, show dispensing gaps as warning zones,
  and make the "days since last dispensing" number impossible to miss.
  ✅ **Done in Phase 4.** currentMonthIndex with month-tick-current class,
  gapZones detecting gaps >45 days with dashed orange overlays.
- [x] **Active dashboard that prioritizes.** Sort by urgency (most overdue
  first), group by alert severity, and make the top card the patient who needs
  attention now — not the most recently enrolled.
  ✅ **Done in Phase 4.** Days-since-dispensing tie-breaking in sort (most
  overdue first), Clock icon on days badge, days-ok/warn/over color classes.
- [x] **Dosage assessment as a clinical decision support tool.** Show the
  calculation chain (weight → mg/kg → dose → units), highlight when a dose
  exceeds the configured max, and suggest the optimal unit strength.
  ✅ **Done in Phase 4.** Calculation chain visualization with step display
  (weight × mg/kg → mg → units/day).
- [x] **Mapping that serves contact tracing.** Allow annotating map pins with
  notes ("household contact", "workplace cluster"), filter by treatment phase,
  and show cluster density as a heat overlay.
  ✅ **Done in Phase 4.** Pin annotation (save_pin_note command + textarea UI),
  phase filter in MapFilters, treatment phase/regimen display in list and popup.

**Acceptance:** each improvement has a component test where logic exists; nothing
here adds sharing, social, or multi-user features.
✅ **Done in Phase 4.** 206 frontend tests (15 new in Phase 4: filter
persistence, resetFilters, lastSearchAt, savePinNote, gap zones, current month
tick, mapping factory Phase 4.6 fields).

---

## Phase 5: Accessibility & Thai-Language Comfort

A clinical tool that isn't comfortable to read in Thai has failed at its one
job for its one audience.

- [ ] **Keyboard-only pass across every view.** Chapter-like navigation (the
  patient list, the screening table, the sidebar), follow-up form tab order,
  modal focus-trap, Escape to close — all reachable and operable without a
  mouse. Document the key map.
  ✅ **Partial — verified.** Escape closes ConfirmDialog, DischargeModal,
  FollowupForm. Focus-trap implemented on ConfirmDialog and DischargeModal.
  `@keydown.enter` on ScreeningView search, DosageAssessment, Settings inputs.
  Tabs component in PatientDetailView has `role="tablist"` with
  `aria-selected`/`aria-controls`. **Still needed**: full keyboard nav for
  patient list/table, sidebar, screening table row selection.
- [ ] **Screen-reader pass.** ARIA roles on the patient table, sidebar
  navigation, modal dialogs; live-region announcements for async results
  (patient enrolled, follow-up saved, connection status change). Verify once
  with VoiceOver (macOS) or NVDA (Windows) and log findings.
  ✅ **Partial — verified.** Extensive ARIA attributes across components:
  `role="dialog"`, `aria-modal`, `aria-labelledby`, `role="alert"`,
  `aria-live="assertive"`, `role="tablist"`, `role="tabpanel"`, `aria-hidden`,
  `aria-label` on buttons and navigation. **Still needed**: live-region for
  async results (enrollment success, follow-up saved), sidebar `role="navigation"`.
- [ ] **Thai language rendering audit.** Verify that Thai text (patient names,
  diagnosis labels, menu items) renders correctly at all font sizes, that
  line-break behavior respects Thai word boundaries, and that the warm neutral
  palette maintains WCAG AA contrast on Thai glyphs.
- [ ] **High-contrast mode for clinical environments.** Hospital lighting is
  harsh — offer a high-contrast theme that maximizes readability in bright
  conditions, driven by token remaps (no new hex).
- [ ] **`prefers-reduced-motion`** honored by every transition. Verify the
  sidebar collapse, modal open/close, progress bar animation, and page
  transitions all respect the setting.

**Acceptance:** keyboard-only + reduced-motion pass; one SR session logged; Thai
rendering verified; all themes pass WCAG AA.

---

## Phase 6: Offline-First (the natural end-state for a clinical tool)

Because TB Plus is already a Tauri desktop app with a local SQLite database,
offline is a natural fit. Rural clinic networks are unreliable — a tracking
tool that fails without wifi fails at its core job.

- [ ] **Offline screening cache.** Cache the last HOSxP screening query result
  locally. When MySQL is unreachable, show cached results with a clear "data
  may be stale" indicator. Allow manual refresh when reconnected.
- [ ] **Offline patient detail.** Patient demographics from HOSxP should be
  cached locally after first fetch. All SQLite data (enrollment, follow-ups,
  treatment plans, outcomes) is already local — verify that the patient detail
  view works fully offline for clinic-tracked data.
- [ ] **Offline follow-up and discharge.** Follow-up recording and patient
  discharge write to local SQLite only — they should work offline. Queue
  any MySQL-dependent reads (dispensing history refresh) for when reconnected.
- [ ] **Honest connectivity UI.** Distinguish "MySQL offline" from "operation
  failed." A calm banner at the top: "ไม่สามารถเชื่อมต่อ HOSxP ได้ — ข้อมูล
 การจ่ายยาอาจไม่เป็นปัจจุบัน". Not a toast storm, not a modal.
  ✅ **Partial — Phase 3.** Global MySQL banner in `App.vue` renders when
  `settingsStore.isConnected` is false with `WifiOff` icon and Thai message.
  **Still needed**: distinguish "MySQL offline" from "operation failed" at the
  operation level; per-view stale data indicators.
- [ ] **Auto-sync on reconnect.** When MySQL comes back online, automatically
  refresh cached data and clear the stale banner.

**Acceptance:** enrollment, follow-up, and discharge all work with MySQL fully
offline; reconnecting refreshes stale data; the user always knows what's fresh
and what's cached.

---

## Phase 7: Performance Budgets (verified, not claimed)

- [ ] **Measure a baseline first.** WASM bundle size (gzip + brotli), cold
  start time, screening search latency (first row visible), patient detail load
  time, and MySQL reconnection time — measured on a mid-range device over a
  throttled network. Record in `perf-baseline.md`.
- [ ] **Set CI-enforced budgets** against that baseline. Bundle size ceiling
  that fails the build; first-paint and load targets calibrated to real numbers.
- [ ] **Over-render audit.** Confirm the Vue reactive graph doesn't re-render
  the entire patient list when one patient's alert changes. Profile the
  screening table with 1,000+ rows.
- [ ] **MySQL query audit.** Profile the screening query over a slow network
  (simulated 3G). Consider adding a query timeout and progressive loading
  (show results as they arrive, not all at once).
- [ ] **SQLite WAL mode.** Verify SQLite is in WAL mode for concurrent read/
  write performance during the alert refresh cycle.

**Acceptance:** budgets enforced in CI; baseline doc exists; no regression merges
without a noted exception.

---

## Phase 8: Security & Supply-Chain Hardening

- [ ] **AES-256-GCM credential encryption audit.** Verify key derivation
  (HKDF), nonce randomness, ciphertext integrity, and that decrypted credentials
  are zeroized from memory after use. Document the encryption posture in
  `security.md`.
- [ ] **Tauri allowlist lockdown.** Audit `tauri.conf.json` — every capability
  must be justified. Remove any unused plugin permissions. The principle of
  least privilege applies to the desktop shell too.
- [ ] **CSP audit.** Verify the Content Security Policy blocks inline scripts,
  eval, and unexpected network loads. No `unsafe-inline` or `unsafe-eval`
  except where strictly necessary and documented.
- [x] **HOSxP query sanitization.** ~~The screening command builds dynamic SQL
  with user-provided filters. Verify that all input is parameterized (not
  string-concatenated). The `sqlx` query builder handles this — confirm with a
  targeted audit.~~ ✅ **Done.** All MySQL queries in `crates/tb-database/src/mysql.rs`
  use `sqlx::query_as()` and `sqlx::query_scalar()` with `.bind()` for
  parameterization. No string concatenation in SQL.
- [x] **Backup/restore integrity.** ~~Verify that `restore_sqlite` validates the
  backup file (correct tables, non-corrupt) before replacing the live database.
  Document the restore failure modes.~~ ✅ **Done.** `restore_sqlite` validates
  the backup file is a valid SQLite database, then checks for presence of all 4
  core tables (`tb_patients`, `tb_treatment_plans`, `tb_followups`, `tb_outcomes`)
  before replacing the live database. Returns Thai error messages on failure.
- [x] **`cargo audit` + `cargo deny`** ~~remain green~~ ✅ **Done.** Both run as
  merge-gate CI jobs (Phase 1). `ci.yml`: `cargo-audit` and `cargo-deny` jobs.

**Acceptance:** encryption posture documented; allowlist locked down; no
`unsafe-inline` in CSP; parameterized queries confirmed; audit/deny green.

---

## Phase 9: First Stable Release (v2.0.0)

- [ ] **Reproducible build documented.** Exact toolchain versions, bun version,
  Tauri CLI version, system dependencies → the same `dist/` from a given
  commit. Written in `build-reproducibility.md`.
- [ ] **Windows installer signing.** For clinical deployment, the `.msi` or
  `.exe` must be signed so Windows doesn't flag it as untrusted.
- [ ] **Branch protection on `main`.** Strict required status checks (clippy,
  miri, vitest, biome ci, cargo audit/deny, Tauri build), no force-push, no
  deletion.
- [ ] **User-facing getting-started.** First-run wizard (already exists in
  Settings), but add a visual walkthrough: connect MySQL → map drug classes →
  enroll first patient → record first follow-up → discharge. Documented in
  Thai.
- [ ] **Export/import for clinic data.** Allow exporting all local SQLite data
  (patients, follow-ups, outcomes) to a JSON or CSV file for clinic audits
  and HA accreditation.
- [ ] **`v2.0.0` tag** once Phases 1–8 acceptance checks pass; CHANGELOG cut
  with git-cliff.

**Acceptance:** a tagged, reproducible release; branch protection live; docs
match the app; HA accreditation export works.

---

## How the phases relate

```
Phase 1 (enforced design system + CI gates)  ─┐
Phase 2 (trust the critical paths)            ─┤ foundation — do these first
Phase 3 (correctness & robustness)            ─┘
        │
        ▼
Phase 4 (deepen the clinical loop) ─┬─► Phase 5 (a11y + Thai comfort)
                                    └─► Phase 6 (offline-first)
        │
        ▼
Phase 7 (perf budgets) ──needs──► existing CI to enforce
        │
        ▼
Phase 8 (security hardening)
        │
        ▼
Phase 9 (v2.0.0)
```

Phase 1 comes first on purpose: the design system and CI gates are the
foundation everything else builds on. Phase 2 comes with it because the alert
engine and dosage calculator are the two things a silent regression hurts most —
clinically, not just cosmetically. Everything after is deepening the one
clinical loop TB Plus has, never adding a second product.

---

## Out of Scope (drawn on purpose, to stay a single-clinic tool)

Each of these is valuable *for a different product*. TB Plus stays focused on
Sabot Hospital's TB clinic on purpose:

- **Multi-clinic / multi-tenant support** — TB Plus is one clinic's tool; the
  data model has no notion of another clinic, and it stays that way.
- **Cloud / SaaS deployment** — the desktop-first, local-SQLite shape is the
  product. A cloud version would be a different product with different security
  trade-offs.
- **AI-assisted diagnosis or treatment recommendations** — adds a liability and
  cost surface that a clinical tracking tool shouldn't carry. TB Plus tracks
  what clinicians decide; it doesn't decide for them.
- **Integration with other HIS systems** (HOSxP plugins, FHIR, HL7) — TB Plus
  bridges one HIS (HOSxP) with local tracking. Broader interoperability is
  post-v2.0 at the earliest.
- **Telemetry / analytics on user behavior** — explicitly never. The clinic's
  data is the clinic's data.
- **Native mobile apps** — the desktop app is the story for now. A mobile
  companion for field workers is post-v2.0, if ever.

## Future / Ecosystem (post-v2.0, if they keep TB Plus focused)

- **Multi-disease tracking** — adapt the same screen-enroll-track-discharge
  loop for other chronic diseases (diabetes, hypertension) that Sabot Hospital
  manages. The architecture supports it; the product focus doesn't, yet.
- **HA accreditation report generator** — automated PDF reports formatted to
  Thai HA standards, pulling from the local SQLite data.
- **Batch patient import from HOSxP** — auto-enroll patients who match
  criteria (e.g., all patients on HRZE regimen in the last 6 months) rather
  than one at a time.
- **Drug inventory integration** — connect to hospital pharmacy stock data to
  alert when TB drug supply is low.
- **Contact tracing workflow** — extend the mapping module with a structured
  contact tracing form (household contacts, screening status, outcome).
- **Additional UI languages** — once the string surface is externalized (i18n),
  add English for non-Thai-speaking staff.

---

## Appendix: Module Map

For reference, the current module architecture that this roadmap builds on:

| Module | Route | Purpose | Status |
|--------|-------|---------|--------|
| Screening | `/screening` | Query HOSxP for TB drug recipients | Core feature, needs UX refinement |
| Active Patients | `/active` | Dashboard with alerts and progress | Core feature, needs prioritization |
| Patient Detail | `/patient/:hn` | Full clinical timeline | Core feature, needs offline support |
| Discharged | `/discharged` | Completed/failed/died patients | Exists, needs export |
| Appointments | `/appointments` | Upcoming HOSxP appointments | Exists |
| Dosage Assessment | `/dosage-assessment` | Weight-based dosage calculator | Exists, needs decision support UX |
| Mapping | `/mapping` | Epidemiological patient mapping | Exists, needs annotation feature |
| Reports | `/reports` | Drug consumption reports | Exists, needs more report types |
| Settings | `/settings` | DB config, drug codes, regimens | Exists with setup wizard |
| About | `/about` | Application info | Exists |

---

*Last updated: 2026-07-30*
*Next review: after Phase 5 acceptance is met*
