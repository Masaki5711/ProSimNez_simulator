---
name: rust-security
description: Rust security best practices including unsafe code auditing, dependency auditing, cryptography patterns, input validation, and common vulnerability prevention.
origin: ECC
---

# Rust Security Patterns

Security-focused Rust patterns for building robust, safe applications. Leverages Rust's ownership model, type system, and ecosystem tools to prevent vulnerabilities at compile time and runtime.

## When to Activate

- Writing Rust code that handles user input, network data, or sensitive information
- Reviewing Rust code for security vulnerabilities
- Auditing `unsafe` code blocks
- Configuring dependency auditing and supply chain security
- Implementing authentication, authorization, or cryptography

## Core Security Principles

Rust eliminates entire classes of vulnerabilities by default:
- **No buffer overflows** — bounds checking on array/slice access
- **No use-after-free** — ownership system prevents dangling references
- **No data races** — `Send`/`Sync` traits enforce thread safety at compile time
- **No null pointer dereference** — `Option<T>` instead of null

Your job is to maintain these guarantees and defend against the remaining attack surface.

## Unsafe Code Discipline

### Minimize and Isolate Unsafe

```rust
// Good: Unsafe isolated in a safe wrapper with documented invariants
pub struct AlignedBuffer {
    ptr: *mut u8,
    len: usize,
    cap: usize,
}

impl AlignedBuffer {
    pub fn new(size: usize, alignment: usize) -> Self {
        let layout = std::alloc::Layout::from_size_align(size, alignment)
            .expect("invalid layout");

        // SAFETY: layout is valid (checked by from_size_align above),
        // and size > 0 is guaranteed by the caller or checked here.
        let ptr = unsafe { std::alloc::alloc_zeroed(layout) };

        if ptr.is_null() {
            std::alloc::handle_alloc_error(layout);
        }

        Self { ptr, len: 0, cap: size }
    }

    // Safe public API — users never need unsafe
    pub fn as_slice(&self) -> &[u8] {
        // SAFETY: ptr is valid for self.len bytes, allocated in new()
        unsafe { std::slice::from_raw_parts(self.ptr, self.len) }
    }
}

impl Drop for AlignedBuffer {
    fn drop(&mut self) {
        // SAFETY: ptr was allocated with the same layout in new()
        unsafe {
            let layout = std::alloc::Layout::from_size_align_unchecked(self.cap, 1);
            std::alloc::dealloc(self.ptr, layout);
        }
    }
}
```

### Unsafe Audit Checklist

Every `unsafe` block must have a `// SAFETY:` comment explaining:
1. What invariant is being upheld
2. Why the invariant holds at this call site
3. What could go wrong if the invariant were violated

```rust
// SAFETY: `index` has been bounds-checked against `self.data.len()` on line N.
// The pointer arithmetic cannot overflow because index < len <= isize::MAX.
unsafe { *self.data.get_unchecked(index) }
```

### Forbid Unsafe in Most Code

```toml
# Cargo.toml — forbid unsafe except where explicitly allowed
[lints.rust]
unsafe_code = "forbid"
```

```rust
// In the rare module that needs unsafe:
#![allow(unsafe_code)]
// ... with thorough safety documentation ...
```

## Input Validation and Sanitization

### Validate at Boundaries

```rust
use std::net::IpAddr;

// Good: Parse into validated types at the boundary
pub struct ListenAddr {
    ip: IpAddr,
    port: u16,
}

impl ListenAddr {
    pub fn parse(input: &str) -> Result<Self, AddrError> {
        let addr: std::net::SocketAddr = input.parse()
            .map_err(|_| AddrError::InvalidFormat(input.to_string()))?;

        // Reject privileged ports in production
        if addr.port() < 1024 {
            return Err(AddrError::PrivilegedPort(addr.port()));
        }

        Ok(Self { ip: addr.ip(), port: addr.port() })
    }
}
```

### Prevent Integer Overflow

```rust
// Good: Use checked arithmetic for untrusted input
fn calculate_total(price: u64, quantity: u64) -> Result<u64, OverflowError> {
    price.checked_mul(quantity)
        .ok_or(OverflowError::Multiplication)
}

// Good: Use saturating arithmetic when clamping is acceptable
fn add_with_cap(current: u32, increment: u32) -> u32 {
    current.saturating_add(increment)
}
```

### Path Traversal Prevention

