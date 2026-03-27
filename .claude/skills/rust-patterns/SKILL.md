---
name: rust-patterns
description: Idiomatic Rust patterns, ownership/borrowing best practices, error handling, concurrency, and trait-based design for building safe, performant, and maintainable Rust applications.
origin: ECC
---

# Rust Development Patterns

Idiomatic Rust patterns and best practices for building safe, performant, and maintainable applications. Rust's philosophy centers on **zero-cost abstractions**, **memory safety without garbage collection**, and **fearless concurrency**.

## When to Activate

- Writing new Rust code
- Reviewing Rust code
- Refactoring existing Rust code
- Designing Rust crates/modules

## Core Principles

### 1. Ownership and Borrowing — The Foundation

Rust's ownership system is not a limitation but a design tool. Embrace it to encode resource lifetimes and data flow at compile time.

```rust
// Good: Clear ownership transfer
fn process_data(data: Vec<u8>) -> Result<Report, ProcessError> {
    let parsed = parse(&data)?;
    Ok(Report::from(parsed))
}

// Good: Borrowing when you don't need ownership
fn summarize(data: &[u8]) -> Summary {
    Summary {
        length: data.len(),
        checksum: crc32(data),
    }
}

// Bad: Unnecessary cloning to avoid borrow checker
fn process_data(data: &Vec<u8>) -> Result<Report, ProcessError> {
    let owned = data.clone(); // Unnecessary clone
    let parsed = parse(&owned)?;
    Ok(Report::from(parsed))
}
```

### 2. Make Invalid States Unrepresentable

Use Rust's type system to enforce invariants at compile time. If a state shouldn't exist, make it impossible to construct.

```rust
// Good: Type-state pattern — connection phases enforced at compile time
struct Disconnected;
struct Connected;
struct Authenticated;

struct Client<State> {
    addr: String,
    _state: std::marker::PhantomData<State>,
}

impl Client<Disconnected> {
    fn connect(self) -> Result<Client<Connected>, IoError> {
        // ...establish connection...
        Ok(Client { addr: self.addr, _state: std::marker::PhantomData })
    }
}

impl Client<Connected> {
    fn authenticate(self, token: &str) -> Result<Client<Authenticated>, AuthError> {
        // ...authenticate...
        Ok(Client { addr: self.addr, _state: std::marker::PhantomData })
    }
}

impl Client<Authenticated> {
    fn query(&self, sql: &str) -> Result<Rows, QueryError> {
        // Only authenticated clients can query
        todo!()
    }
}
```

```rust
// Good: Enums to eliminate impossible states
enum ConnectionState {
    Disconnected,
    Connected { stream: TcpStream },
    Authenticated { stream: TcpStream, session: Session },
}

// Bad: Boolean flags that allow invalid combinations
struct Connection {
    stream: Option<TcpStream>,
    is_connected: bool,    // could be true with stream = None
    is_authenticated: bool, // could be true when not connected
}
```

### 3. Parse, Don't Validate

Transform unstructured data into well-typed structures as early as possible. Once parsed, the type system guarantees validity.

```rust
// Good: Parse into a validated type
struct EmailAddress(String);

impl EmailAddress {
    fn parse(input: &str) -> Result<Self, ValidationError> {
        if input.contains('@') && input.len() > 3 {
            Ok(EmailAddress(input.to_lowercase()))
        } else {
            Err(ValidationError::InvalidEmail(input.to_string()))
        }
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}

// Now functions accept EmailAddress, not String — validity is guaranteed
fn send_email(to: &EmailAddress, body: &str) -> Result<(), SendError> {
    // No need to re-validate `to`
    todo!()
}

// Bad: Passing raw strings and re-validating everywhere
fn send_email(to: &str, body: &str) -> Result<(), SendError> {
    if !to.contains('@') {
        return Err(SendError::InvalidEmail);
    }
    // ...
    todo!()
}
```

## Error Handling Patterns

### The `?` Operator and Error Propagation

