---
name: rust-security
description: Rust security rules enforcing safe coding practices, dependency auditing, and vulnerability prevention.
origin: ECC
---

# Rust Security Rules

## Unsafe Code
- `unsafe_code = "forbid"` in Cargo.toml lints by default
- Every `unsafe` block requires a `// SAFETY:` comment
- Isolate unsafe in dedicated modules with safe public wrappers
- Run `cargo geiger` to track unsafe usage across dependencies

## Input Validation
- Validate all external input at system boundaries
- Parse into strongly-typed structs — reject invalid data early
- Use checked arithmetic (`checked_mul`, `checked_add`) for untrusted numeric input
- Enforce size limits on strings, collections, and file uploads

## Secrets
- Never hardcode secrets — use environment variables or a secrets manager
- Wrap sensitive values in a `Secret<T>` type that redacts `Debug`/`Display`
- Zeroize sensitive data on drop (`zeroize` crate)
- Never log secrets — audit all `tracing`/`log` calls

## Cryptography
- Use `argon2` or `bcrypt` for password hashing — never SHA-256/MD5
- Use `ring` or `rustls` for TLS — never `openssl` bindings unless required
- Use constant-time comparison (`subtle` crate) for tokens and secrets
- Use `OsRng` for cryptographic random number generation

## SQL & Data Access
- Use parameterized queries (`sqlx::query!` with `$1`, `$2`) — never format strings
- Validate and sanitize all user-provided identifiers
- Use connection pools with timeout limits

## Web Security
- Configure CORS with explicit origins — never `*` in production
- Implement rate limiting on all public endpoints
- Set security headers (Content-Security-Policy, X-Content-Type-Options, etc.)
- Escape all user content before rendering in HTML

## Dependencies
- Run `cargo audit` in CI — deny known vulnerabilities
- Run `cargo deny check` for license compliance and duplicate detection
- Pin critical security dependencies to exact versions
- Review new dependencies before adding them