```rust
use std::path::{Path, PathBuf};

fn safe_resolve(base: &Path, user_input: &str) -> Result<PathBuf, SecurityError> {
    let requested = base.join(user_input);
    let canonical = requested.canonicalize()
        .map_err(|_| SecurityError::InvalidPath)?;

    // Ensure the resolved path is still under the base directory
    if !canonical.starts_with(base.canonicalize().map_err(|_| SecurityError::InvalidPath)?) {
        return Err(SecurityError::PathTraversal);
    }

    Ok(canonical)
}
```

### SQL Injection Prevention

```rust
// Good: Parameterized queries with sqlx
async fn get_user(pool: &PgPool, user_id: i64) -> Result<User, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT id, name, email FROM users WHERE id = $1",
        user_id
    )
    .fetch_one(pool)
    .await
}

// Bad: String interpolation in queries — NEVER do this
async fn get_user_bad(pool: &PgPool, user_id: &str) -> Result<User, sqlx::Error> {
    let query = format!("SELECT * FROM users WHERE id = {}", user_id); // SQL INJECTION
    sqlx::query_as::<_, User>(&query).fetch_one(pool).await
}
```

## Cryptography

### Password Hashing with Argon2

```rust
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;

fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(Argon2::default().verify_password(password.as_bytes(), &parsed_hash).is_ok())
}
```

### Constant-Time Comparison

```rust
use subtle::ConstantTimeEq;

fn verify_token(provided: &[u8], expected: &[u8]) -> bool {
    // Prevents timing attacks
    provided.ct_eq(expected).into()
}

// Bad: Variable-time comparison leaks information
fn verify_token_bad(provided: &[u8], expected: &[u8]) -> bool {
    provided == expected // Timing side channel!
}
```

### Secure Random Generation

```rust
use rand::rngs::OsRng;
use rand::RngCore;

fn generate_token() -> [u8; 32] {
    let mut token = [u8; 32];
    OsRng.fill_bytes(&mut token);
    token
}

// Bad: Using thread_rng for security-sensitive tokens
fn generate_token_bad() -> [u8; 32] {
    let mut token = [u8; 32];
    rand::thread_rng().fill_bytes(&mut token); // Not cryptographically guaranteed
    token
}
```

### Zeroize Sensitive Data

```rust
use zeroize::Zeroize;

struct Credentials {
    username: String,
    password: String,
}

impl Drop for Credentials {
    fn drop(&mut self) {
        self.password.zeroize(); // Clear password from memory
    }
}

// Or use the derive macro:
use zeroize::ZeroizeOnDrop;

#[derive(ZeroizeOnDrop)]
struct ApiKey {
    #[zeroize(skip)] // Don't zeroize non-sensitive fields
    name: String,
    secret: String,
}
```

## Secrets Management

### Never Hardcode Secrets

```rust
// Bad: Hardcoded secret
const API_KEY: &str = "sk-live-abc123";

// Good: Load from environment
fn api_key() -> Result<String, std::env::VarError> {
    std::env::var("API_KEY")
}

// Good: Use a secrets manager
async fn get_secret(client: &SecretClient, name: &str) -> Result<String, SecretError> {
    client.get_secret_value(name).await
}
```

### Prevent Secret Logging

```rust
use std::fmt;

/// Wrapper that prevents accidental logging of sensitive values
pub struct Secret<T>(T);

impl<T> Secret<T> {
    pub fn new(value: T) -> Self {
        Self(value)
    }

    pub fn expose(&self) -> &T {
        &self.0
    }
}

impl<T> fmt::Debug for Secret<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[REDACTED]")
    }
}

impl<T> fmt::Display for Secret<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("[REDACTED]")
    }
}

// Usage
let api_key = Secret::new("sk-live-abc123".to_string());
println!("Key: {api_key}"); // Prints: Key: [REDACTED]
tracing::info!(?api_key);   // Logs: api_key=[REDACTED]
```

## Dependency Security

### Cargo Audit

```bash
# Install
cargo install cargo-audit

# Run audit
cargo audit

# Fix known vulnerabilities
cargo audit fix

# Run in CI — fail on any advisory
cargo audit --deny warnings
```

### Cargo Deny

```bash
# Install
cargo install cargo-deny

# Initialize config
cargo deny init

# Check all categories
cargo deny check
```

```toml
# deny.toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"

[licenses]
unlicensed = "deny"
allow = [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
]

[bans]
multiple-versions = "warn"
wildcards = "deny"

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-git = []
```