```rust
use std::fs;
use std::io;

// Good: Concise error propagation with context
fn load_config(path: &str) -> Result<Config, AppError> {
    let content = fs::read_to_string(path)
        .map_err(|e| AppError::ConfigRead { path: path.to_string(), source: e })?;

    let config: Config = toml::from_str(&content)
        .map_err(|e| AppError::ConfigParse { path: path.to_string(), source: e })?;

    config.validate()?;
    Ok(config)
}
```

### Custom Error Types with `thiserror`

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum AppError {
    #[error("failed to read config from {path}")]
    ConfigRead {
        path: String,
        #[source]
        source: io::Error,
    },

    #[error("failed to parse config from {path}")]
    ConfigParse {
        path: String,
        #[source]
        source: toml::de::Error,
    },

    #[error("validation error: {0}")]
    Validation(#[from] ValidationError),

    #[error("database error")]
    Database(#[from] sqlx::Error),
}
```

### Error Handling with `anyhow` for Applications

```rust
use anyhow::{Context, Result};

// Good for application code — rich error context without custom types
fn setup() -> Result<()> {
    let config = load_config("app.toml")
        .context("failed to load application config")?;

    let db = connect_db(&config.database_url)
        .with_context(|| format!("failed to connect to database at {}", config.database_url))?;

    Ok(())
}
```

### When to Use Which

| Crate | Use Case |
|-------|----------|
| `thiserror` | Library crates — structured, typed errors for consumers |
| `anyhow` | Application binaries — rich context, easy propagation |
| `std::io::Error` | I/O-only contexts where custom types are overkill |

### Never Panic in Library Code

```rust
// Bad: Panicking in library code
pub fn get_user(id: usize) -> User {
    USERS.lock().unwrap()[id] // panics on poisoned lock or out-of-bounds
}

// Good: Return Result
pub fn get_user(id: usize) -> Result<User, UserError> {
    let users = USERS.lock().map_err(|_| UserError::LockPoisoned)?;
    users.get(id).cloned().ok_or(UserError::NotFound(id))
}
```

## Ownership and Lifetime Patterns

### Borrowing Rules of Thumb

```rust
// Take &self unless you need mutation
fn name(&self) -> &str { &self.name }

// Take &mut self only when mutating
fn set_name(&mut self, name: String) { self.name = name; }

// Take ownership (self) when consuming or transforming
fn into_inner(self) -> Inner { self.inner }

// Accept &str instead of &String — more flexible
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

// Accept &[T] instead of &Vec<T>
fn sum(values: &[i32]) -> i32 {
    values.iter().sum()
}

// Accept impl AsRef<Path> for maximum flexibility
fn read_file(path: impl AsRef<std::path::Path>) -> io::Result<String> {
    std::fs::read_to_string(path)
}
```

### Cow — Clone on Write

```rust
use std::borrow::Cow;

// Avoid unnecessary allocations — borrow when possible, clone when needed
fn normalize_name(name: &str) -> Cow<'_, str> {
    if name.contains(' ') {
        Cow::Owned(name.trim().to_lowercase())
    } else {
        Cow::Borrowed(name)
    }
}
```

### Lifetime Elision and When to Annotate

```rust
// Elision handles most cases — don't annotate when the compiler can infer
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// Annotate when the relationship between lifetimes matters
struct Parser<'input> {
    source: &'input str,
    position: usize,
}

impl<'input> Parser<'input> {
    fn next_token(&mut self) -> Option<&'input str> {
        // Returns a slice of the original input — lifetime makes this clear
        todo!()
    }
}
```

## Trait Design

### Small, Composable Traits

```rust
// Good: Single-responsibility traits
trait Validate {
    fn validate(&self) -> Result<(), ValidationError>;
}

trait Serialize {
    fn serialize(&self) -> Vec<u8>;
}

trait Deserialize: Sized {
    fn deserialize(data: &[u8]) -> Result<Self, DeserializeError>;
}

