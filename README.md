# TB Plus

```
████████╗██████╗ ██████╗ ██╗     ██╗   ██╗ ██████╗
╚══██╔══╝██╔══██╗██╔══██╗██║     ██║   ██║██╔════╝
   ██║   ██████╔╝██████╔╝██║     ██║   ██║███████╗
   ██║   ██╔══██╗██╔═══╝ ██║     ██║   ██║╚════██║
   ██║   ██████╔╝██║     ███████╗╚██████╔╝██████╔╝
   ╚═╝╚═════╝╚═╝╚══════╝ ╚═════╝ ╚═════╝
```

---

## ◆ PULSE

Tuberculosis treatment is won in the follow-up, one month at a time.
TB Plus is the desktop companion for the TB clinic: it reads HOSxP
read-only to screen who has received TB drugs, keeps the clinic's own
tracking in a local SQLite store, and turns weight updates into dosage
alerts, dispensing history into timelines, and patient locations into
a disease-distribution map. Adherence is watched by an alert engine,
audits answer to HA Standard, and the clinic works even when the
network does not.

| Screening ▣ | Dosage ▣ | Mapping ▣ | Offline ▣ |
|---|---|---|---|

*P1-P8 are sealed - design, trust, correctness, the clinical loop,
accessibility, offline-first, budgets, security. The v2.0.0 tag alone
stands open.*

> Built with Tauri 2 + Vue 3, read from HOSxP MySQL by `sqlx`, kept in
> a local SQLite store - three crates, one clinic, no cloud.
>
> **suradet-ps**, artifact keeper

---

## ◆ IGNITION

One runtime, two commands.

```
⟫ git clone https://github.com/suradet-ps/tb-plus.git
⟫ cd tb-plus
⟫ bun install
⟫ bun tauri dev
```

The release artifact: `⟫ bun tauri build` - the OS-specific binary.

<details>
<summary>Prerequisites</summary>

- Node.js 18+
- [Rust](https://www.rust-lang.org/)
- [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/)
- A HOSxP MySQL instance (read-only) for screening and history

</details>

---

## ◆ ANATOMY

Three crates, two databases, one law: HOSxP is read, SQLite is the
clinic's own.

- **Screens** - queries HOSxP for patients who received TB drugs and
  surfaces the new ones - the clinic learns who walked in before the
  paper does.
- **Tracks** - the active patients dashboard carries treatment
  progress, monthly follow-ups, side-effect records, and an alert
  engine that watches adherence without being asked twice.
- **Doses** - weight-based dosage management recalculates on every
  weight update and alerts when the regimen should follow - the dose
  tracks the patient, not the last visit.
- **Maps** - disease distribution pins patient locations on an
  interactive map - clusters become visible, contact tracing becomes
  a picture.
- **Reports** - summary statistics and exportable CSV for TB clinic
  audits against HA Standard - the audit finds what the clinic already
  knows.
- **Remembers** - settings configure connections and TB drug codes,
  and export SQLite backups - the clinic's data belongs to the
  clinic.

---

## ◆ RITUALS

**The core ceremony** - the monthly TB follow-up:

1. Open TB Plus. The dashboard answers: active patients, treatment
   progress, adherence alerts.
2. Screen first - who among HOSxP's drug recipients has not been
   enrolled yet.
3. Weigh the patient. The dosage engine recalculates; the alert says
   if the regimen must follow.
4. Record the follow-up and the side effects; the timeline grows; the
   report at the end of the year is already written.

**The ceremony of the two databases** - HOSxP is the system of record
and is never written to; SQLite is the clinic's ledger and is always
backed up. Each database knows its role, and neither is asked to do
the other's.

**The ceremony of the offline clinic** - the network dies in the
consultation room and the follow-up continues: the local store serves
the dashboard, the alerts, and the timeline until HOSxP is reachable
again.

---

## ◆ ECHOES

**Where this artifact is heading**

```
P1-P2 ▸ enforced design system, test trust ─────────────────────────── ▸ sealed
P3-P4 ▸ correctness, the clinical loop ──────────────────────────────── ▸ sealed
P5-P8 ▸ accessibility, offline-first, budgets, security ─────────────── ▸ sealed
P9    ▸ v2.0.0 stable release tag ───────────────────────────────────── ▸ open
```

**Raising the artifact** - the honest plan lives in `docs/ROADMAP.md`;
the workspace notes in `docs/cargo-workspace.md`; the design language
in `docs/DESIGN.md`; the security posture in `docs/security.md`; the
budgets in `perf-budgets.json`. Open an issue first to discuss a
change.

**Status** - CI gates every push with fmt, clippy, tests, and the
budget checks. [Watch the gates](.github/workflows).

---

```
  ─────────────────────────────────────────
   TB is cured one follow-up at a time.
   The clinic's memory must never skip one.
  ─────────────────────────────────────────
```

Licensed under the [MIT License](LICENSE).