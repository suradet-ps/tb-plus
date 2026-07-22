# Contributing to TB Plus

Thank you for contributing to TB Plus. This document covers the conventions,
tools, and workflow used in this repository.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [bun](https://bun.sh) | latest | Package manager & script runner |
| [Rust](https://rustup.rs) | stable (1.94.1+) | Backend compiler |
| [Tauri CLI](https://v2.tauri.app/start/prerequisites/) | 2.x | Desktop app build tooling |
| [cargo-deny](https://github.com/EmbarkStudios/cargo-deny) | latest | Dependency auditing |

### Tauri system dependencies (Linux only)

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

macOS and Windows require no extra system packages.

---

## Getting Started

```bash
git clone https://github.com/suradet-ps/tb-plus.git
cd tb-plus
bun install
bun tauri dev
```

The dev server runs on `http://localhost:1420`. The Tauri window opens
automatically.

---

## Project Structure

```
tb-plus/
├── src/                  # Vue 3.5 frontend (TypeScript)
├── src-tauri/            # Tauri 2.5 shell + Rust commands
├── crates/
│   ├── tb-models/        # Pure data models (no Tauri dependency)
│   ├── tb-logic/         # Business logic (alerts, dosage, parsing)
│   └── tb-database/      # MySQL/SQLite queries, encrypted settings
├── docs/                 # Design system, roadmap, contributing guide
└── scripts/              # Build helper scripts
```

The Rust workspace has four crates. `tb-models`, `tb-logic`, and `tb-database`
are pure Rust libraries — they can be tested and linted without Tauri system
dependencies. `src-tauri` is the Tauri application that ties everything together.

---

## Development Workflow

### Branching

- `main` is the stable branch. All PRs target `main`.
- Use descriptive branch names: `fix/alert-overrun-calc`, `feat/offline-cache`,
  `chore/update-deps`.

### Commits

Write clear, concise commit messages. Follow the
[Conventional Commits](https://www.conventionalcommits.org/) style:

```
feat: add offline screening cache
fix: correct ethambutol overrun alert logic
chore: update dependencies
docs: add contributing guide
```

---

## Code Style

### Frontend (TypeScript / Vue)

Formatter and linter: **Biome 2.5**. Configuration in `biome.json`.

| Rule | Value |
|------|-------|
| Indent | 2 spaces |
| Line width | 100 |
| Quotes | Single |
| Semicolons | Always |
| Trailing commas | All |

Run checks:

```bash
bun run check        # format + lint
bun run check:fix    # format + lint with auto-fix
bun run fmt          # format only
bun run lint         # lint only
bun run type-check   # TypeScript type checking (vue-tsc)
```

### Rust

Formatter: **rustfmt**. Linter: **Clippy (pedantic + nursery)**.

```bash
cd src-tauri
cargo fmt -- --check    # check formatting
cargo clippy --all-targets -- -D warnings   # lint
```

Clippy is configured to **deny** the following in all workspace crates:
`unwrap`, `expect`, `panic`, `todo`, `unimplemented`, `dbg!`.

### Design System

All visual styles must use CSS custom properties from `src/styles/variables.css`.
No inline hex colors in `.vue` `<style>` blocks or `.css` files (CI enforced).
See [`docs/DESIGN.md`](DESIGN.md) for the full token system.

---

## Testing

### Frontend (vitest)

```bash
bun run test          # single run
bun run test:watch    # watch mode
bun run test:coverage # with coverage
```

Test files live in `src/stores/__tests__/` and follow the `*.test.ts` naming
convention. Test factories are in `src/__tests__/factories/`. Tauri `invoke()`
mocks are in `src/__tests__/mocks/tauri.ts`.

### Rust

```bash
cd src-tauri
cargo test --workspace
```

Tests are inline modules (`#[cfg(test)]`) within source files. The `tb-models`
and `tb-logic` crates can also be tested under Miri for memory safety:

```bash
cargo +nightly miri test -p tb-models
cargo +nightly miri test -p tb-logic
```

---

## CI Checks

Every PR must pass these merge gates before merge:

| Job | What it checks |
|-----|----------------|
| Frontend Lint & Format | `bun run ci` + `bun run type-check` |
| Frontend Tests | `bun run test` |
| No Inline Hex Colors | No `#rrggbb` in `.vue`/`.css` outside `variables.css` |
| Cargo Audit | Known vulnerability scanning |
| Cargo Deny | Advisories, licenses, bans |
| clippy-pedantic | `cargo clippy -- -D warnings` |
| miri-test | Memory safety on pure Rust crates |
| test-build | Full `bun tauri build` |

---

## Pull Requests

1. Create a feature branch from `main`.
2. Make your changes, following the style and testing guidelines above.
3. Ensure all CI checks pass.
4. Open a PR against `main` with a clear description of what changed and why.
5. Request a review if the change is non-trivial.

Keep PRs focused. One logical change per PR makes review easier and bisection
cleaner.

---

## Security

Report security vulnerabilities privately. See [`docs/security.md`](security.md)
for the security policy. Do not open public issues for security bugs.

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](../LICENSE).