// Compose via trait bounds
fn store<T: Validate + Serialize>(item: &T) -> Result<(), StoreError> {
    item.validate()?;
    let bytes = item.serialize();
    storage::write(&bytes)?;
    Ok(())
}
```

### Extension Traits

```rust
// Extend existing types without modifying them
trait IteratorExt: Iterator {
    fn try_collect_vec(self) -> Result<Vec<Self::Item>, Self::Item>
    where
        Self: Sized,
        Self::Item: std::fmt::Debug,
    {
        self.collect::<Vec<_>>().pipe(Ok)
    }
}

impl<I: Iterator> IteratorExt for I {}
```

### Newtype Pattern for Type Safety

```rust
// Prevent mixing up arguments of the same underlying type
struct UserId(u64);
struct OrderId(u64);

fn get_order(user_id: UserId, order_id: OrderId) -> Result<Order, AppError> {
    // Impossible to accidentally swap user_id and order_id
    todo!()
}

// Implement Deref for transparent access when appropriate
impl std::ops::Deref for UserId {
    type Target = u64;
    fn deref(&self) -> &u64 { &self.0 }
}
```

### Sealed Traits for Controlled Extensibility

```rust
mod private {
    pub trait Sealed {}
}

pub trait MyTrait: private::Sealed {
    fn method(&self);
}

// Only types in this crate can implement MyTrait
impl private::Sealed for MyType {}
impl MyTrait for MyType {
    fn method(&self) { /* ... */ }
}
```

## Concurrency Patterns

### Fearless Concurrency with Channels

```rust
use std::sync::mpsc;
use std::thread;

fn parallel_process(items: Vec<Item>) -> Vec<Result<Output, ProcessError>> {
    let (tx, rx) = mpsc::channel();

    let handles: Vec<_> = items
        .into_iter()
        .map(|item| {
            let tx = tx.clone();
            thread::spawn(move || {
                let result = process(item);
                tx.send(result).expect("receiver dropped");
            })
        })
        .collect();

    drop(tx); // Close sender so rx iterator terminates

    let results: Vec<_> = rx.into_iter().collect();

    for handle in handles {
        handle.join().expect("thread panicked");
    }

    results
}
```

### Async/Await with Tokio

```rust
use tokio::sync::Semaphore;
use std::sync::Arc;

async fn fetch_all(urls: Vec<String>, max_concurrent: usize) -> Vec<Result<Response, Error>> {
    let semaphore = Arc::new(Semaphore::new(max_concurrent));

    let tasks: Vec<_> = urls
        .into_iter()
        .map(|url| {
            let sem = semaphore.clone();
            tokio::spawn(async move {
                let _permit = sem.acquire().await.expect("semaphore closed");
                reqwest::get(&url).await
            })
        })
        .collect();

    let mut results = Vec::with_capacity(tasks.len());
    for task in tasks {
        results.push(task.await.expect("task panicked"));
    }
    results
}
```

### Shared State with `Arc<Mutex<T>>`

```rust
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct SharedCache {
    inner: Arc<Mutex<HashMap<String, CacheEntry>>>,
}

impl SharedCache {
    fn new() -> Self {
        Self { inner: Arc::new(Mutex::new(HashMap::new())) }
    }

    fn get(&self, key: &str) -> Option<CacheEntry> {
        let cache = self.inner.lock().expect("cache lock poisoned");
        cache.get(key).cloned()
    }

    fn insert(&self, key: String, value: CacheEntry) {
        let mut cache = self.inner.lock().expect("cache lock poisoned");
        cache.insert(key, value);
    }
}
```

### Prefer `RwLock` for Read-Heavy Workloads

```rust
use std::sync::{Arc, RwLock};

struct Config {
    inner: Arc<RwLock<ConfigData>>,
}

impl Config {
    fn get(&self, key: &str) -> Option<String> {
        let data = self.inner.read().expect("rwlock poisoned");
        data.values.get(key).cloned()
    }

