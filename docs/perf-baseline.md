# TB Plus - Performance Baseline

Measured on 2026-07-30 against v1.8.0 build output (`vite build`).
Device: mid-range Windows desktop. Network: local (no throttling).

---

## Bundle Sizes (production build, gzip)

| Chunk | Raw | Gzip | Notes |
|-------|-----|------|-------|
| `vue` | 89.2 KB | 34.2 KB | Vue 3 + Router + Pinia |
| `leaflet` | 178.7 KB | 50.0 KB | Leaflet map (lazy-loaded on `/mapping`) |
| `index` | 54.8 KB | 19.0 KB | App entry, router, shared code |
| `PatientDetailView` | 61.6 KB | 16.2 KB | Largest route chunk |
| `SettingsView` | 33.3 KB | 8.9 KB | |
| `ScreeningView` | 20.3 KB | 6.4 KB | |
| `ReportsView` | 25.2 KB | 6.4 KB | |
| `MappingView` | 19.8 KB | 6.4 KB | |
| `ActiveView` | 9.9 KB | 3.5 KB | |
| `DosageAssessmentView` | 9.5 KB | 3.5 KB | |
| `AboutView` | 8.7 KB | 2.9 KB | |
| `DischargedView` | 6.3 KB | 2.2 KB | |
| `AppointmentsView` | 4.6 KB | 1.9 KB | |
| Lucide icons (12 files) | 2.2 KB | 2.2 KB | Tree-shaken, individual chunks |
| Shared (DrugChip, StatusBadge, useFocusTrap) | 3.0 KB | 1.6 KB | |
| **JS Total** | **528.2 KB** | **165.6 KB** | |
| **CSS Total** | **188.9 KB** | **37.5 KB** | |
| **Combined** | **717.1 KB** | **203.1 KB** | |

### Key observations

- `leaflet` is the largest chunk (50 KB gzip) but only loads on the `/mapping` route.
- `vue` chunk includes Vue core + Router + Pinia - 34.2 KB gzip is expected.
- `index` chunk is lean at 19 KB gzip - the manual chunk splitting in `vite.config.ts` is effective.
- `PatientDetailView` is the heaviest route chunk (16.2 KB) due to timeline + dispensing table + followup list.
- Total JS gzip (165.6 KB) is well under the 650 KB ceiling - 75% headroom.

---

## CI-Enforced Budgets

Defined in `perf-budgets.json`. Budget thresholds are set with ~50% headroom above
current measured values to allow organic growth while catching regressions.

| Budget | Ceiling (gzip) | Current | Headroom |
|--------|----------------|---------|----------|
| Total JS | 250 KB | 165.6 KB | 51% |
| `vue` chunk | 50 KB | 34.2 KB | 46% |
| `leaflet` chunk | 75 KB | 50.0 KB | 50% |
| `index` chunk | 30 KB | 19.0 KB | 58% |
| Total CSS | 60 KB | 37.5 KB | 60% |

---

## Rendering Performance

### Over-render audit (2026-07-30)

**Finding: No over-rendering issue detected.**

The alert auto-refresh (every 30 min) replaces `alerts.value` in the alert store.
However, the ActiveView patient table reads alerts from `patientStore.activePatients`
(embedded in each `ActivePatientRow`), NOT from `alertStore`. This means:

- Alert refresh only re-renders: sidebar badge number, stats bar numbers.
- Patient table rows are NOT re-rendered by alert refresh.
- Full patient list re-render only happens on explicit `fetchActivePatients()` call.

Two independent alert data sources exist (alertStore vs embedded in ActivePatientRow).
They can diverge between refreshes - this is a design tradeoff, not a bug.

**No `shallowRef` or `shallowReactive` is used** anywhere in the frontend.
All store state uses standard `ref()`. For the current data sizes (50-200 patients,
small alert objects), deep reactivity overhead is negligible.

**Screening table** renders all rows without virtualization (up to 200 per page).
For typical clinic sizes this is fine. If scaling beyond 500 rows, virtualization
would be needed.

**Recommendation:** No changes required at current scale. Document these findings
as the baseline. Re-audit if patient count exceeds 500 or if users report UI lag.

---

## MySQL Query Performance

### Screening query (heaviest)

- 3-way JOIN: `opitemrece` × `patient` × `drugitems`
- `GROUP BY p.hn` + `GROUP_CONCAT` on icodes and drug names
- `LIMIT/OFFSET` pagination (does not reduce MySQL-side scan)
- 30-second timeout via `tokio::time::timeout`
- Name search uses `%name%` (cannot use index)
- Enrollment-status filter applied in Rust post-fetch

### Other queries

- Simple lookups (`WHERE hn = ?`), single-table or 1-table JOIN
- 10-second timeout applied to all queries (Phase 7)
- No progressive loading - binary loading state per query

---

## SQLite Performance

- WAL mode enabled at startup (`PRAGMA journal_mode=WAL`)
- Max 5 connections in the pool
- All writes use transactions (`pool.begin()` / `tx.commit()`)
- 5 migrations, all run at startup before UI loads

---

*Baseline measured from `vite build` output. Runtime latencies (cold start,
search, detail load) require the full Tauri app running with a MySQL connection
and are documented here when measured in a clinical environment.*