### Supply Chain Security

```toml
# Cargo.toml — pin exact versions for critical dependencies
[dependencies]
ring = "=0.17.7"
rustls = "=0.23.5"

# Use cargo-vet for supply chain review
# cargo install cargo-vet
# cargo vet
```

## Web Security (with Actix-web / Axum)

### CSRF Protection

```rust
// Using tower middleware with Axum
use axum::{middleware, extract::State};
use tower_http::cors::CorsLayer;

fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/api/data", post(create_data))
        .layer(
            CorsLayer::new()
                .allow_origin(["https://myapp.com".parse().unwrap()])
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
                .allow_credentials(true),
        )
        .with_state(state)
}
```

### Rate Limiting

```rust
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

fn create_rate_limiter() -> RateLimiter</* ... */> {
    RateLimiter::direct(Quota::per_second(NonZeroU32::new(10).unwrap()))
}

async fn rate_limited_handler(
    State(limiter): State<Arc<RateLimiter</* ... */>>>,
) -> Result<impl IntoResponse, StatusCode> {
    limiter.check()
        .map_err(|_| StatusCode::TOO_MANY_REQUESTS)?;

    Ok("OK")
}
```

### XSS Prevention

```rust
// Always escape user content before rendering in HTML
fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

// Better: Use a templating engine that escapes by default (askama, tera, maud)
// askama auto-escapes all variables in HTML templates
```

## Security Testing

```rust
#[cfg(test)]
mod security_tests {
    use super::*;

    #[test]
    fn rejects_path_traversal() {
        let base = Path::new("/var/data");
        assert!(safe_resolve(base, "../etc/passwd").is_err());
        assert!(safe_resolve(base, "../../root/.ssh/id_rsa").is_err());
        assert!(safe_resolve(base, "valid/file.txt").is_ok());
    }

    #[test]
    fn rejects_oversized_input() {
        let input = "a".repeat(1_000_001);
        assert!(matches!(
            validate_input(&input),
            Err(ValidationError::TooLong { .. })
        ));
    }

    #[test]
    fn handles_integer_overflow() {
        assert!(calculate_total(u64::MAX, 2).is_err());
        assert!(calculate_total(1_000, 1_000).is_ok());
    }

    #[test]
    fn password_hash_is_not_reversible() {
        let hash = hash_password("secret123").unwrap();
        assert!(!hash.contains("secret123"));
        assert!(verify_password("secret123", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn secret_does_not_leak_in_debug() {
        let secret = Secret::new("sensitive-data");
        let debug_output = format!("{:?}", secret);
        assert!(!debug_output.contains("sensitive-data"));
        assert!(debug_output.contains("REDACTED"));
    }
}
```

## Security Tooling Commands

```bash
# Audit dependencies for known vulnerabilities
cargo audit

# Comprehensive policy enforcement
cargo deny check

# Find unsafe code usage
cargo geiger

# Static analysis
cargo clippy -- -D warnings -W clippy::pedantic

# Fuzzing (requires nightly)
cargo +nightly fuzz run fuzz_target

# Run with sanitizers
RUSTFLAGS="-Z sanitizer=address" cargo +nightly test
RUSTFLAGS="-Z sanitizer=memory" cargo +nightly test
RUSTFLAGS="-Z sanitizer=thread" cargo +nightly test

# Check for supply chain issues
cargo vet
```

## Quick Reference: Security Checklist

Before marking Rust work complete:

- [ ] No hardcoded secrets — loaded from environment or secrets manager
- [ ] `unsafe` blocks have `// SAFETY:` comments and are minimized
- [ ] User input is validated and parsed into typed structs at boundaries
- [ ] Integer arithmetic uses checked/saturating operations for untrusted input
- [ ] SQL queries use parameterized queries (`$1`, `$2`), never string formatting
- [ ] File paths are canonicalized and checked against a base directory
- [ ] Passwords are hashed with Argon2/bcrypt, never stored plaintext
- [ ] Cryptographic comparisons use constant-time operations
- [ ] Sensitive data implements `Zeroize` and custom `Debug`/`Display`
- [ ] `cargo audit` and `cargo deny check` pass in CI
- [ ] CORS, rate limiting, and CSRF protection configured for web services
- [ ] Error messages don't leak internal details to users

**Remember**: Rust gives you a head start on security with its type system and ownership model, but it doesn't protect against logic errors, misconfigured services, or vulnerable dependencies. Stay vigilant.