    fn update(&self, key: String, value: String) {
        let mut data = self.inner.write().expect("rwlock poisoned");
        data.values.insert(key, value);
    }
}
```

## Iterator Patterns

### Chaining and Lazy Evaluation

```rust
// Good: Lazy, composable, zero-allocation pipeline
fn active_user_emails(users: &[User]) -> Vec<&str> {
    users
        .iter()
        .filter(|u| u.is_active)
        .filter(|u| u.email_verified)
        .map(|u| u.email.as_str())
        .collect()
}

// Good: Early termination with find/any/all
fn has_admin(users: &[User]) -> bool {
    users.iter().any(|u| u.role == Role::Admin)
}
```

### Custom Iterators

```rust
struct Fibonacci {
    a: u64,
    b: u64,
}

impl Fibonacci {
    fn new() -> Self {
        Self { a: 0, b: 1 }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<Self::Item> {
        let result = self.a;
        (self.a, self.b) = (self.b, self.a.checked_add(self.b)?);
        Some(result)
    }
}

// Usage
let first_20: Vec<u64> = Fibonacci::new().take(20).collect();
```

## Builder Pattern

```rust
#[derive(Debug)]
struct ServerConfig {
    addr: String,
    port: u16,
    max_connections: usize,
    timeout: std::time::Duration,
}

#[derive(Default)]
struct ServerConfigBuilder {
    addr: Option<String>,
    port: Option<u16>,
    max_connections: Option<usize>,
    timeout: Option<std::time::Duration>,
}

impl ServerConfigBuilder {
    fn new() -> Self {
        Self::default()
    }

    fn addr(mut self, addr: impl Into<String>) -> Self {
        self.addr = Some(addr.into());
        self
    }

    fn port(mut self, port: u16) -> Self {
        self.port = Some(port);
        self
    }

    fn max_connections(mut self, max: usize) -> Self {
        self.max_connections = Some(max);
        self
    }

