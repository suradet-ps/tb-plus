# Tauri + Vue Workspace Guidelines

> 🔒 **Security Policy:** All agents MUST also read and follow `docs/security.md`. Security rules take precedence over convenience or brevity.

## Project Architecture

This project uses a **Cargo Workspace** to strictly separate pure Rust business logic from the Tauri application layer and Vue frontend.

```
project-root/
├── Cargo.toml              # Workspace root manifest
├── .clippy.toml            # Shared Clippy configuration
├── .cargo/config.toml      # Shared rustflags & lint levels
├── crates/                 # Pure Rust crates (NO Tauri dependency)
│   └── <domain>-*/         # Domain-specific logic crates
├── src-tauri/              # Tauri app (thin wrapper only)
└── src/                    # Vue.js frontend
```

> ⚠️ **AI Agent:** Always inspect the actual `[workspace.members]` in root `Cargo.toml` to discover available crates. Do NOT assume crate names.

## Critical Rules for AI Agents

### 1. Crate Boundaries Are Strict
- **NEVER** add `tauri`, `tauri-build`, or any Tauri-related crate as a dependency to any member under `crates/`.
- **NEVER** put business logic, algorithms, validation rules, or data transformation in `src-tauri/src/`.
- `src-tauri/src/` should ONLY contain:
  - Tauri command handlers (thin wrappers that delegate to `crates/*`)
  - Tauri plugin setup and window/menu configuration
  - IPC serialization/deserialization glue code
- All reusable logic MUST live in appropriate `crates/*` members.

### 2. Code Safety Standards
- **NEVER** use `.unwrap()` or `.expect()` in non-test code. Use `Result<T, E>` with descriptive error types.
- Every `unsafe` block requires an inline comment explaining the full safety invariant. If you cannot formally justify it, do NOT write it.
- Prefer explicit error handling over panics in all production code paths.
- All generated Rust code MUST pass `clippy::pedantic` and `clippy::nursery` without warnings.

### 3. Testing Requirements
- Every public function in `crates/*` MUST have at least one unit test.
- Critical logic (calculations, parsing, validation) MUST have tests for: normal range, boundary values, invalid inputs, and known reference values.
- Tests must be deterministic and not depend on system time, filesystem, network, or Tauri runtime.
- Run `cargo +nightly miri test -p <crate-name>` for pure logic changes when possible.

### 4. Dependency Management
- Each crate declares its own dependency versions explicitly in its own `Cargo.toml`. Do NOT use `{ workspace = true }` to inherit from root — this keeps each crate self-contained and independently understandable.
- When suggesting new dependencies, verify they exist on crates.io and are actively maintained.
- If `cargo-vet` is configured, never bypass audit requirements. Use `cargo vet certify` for reviewed crates.

### 5. Commands Reference
```bash
# Check entire workspace
cargo clippy --all-targets -- -D warnings

# Test specific pure-logic crate
cargo test -p <crate-name>
cargo +nightly miri test -p <crate-name>   # Pure logic only, no FFI

# Build Tauri app
cargo tauri build

# Frontend type-check
npm run type-check
```

## Adding New Crates
When creating a new crate under `crates/`:
1. Use `cargo new --lib crates/<name>`
2. Add it to `[workspace.members]` in root `Cargo.toml`
3. Specify all dependency versions explicitly in the crate's own `Cargo.toml`
4. Ensure it has ZERO dependency on `tauri` or any FFI/system crate
5. Match existing `#![warn(...)]` attributes from sibling crates

## What NOT To Do
- Do NOT bypass Clippy warnings with `#[allow(...)]` without documented justification in code comments.
- Do NOT write integration tests requiring Tauri runtime for logic testable as pure Rust.
- Do NOT generate placeholder `todo!()`, `unimplemented!()`, or `dbg!()` in production code paths.
- Do NOT assume AI-generated code is correct. Every suggestion must be verified against these guidelines.
- Do NOT modify `supply-chain/` files directly if cargo-vet is in use.
