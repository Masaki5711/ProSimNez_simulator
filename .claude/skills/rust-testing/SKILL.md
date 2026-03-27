---
name: rust-testing
description: Rust testing patterns including unit tests, integration tests, property-based testing, benchmarks, and test coverage. Follows TDD methodology with idiomatic Rust practices.
origin: ECC
---

# Rust Testing Patterns

Comprehensive Rust testing patterns for writing reliable, maintainable tests following TDD methodology.

## When to Activate

- Writing new Rust functions, methods, or modules
- Adding test coverage to existing Rust code
- Creating benchmarks for performance-critical code
- Implementing property-based tests for input validation
- Following TDD workflow in Rust projects

## TDD Workflow for Rust

### The RED-GREEN-REFACTOR Cycle

```
RED     → Write a failing test first
GREEN   → Write minimal code to pass the test
REFACTOR → Improve code while keeping tests green
REPEAT  → Continue with next requirement
```

### Step-by-Step TDD in Rust

```rust
// Step 1: Write the failing test (RED)
// src/calculator.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }
}

// Step 2: Run test — verify FAIL
// $ cargo test
// error[E0425]: cannot find function `add`

// Step 3: Implement minimal code (GREEN)
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

// Step 4: Run test — verify PASS
// $ cargo test
// test calculator::tests::test_add ... ok

// Step 5: Refactor if needed, verify tests still pass
```

## Unit Tests

Unit tests live alongside the code they test, in a `#[cfg(test)]` module.

### Basic Unit Tests

```rust
// src/lib.rs
pub fn clamp(value: i32, min: i32, max: i32) -> i32 {
    value.max(min).min(max)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_within_range() {
        assert_eq!(clamp(5, 0, 10), 5);
    }

    #[test]
    fn clamp_below_min() {
        assert_eq!(clamp(-5, 0, 10), 0);
    }

    #[test]
    fn clamp_above_max() {
        assert_eq!(clamp(15, 0, 10), 10);
    }

    #[test]
    fn clamp_at_boundaries() {
        assert_eq!(clamp(0, 0, 10), 0);
        assert_eq!(clamp(10, 0, 10), 10);
    }
}
```

### Testing Error Cases

```rust
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ParseError {
    #[error("empty input")]
    EmptyInput,
    #[error("invalid format: {0}")]
    InvalidFormat(String),
}

pub fn parse_port(input: &str) -> Result<u16, ParseError> {
    if input.is_empty() {
        return Err(ParseError::EmptyInput);
    }
    input.parse::<u16>()
        .map_err(|_| ParseError::InvalidFormat(input.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_valid_port() {
        assert_eq!(parse_port("8080"), Ok(8080));
    }

    #[test]
    fn parse_empty_input() {
        assert_eq!(parse_port(""), Err(ParseError::EmptyInput));
    }

    #[test]
    fn parse_invalid_format() {
        assert!(matches!(
            parse_port("not-a-number"),
            Err(ParseError::InvalidFormat(_))
        ));
    }

    #[test]
    fn parse_out_of_range() {
        assert!(parse_port("99999").is_err());
    }

    #[test]
    #[should_panic(expected = "overflow")]
    fn test_panic_case() {
        function_that_should_panic();
    }
}
```

### Parameterized Tests with Macros

```rust
// Rust doesn't have built-in table-driven tests, but macros provide the same power
macro_rules! test_cases {
    ($($name:ident: ($input:expr, $expected:expr),)*) => {
        $(
            #[test]
            fn $name() {
                assert_eq!(parse_port($input), $expected);
            }
        )*
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    test_cases! {
        port_80: ("80", Ok(80)),
        port_443: ("443", Ok(443)),
        port_8080: ("8080", Ok(8080)),
        port_max: ("65535", Ok(65535)),
        port_zero: ("0", Ok(0)),
        empty_string: ("", Err(ParseError::EmptyInput)),
    }
}
```

### Using `test-case` Crate for Parameterized Tests