    fn timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    fn build(self) -> Result<ServerConfig, ConfigError> {
        Ok(ServerConfig {
            addr: self.addr.unwrap_or_else(|| "127.0.0.1".to_string()),
            port: self.port.unwrap_or(8080),
            max_connections: self.max_connections.unwrap_or(100),
            timeout: self.timeout.unwrap_or(std::time::Duration::from_secs(30)),
        })
    }
}

// Usage
let config = ServerConfigBuilder::new()
    .addr("0.0.0.0")
    .port(3000)
    .max_connections(500)
    .build()?;
```

## Module and Crate Organization

### Standard Project Layout

```text
my-project/
├── Cargo.toml
├── Cargo.lock
├── src/
│   ├── lib.rs            # Library root (public API)
│   ├── main.rs           # Binary entry point
│   ├── config.rs          # Configuration module
│   ├── error.rs           # Error types
│   ├── models/
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   └── order.rs
│   ├── handlers/
│   │   ├── mod.rs
│   │   └── api.rs
│   └── db/
│       ├── mod.rs
│       └── postgres.rs
├── tests/                 # Integration tests
│   └── api_test.rs
├── benches/               # Benchmarks
│   └── parser_bench.rs
└── examples/
    └── basic.rs
```

### Module Visibility

```rust
// src/lib.rs — control your public API surface
pub mod models;      // Public module
pub mod handlers;    // Public module
mod db;              // Private module — implementation detail
pub(crate) mod util; // Visible within the crate only

// Re-export important types at the crate root
pub use models::User;
pub use error::AppError;
```

## Memory and Performance

### Avoid Unnecessary Allocations

```rust
// Bad: Allocating when borrowing suffices
fn get_name(user: &User) -> String {
    user.name.clone() // Unnecessary clone
}

// Good: Return a reference
fn get_name(user: &User) -> &str {
    &user.name
}

// Good: Preallocate collections
fn collect_names(users: &[User]) -> Vec<&str> {
    let mut names = Vec::with_capacity(users.len());
    for user in users {
        names.push(user.name.as_str());
    }
    names
}
```

### Use `Box<dyn Trait>` vs Generics Wisely

```rust
// Generics: zero-cost, monomorphized — use for hot paths
fn process<T: Processor>(item: &T) -> Output {
    item.process()
}

// Trait objects: dynamic dispatch — use when you need heterogeneous collections
fn process_all(processors: &[Box<dyn Processor>]) -> Vec<Output> {
    processors.iter().map(|p| p.process()).collect()
}
```

### String Optimization

```rust
// Avoid repeated allocation with String::with_capacity
fn join_names(names: &[&str]) -> String {
    let total_len: usize = names.iter().map(|n| n.len()).sum::<usize>() + names.len();
    let mut result = String::with_capacity(total_len);
    for (i, name) in names.iter().enumerate() {
        if i > 0 {
            result.push_str(", ");
        }
        result.push_str(name);
    }
    result
}

// Or simply:
fn join_names(names: &[&str]) -> String {
    names.join(", ")
}
```

## Tooling Integration

### Essential Commands

```bash
# Build
cargo build
cargo build --release

# Run
cargo run
cargo run --release

# Testing
cargo test
cargo test -- --nocapture         # Show stdout
cargo test -- --test-threads=1    # Sequential execution

# Linting
cargo clippy -- -D warnings

# Formatting
cargo fmt
cargo fmt -- --check              # CI mode

# Documentation
cargo doc --open
cargo doc --no-deps

# Dependency audit
cargo audit
cargo deny check

# Benchmarks
cargo bench

# Code coverage (with cargo-tarpaulin)
cargo tarpaulin --out Html
```

### Clippy Configuration (clippy.toml)

```toml
# clippy.toml
cognitive-complexity-threshold = 25
too-many-arguments-threshold = 7
type-complexity-threshold = 250
```

### Recommended Cargo.toml Lints

```toml
[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
enum_glob_use = "deny"
pedantic = { level = "warn", priority = -1 }
nursery = { level = "warn", priority = -1 }
unwrap_used = "deny"
expect_used = "warn"
```

## Quick Reference: Rust Idioms

| Idiom | Description |
|-------|-------------|
| Ownership transfer | Move semantics by default; clone only when necessary |
| Borrow, don't copy | Use `&T` and `&mut T` instead of cloning |
| Parse, don't validate | Convert unstructured data to typed structs at boundaries |
| Make invalid states unrepresentable | Use enums and type-state to enforce invariants |
| Newtype pattern | Wrap primitives for type safety (`UserId(u64)`) |
| Builder pattern | For structs with many optional fields |
| `?` operator | Propagate errors concisely |
| Iterator chains | Lazy, composable data transformations |
| `Cow<'_, str>` | Avoid allocation when borrowing might suffice |
| `impl Trait` | Simplify generic signatures in argument and return position |

## Anti-Patterns to Avoid

```rust
// Bad: Using .unwrap() in production code
let value = map.get("key").unwrap(); // Panics if missing

// Good: Handle the None case
let value = map.get("key").ok_or(AppError::MissingKey("key"))?;

// Bad: Excessive use of Rc<RefCell<T>> — fighting the borrow checker
let data = Rc::new(RefCell::new(vec![1, 2, 3]));

// Good: Restructure to work with ownership
fn process(data: &mut Vec<i32>) { /* ... */ }

// Bad: Using String when &str suffices
fn greet(name: String) -> String { // Forces caller to allocate
    format!("Hello, {name}!")
}

// Good: Accept a borrow
fn greet(name: &str) -> String {
    format!("Hello, {name}!")
}

// Bad: Ignoring must_use warnings
let _ = File::create("output.txt"); // Silently ignores errors

// Good: Handle the result
File::create("output.txt")?;

// Bad: Using unsafe without justification or safety comment
unsafe { ptr::read(addr) }

// Good: Document safety invariants
// SAFETY: `addr` is guaranteed to be aligned and point to a valid T
// because it was obtained from Box::into_raw above.
unsafe { ptr::read(addr) }
```

**Remember**: Rust's strictness is a feature, not a burden. If the compiler rejects your code, it's often pointing you toward a better design. Listen to the borrow checker — it's your most reliable code reviewer.
