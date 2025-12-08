---
title: Go Best Practices
inclusion: always
---

# Go Best Practices

## Code Style

### Formatting
- Always run `gofmt` (handled by `task build`)
- Use `goimports` for import organization
- Follow standard Go formatting conventions

### Error Handling
- Always check errors, never ignore them
- Wrap errors with context: `fmt.Errorf("failed to start server: %w", err)`
- Return errors, don't panic (except in truly exceptional cases)
- Use meaningful error messages

```go
// ✅ Good
func (s *Server) Start() error {
    if err := s.init(); err != nil {
        return fmt.Errorf("failed to initialize server: %w", err)
    }
    return nil
}

// ❌ Bad
func (s *Server) Start() error {
    s.init() // ignoring error
    return nil
}
```

### Interfaces
- Keep interfaces small and focused
- Define interfaces where they're used, not where they're implemented
- Accept interfaces, return structs

```go
// ✅ Good - small, focused interface
type Storage interface {
    Write(ctx context.Context, data []byte) error
    Read(ctx context.Context, key string) ([]byte, error)
}

// ❌ Bad - too many methods
type Storage interface {
    Write(ctx context.Context, data []byte) error
    Read(ctx context.Context, key string) ([]byte, error)
    Delete(ctx context.Context, key string) error
    List(ctx context.Context) ([]string, error)
    Backup(ctx context.Context, path string) error
    Restore(ctx context.Context, path string) error
    // ... 10 more methods
}
```

### Context Usage
- Always pass `context.Context` as first parameter
- Use context for cancellation, timeouts, and request-scoped values
- Don't store context in structs

```go
// ✅ Good
func (s *Server) Query(ctx context.Context, query string) (*Result, error) {
    // Use ctx for timeout/cancellation
    return s.execute(ctx, query)
}

// ❌ Bad
func (s *Server) Query(query string) (*Result, error) {
    // No way to cancel or timeout
    return s.execute(query)
}
```

## Project Structure

### Package Organization
```
loomae/
├── cmd/                    # Command implementations
│   ├── server.go
│   └── worker.go
├── pkg/                    # Public libraries
│   ├── server/
│   ├── cluster/
│   ├── shard/
│   └── raft/
├── internal/               # Private libraries (if needed)
└── main.go                 # Entry point
```

### Package Naming
- Use singular nouns: `server`, not `servers`
- Short, descriptive names
- No underscores or mixed caps

## Concurrency

### Goroutines
- Always have a way to stop goroutines
- Use channels or context for coordination
- Don't leak goroutines

```go
// ✅ Good
func (s *Server) Start(ctx context.Context) error {
    go func() {
        <-ctx.Done()
        s.shutdown()
    }()
    return s.serve()
}

// ❌ Bad
func (s *Server) Start() error {
    go func() {
        // No way to stop this goroutine
        for {
            s.doWork()
        }
    }()
    return s.serve()
}
```

### Mutexes
- Keep critical sections small
- Use `defer` to unlock
- Prefer `sync.RWMutex` for read-heavy workloads

```go
// ✅ Good
func (s *State) Get(key string) (string, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    val, ok := s.data[key]
    return val, ok
}

// ❌ Bad
func (s *State) Get(key string) (string, bool) {
    s.mu.Lock()
    val, ok := s.data[key]
    s.mu.Unlock() // Easy to forget, or return early
    return val, ok
}
```

## Testing

### Unit Test Structure
- Use table-driven tests for multiple cases
- Test file naming: `*_test.go`
- Test function naming: `TestFunctionName`

```go
func TestServer_HandleHealth(t *testing.T) {
    tests := []struct {
        name       string
        ready      bool
        wantStatus int
    }{
        {"ready", true, 200},
        {"not ready", false, 503},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            s := &Server{ready: tt.ready}
            // Test implementation
        })
    }
}
```

### Test Helpers
- Use `t.Helper()` in test helper functions
- Keep tests simple and readable
- Don't test implementation details

## Dependencies

### Minimal Dependencies
- Prefer standard library when possible
- Carefully evaluate third-party dependencies
- Pin dependency versions in `go.mod`

### Import Organization
```go
import (
    // Standard library
    "context"
    "fmt"
    "time"
    
    // Third-party
    "github.com/labstack/echo/v4"
    "go.etcd.io/etcd/raft/v3"
    
    // Internal
    "github.com/wasilak/loomae/pkg/server"
)
```

## Documentation

### Package Documentation
```go
// Package server implements the HTTP server for the metrics platform.
// It provides health endpoints, metrics ingestion, and query APIs.
package server
```

### Function Documentation
```go
// Start starts the HTTP server on the configured address.
// It returns an error if the server fails to start.
// The server runs until ctx is cancelled.
func (s *Server) Start(ctx context.Context) error {
    // ...
}
```

### Exported Names
- All exported names should have doc comments
- Start with the name being documented
- Use complete sentences

## Performance

### Avoid Premature Optimization
- Write clear code first
- Profile before optimizing
- Optimize hot paths only

### Memory Allocation
- Reuse buffers when possible
- Use `sync.Pool` for frequently allocated objects
- Avoid unnecessary allocations in hot paths

### Benchmarking
```go
func BenchmarkServer_HandleHealth(b *testing.B) {
    s := &Server{ready: true}
    for i := 0; i < b.N; i++ {
        s.handleHealth()
    }
}
```

## Common Pitfalls to Avoid

1. **Ignoring errors**: Always check and handle errors
2. **Goroutine leaks**: Always have a way to stop goroutines
3. **Race conditions**: Use mutexes or channels for shared state
4. **Panic in libraries**: Return errors instead of panicking
5. **Storing context**: Pass context as parameter, don't store it
6. **Large interfaces**: Keep interfaces small and focused
7. **Premature abstraction**: Write concrete code first, abstract later