```rust
// Cargo.toml: test-case = "3"

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(2, 3 => 5 ; "positive numbers")]
    #[test_case(-1, 1 => 0 ; "mixed signs")]
    #[test_case(0, 0 => 0 ; "zeros")]
    #[test_case(i32::MAX, 0 => i32::MAX ; "max value")]
    fn test_add(a: i32, b: i32) -> i32 {
        add(a, b)
    }

    #[test_case("" => matches Err(ParseError::EmptyInput) ; "empty input")]
    #[test_case("abc" => matches Err(ParseError::InvalidFormat(_)) ; "non-numeric")]
    #[test_case("8080" => Ok(8080) ; "valid port")]
    fn test_parse_port(input: &str) -> Result<u16, ParseError> {
        parse_port(input)
    }
}
```

## Integration Tests

Integration tests live in the `tests/` directory and test the public API.

```rust
// tests/api_test.rs
use my_crate::{Config, Server};

#[tokio::test]
async fn server_starts_and_responds() {
    let config = Config::default();
    let server = Server::start(config).await.expect("server failed to start");

    let resp = reqwest::get(&format!("http://{}/health", server.addr()))
        .await
        .expect("request failed");

    assert_eq!(resp.status(), 200);
    assert_eq!(resp.text().await.unwrap(), "OK");

    server.shutdown().await;
}

#[tokio::test]
async fn create_and_retrieve_user() {
    let app = TestApp::spawn().await;

    let create_resp = app
        .post("/users")
        .json(&serde_json::json!({"name": "Alice", "email": "alice@test.com"}))
        .send()
        .await
        .unwrap();
    assert_eq!(create_resp.status(), 201);

    let user: User = create_resp.json().await.unwrap();
    assert_eq!(user.name, "Alice");

    let get_resp = app.get(&format!("/users/{}", user.id)).send().await.unwrap();
    assert_eq!(get_resp.status(), 200);
}
```

### Test Helpers and Fixtures

```rust
// tests/common/mod.rs — Shared test utilities
use my_crate::{Config, Server};

pub struct TestApp {
    pub addr: String,
    pub client: reqwest::Client,
    server: Server,
}

impl TestApp {
    pub async fn spawn() -> Self {
        let config = Config {
            addr: "127.0.0.1:0".to_string(), // OS assigns a free port
            ..Config::default()
        };

        let server = Server::start(config).await.expect("failed to start server");
        let addr = format!("http://{}", server.addr());

        Self {
            addr,
            client: reqwest::Client::new(),
            server,
        }
    }

    pub fn get(&self, path: &str) -> reqwest::RequestBuilder {
        self.client.get(format!("{}{}", self.addr, path))
    }

    pub fn post(&self, path: &str) -> reqwest::RequestBuilder {
        self.client.post(format!("{}{}", self.addr, path))
    }
}

impl Drop for TestApp {
    fn drop(&mut self) {
        // Cleanup happens automatically
    }
}
```

## Mocking with Traits

### Trait-Based Dependency Injection

```rust
// Define the trait
pub trait UserRepository: Send + Sync {
    fn find_by_id(&self, id: u64) -> Result<Option<User>, DbError>;
    fn save(&self, user: &User) -> Result<(), DbError>;
}

// Production implementation
pub struct PostgresUserRepo {
    pool: PgPool,
}

impl UserRepository for PostgresUserRepo {
    fn find_by_id(&self, id: u64) -> Result<Option<User>, DbError> {
        // Real database query
        todo!()
    }

    fn save(&self, user: &User) -> Result<(), DbError> {
        todo!()
    }
}

// Service accepts any implementation
pub struct UserService<R: UserRepository> {
    repo: R,
}

impl<R: UserRepository> UserService<R> {
    pub fn new(repo: R) -> Self {
        Self { repo }
    }

    pub fn get_profile(&self, id: u64) -> Result<Profile, AppError> {
        let user = self.repo.find_by_id(id)?
            .ok_or(AppError::NotFound)?;
        Ok(Profile::from(user))
    }
}

// Test mock
#[cfg(test)]
mod tests {
    use super::*;

    struct MockUserRepo {
        users: Vec<User>,
    }

    impl UserRepository for MockUserRepo {
        fn find_by_id(&self, id: u64) -> Result<Option<User>, DbError> {
            Ok(self.users.iter().find(|u| u.id == id).cloned())
        }

        fn save(&self, _user: &User) -> Result<(), DbError> {
            Ok(())
        }
    }

    #[test]
    fn get_profile_returns_existing_user() {
        let repo = MockUserRepo {
            users: vec![User { id: 1, name: "Alice".into() }],
        };
        let service = UserService::new(repo);

        let profile = service.get_profile(1).unwrap();
        assert_eq!(profile.name, "Alice");
    }

    #[test]
    fn get_profile_returns_not_found() {
        let repo = MockUserRepo { users: vec![] };
        let service = UserService::new(repo);

        let result = service.get_profile(999);
        assert!(matches!(result, Err(AppError::NotFound)));
    }
}
```

