# SECURITY.md - AI Agent Security Policy

> ⚠️ **MANDATORY:** All AI-generated code MUST comply with this policy. Violations are treated as critical bugs.

## 1. Memory Safety & Unsafe Code

- **Default to safe Rust.** `unsafe` is forbidden unless absolutely necessary for FFI or performance-critical paths.
- Every `unsafe` block MUST have an inline `// SAFETY:` comment explaining:
  - What invariant is being upheld
  - Why safe Rust cannot express this
  - How the caller/callee guarantees validity
- NEVER use `unsafe` to silence compiler errors. Refactor instead.
- Prefer abstractions like `Arc<Mutex<T>>`, channels, or typed wrappers over raw pointers.

## 2. Error Handling & Panics

- `.unwrap()`, `.expect()`, `panic!()` are **FORBIDDEN** in production code paths.
- Allowed ONLY in:
  - Unit/integration tests
  - Build scripts (`build.rs`)
  - Explicitly documented startup assertions that SHOULD crash if violated
- All public APIs MUST return `Result<T, E>` or `Option<T>`.
- Error types MUST implement `std::error::Error` and provide meaningful context.

## 3. Input Validation & Sanitization

- NEVER trust data from IPC (Tauri commands), HTTP, files, or environment variables.
- Validate ALL external inputs at the boundary BEFORE processing.
- Use strong typing (newtypes, enums) over primitives for domain values.
- For medical/financial calculations: validate ranges, units, and precision explicitly.
- String inputs MUST be validated for length, encoding, and injection patterns.

## 4. Cryptography & Secrets

- NEVER implement custom cryptographic algorithms.
- NEVER hardcode secrets, API keys, tokens, or passwords in source code.
- Use vetted crates only: `rustls`, `argon2`, `chacha20poly1305`.
- Secrets MUST be loaded from secure storage (OS keychain, env vars at runtime).
- Sensitive data MUST be zeroized after use (`zeroize` crate).

## 5. Dependency Security

- Before adding ANY new dependency:
  - Verify it exists on crates.io with legitimate publisher
  - Check maintenance status, download count, and known CVEs
  - Prefer crates already audited in `supply-chain/` if cargo-vet is configured
- NEVER use yanked, deprecated, or unmaintained crates.
- Pin exact versions for security-critical dependencies.
- Report suspicious crate recommendations immediately.

## 6. Tauri-Specific Security

- Enable Tauri's CSP (Content Security Policy) in `tauri.conf.json`.
- Disable `devtools` in production builds.
- Use allowlists for shell, filesystem, and network access — never enable global permissions.
- Validate and sanitize ALL IPC command parameters server-side (in Rust), not just client-side.
- Never expose internal file paths, system info, or debug endpoints via IPC.
- Use Tauri's built-in secure storage over localStorage for sensitive data.

## 7. Logging & Data Exposure

- NEVER log PII, credentials, tokens, medical records, or financial data.
- Log messages MUST NOT contain user-supplied strings without sanitization.
- Use structured logging with explicit field selection over format strings.
- Production builds MUST NOT include debug-level logging by default.

## 8. AI-Specific Precautions

- Treat ALL AI-generated code as UNTRUSTED until manually reviewed.
- AI frequently hallucinates non-existent APIs — verify every function signature against official docs.
- AI often suggests outdated or vulnerable crate versions — always cross-check.
- When AI generates `unsafe` code, assume it is INCORRECT until proven otherwise.
- Request test cases BEFORE implementation for security-critical logic.

## Verification Checklist

Before considering any AI-generated code complete:

- [ ] Passes `clippy::pedantic` + `clippy::nursery` with zero warnings
- [ ] No `unwrap`/`expect`/`panic` in non-test code
- [ ] All external inputs validated at boundary
- [ ] No hardcoded secrets or PII in logs
- [ ] `unsafe` blocks have complete SAFETY comments (if any)
- [ ] New dependencies verified and audited
- [ ] Unit tests cover edge cases and invalid inputs
