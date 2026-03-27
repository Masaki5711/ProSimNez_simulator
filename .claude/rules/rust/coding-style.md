---
name: rust-coding-style
description: Rust coding style rules enforcing ownership-first design, type safety, error handling, and idiomatic patterns.
origin: ECC
---

# Rust Coding Style Rules

## Ownership & Borrowing
- Accept `&str` instead of `&String`, `&[T]` instead of `&Vec<T>`, `&Path` or `impl AsRef<Path>` instead of `&PathBuf`
- Take ownership (`self`) only when consuming; borrow (`&self`, `&mut self`) otherwise
- Avoid `.clone()` to silence the borrow checker — restructure ownership instead
- Use `Cow<'_, str>` when a function sometimes borrows, sometimes owns

## Error Handling
- Use `thiserror` for library error types, `anyhow` for application code
- Propagate errors with `?` — add context with `.map_err()` or `.context()`
- Never `unwrap()` or `expect()` in library code — return `Result`
- In application code, `expect("descriptive message")` is acceptable for truly impossible states

## Type Safety
- Make invalid states unrepresentable with enums and type-state patterns
- Parse, don't validate — convert raw data to typed structs at boundaries
- Use newtype pattern for domain identifiers (`struct UserId(u64)`)
- Prefer `enum` over boolean flags for clarity

## Unsafe
- `#![forbid(unsafe_code)]` by default — allow only in dedicated modules
- Every `unsafe` block must have a `// SAFETY:` comment
- Wrap unsafe operations in safe public APIs
- Prefer safe abstractions from the ecosystem over hand-written unsafe

## Naming & Organization
- Follow Rust naming conventions: `snake_case` for functions/variables, `PascalCase` for types, `SCREAMING_SNAKE_CASE` for constants
- Keep modules focused — one concept per module
- Use `pub(crate)` for internal APIs, `pub` only for the external surface
- Re-export important types at the crate root

## Code Style
- Run `cargo fmt` — no exceptions
- Run `cargo clippy -- -D warnings` — fix all warnings
- Prefer iterator chains over manual loops
- Avoid premature optimization — profile first with `criterion`
- Maximum file length: 600 lines (split into submodules beyond this)

## Dependencies
- Run `cargo audit` regularly
- Pin critical security dependencies to exact versions
- Prefer well-maintained crates with recent activity
- Minimize dependency count — a little copying is better than a little dependency

## Concurrency
- Use channels for communication between tasks
- Prefer `RwLock` over `Mutex` for read-heavy workloads
- Use `Arc` only when shared ownership is genuinely needed
- Prefer `tokio` for async I/O, `rayon` for CPU-parallel computation