### Using `mockall` for Complex Mocking

```rust
// Cargo.toml: mockall = "0.13"

use mockall::automock;

#[automock]
pub trait EmailService: Send + Sync {
    fn send(&self, to: &str, subject: &str, body: &str) -> Result<(), EmailError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockall::predicate::*;

    #[test]
    fn sends_welcome_email_on_registration() {
        let mut mock = MockEmailService::new();
        mock.expect_send()
            .with(eq("alice@test.com"), eq("Welcome!"), always())
            .times(1)
            .returning(|_, _, _| Ok(()));

        let service = RegistrationService::new(mock);
        service.register("Alice", "alice@test.com").unwrap();
    }
}
```

## Property-Based Testing with `proptest`

```rust
// Cargo.toml: proptest = "1"

use proptest::prelude::*;

proptest! {
    #[test]
    fn add_is_commutative(a in any::<i32>(), b in any::<i32>()) {
        // Wrapping add to avoid overflow panics
        prop_assert_eq!(a.wrapping_add(b), b.wrapping_add(a));
    }

    #[test]
    fn parse_roundtrip(s in "[a-zA-Z0-9_]{1,64}") {
        let parsed = Identifier::parse(&s).unwrap();
        prop_assert_eq!(parsed.as_str(), s);
    }

    #[test]
    fn sort_preserves_length(mut vec in prop::collection::vec(any::<i32>(), 0..100)) {
        let original_len = vec.len();
        vec.sort();
        prop_assert_eq!(vec.len(), original_len);
    }

    #[test]
    fn sort_is_idempotent(mut vec in prop::collection::vec(any::<i32>(), 0..100)) {
        vec.sort();
        let sorted_once = vec.clone();
        vec.sort();
        prop_assert_eq!(vec, sorted_once);
    }
}
```

### Custom Strategies

```rust
use proptest::prelude::*;

fn valid_email() -> impl Strategy<Value = String> {
    (
        "[a-z]{1,10}",
        prop::sample::select(vec!["gmail.com", "test.org", "example.com"]),
    )
        .prop_map(|(user, domain)| format!("{user}@{domain}"))
}

proptest! {
    #[test]
    fn email_parsing_accepts_valid_emails(email in valid_email()) {
        let result = EmailAddress::parse(&email);
        prop_assert!(result.is_ok(), "Failed to parse: {}", email);
    }
}
```

## Benchmarks

### Using `criterion`

```rust
// Cargo.toml:
// [dev-dependencies]
// criterion = { version = "0.5", features = ["html_reports"] }
//
// [[bench]]
// name = "parser_bench"
// harness = false

// benches/parser_bench.rs
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use my_crate::parser;

fn bench_parse(c: &mut Criterion) {
    let input = include_str!("../testdata/sample.json");

    c.bench_function("parse_json", |b| {
        b.iter(|| parser::parse(black_box(input)))
    });
}

fn bench_parse_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse_by_size");

    for size in [100, 1_000, 10_000, 100_000] {
        let input = generate_input(size);
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &input,
            |b, input| {
                b.iter(|| parser::parse(black_box(input)));
            },
        );
    }

    group.finish();
}

criterion_group!(benches, bench_parse, bench_parse_sizes);
criterion_main!(benches);
```

