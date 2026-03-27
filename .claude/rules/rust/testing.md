---
name: rust-testing
description: Rust testing rules enforcing TDD, coverage targets, and testing best practices.
origin: ECC
---

# Rust Testing Rules

## TDD Workflow
- Follow RED → GREEN → REFACTOR for all new functionality
- Write the failing test before writing production code
- Minimum 80% code coverage — critical business logic must be 100%

## Test Organization
- Unit tests: `#[cfg(test)] mod tests` in the same file as the code
- Integration tests: `tests/` directory, testing the public API only
- Benchmarks: `benches/` directory using `criterion`
- Test fixtures: `testdata/` or `tests/fixtures/`

## Test Patterns
- Use parameterized tests (`test-case` crate or macros) for comprehensive case coverage
- Use `proptest` for property-based testing of pure functions
- Use trait-based mocking — define traits for dependencies, inject mocks in tests
- Use `mockall` only when manual mocks become unwieldy

## Assertions
- Use `assert_eq!` / `assert_ne!` over raw `assert!` for better failure messages
- Use `matches!()` macro for enum variant assertions
- Add descriptive messages: `assert_eq!(got, expected, "failed for input: {input}")`

## Async Tests
- Use `#[tokio::test]` for async tests
- Use `wiremock` for HTTP mocking
- Always test timeout and error paths

## CI Requirements
- `cargo fmt -- --check`
- `cargo clippy -- -D warnings`
- `cargo test`
- `cargo tarpaulin --fail-under 80` or `cargo llvm-cov`
- `cargo audit`