```bash
# Run benchmarks
cargo bench

# Run specific benchmark
cargo bench -- parse_json

# Compare against baseline
cargo bench -- --save-baseline main
# ... make changes ...
cargo bench -- --baseline main
```

## Test Coverage

### Using `cargo-tarpaulin`

```bash
# Install
cargo install cargo-tarpaulin

# Basic coverage
cargo tarpaulin

# HTML report
cargo tarpaulin --out Html

# With specific targets
cargo tarpaulin --lib --tests

# Fail if below threshold
cargo tarpaulin --fail-under 80

# Ignore specific files
cargo tarpaulin --exclude-files "src/generated/*"
```

### Using `cargo-llvm-cov`

```bash
# Install
cargo install cargo-llvm-cov

# Basic coverage
cargo llvm-cov

# HTML report
cargo llvm-cov --html --open

# With branch coverage
cargo llvm-cov --branch

# JSON output for CI
cargo llvm-cov --json --output-path coverage.json
```

### Coverage Targets

| Code Type | Target |
|-----------|--------|
| Critical business logic | 100% |
| Public API | 90%+ |
| General code | 80%+ |
| Generated code / FFI bindings | Exclude |

## Async Testing

```rust
// Cargo.toml: tokio = { version = "1", features = ["macros", "rt-multi-thread", "test-util"] }

#[tokio::test]
async fn fetches_data_successfully() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/data"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"key": "value"})))
        .mount(&server)
        .await;

    let client = ApiClient::new(&server.uri());
    let result = client.fetch_data().await.unwrap();

    assert_eq!(result.key, "value");
}

#[tokio::test]
async fn handles_timeout() {
    let server = MockServer::start().await;
    Mock::given(any())
        .respond_with(ResponseTemplate::new(200).set_body_string("ok").set_delay(
            std::time::Duration::from_secs(10),
        ))
        .mount(&server)
        .await;

    let client = ApiClient::new(&server.uri())
        .with_timeout(std::time::Duration::from_millis(100));

    let result = client.fetch_data().await;
    assert!(result.is_err());
}
```

## Testing Commands

```bash
# Run all tests
cargo test

# Run tests with output visible
cargo test -- --nocapture

# Run specific test
cargo test test_add

# Run tests matching pattern
cargo test parse_

# Run tests in specific module
cargo test parser::tests

# Run only unit tests (skip integration tests)
cargo test --lib

# Run only integration tests
cargo test --test api_test

# Run with single thread (useful for shared resources)
cargo test -- --test-threads=1

# Run ignored tests
cargo test -- --ignored

# Run all tests including ignored
cargo test -- --include-ignored

# Run benchmarks
cargo bench

# Run with address sanitizer (nightly)
RUSTFLAGS="-Z sanitizer=address" cargo +nightly test --target x86_64-unknown-linux-gnu
```

## Best Practices

**DO:**
- Write tests FIRST (TDD: RED → GREEN → REFACTOR)
- Test behavior and contracts, not implementation details
- Use `#[cfg(test)]` modules for unit tests alongside production code
- Use the `tests/` directory for integration tests
- Use `proptest` for property-based testing of pure functions
- Keep tests fast — mock slow dependencies
- Use descriptive test names (`fn rejects_negative_amounts()`)
- Test error paths as thoroughly as happy paths

**DON'T:**
- Test private functions directly — test through the public API
- Use `#[should_panic]` when `Result` testing is clearer
- Rely on test execution order
- Use `unwrap()` in tests without context — prefer `.expect("descriptive message")`
- Ignore flaky tests — fix or remove them
- Over-mock — prefer integration tests with real dependencies when feasible

## CI Integration

```yaml
# GitHub Actions example
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
      with:
        components: clippy, rustfmt

    - name: Check formatting
      run: cargo fmt -- --check

    - name: Lint
      run: cargo clippy -- -D warnings

    - name: Run tests
      run: cargo test

    - name: Coverage
      run: |
        cargo install cargo-tarpaulin
        cargo tarpaulin --fail-under 80
```

**Remember**: Tests are documentation. They demonstrate how your API is intended to be used. Write them clearly and keep them in sync with the code.
