---
title: Naming Conventions and Brand Agnosticism
inclusion: always
---

# Naming Conventions and Brand Agnosticism

## Brand-Agnostic Code

Whatever project name we settle on, code MUST be written in a way that is **name-agnostic**.

### ✅ Allowed Uses of Project Name

- **Documentation**: README, specs, comments, user-facing docs
- **Package name**: `package main`, `module github.com/wasilak/loomae`
- **Binary name**: `loomae` executable
- **Repository name**: GitHub repo name
- **User-facing messages**: CLI help text, startup messages

### ❌ NOT Allowed in Code

- **Function names**: ❌ `func loomaeStart()` → ✅ `func Start()`
- **Struct names**: ❌ `type loomaeServer struct` → ✅ `type Server struct`
- **Variable names**: ❌ `loomaeConfig` → ✅ `config`
- **Interface names**: ❌ `loomaeCoordinator` → ✅ `Coordinator`
- **Method names**: ❌ `Initloomae()` → ✅ `Init()`
- **Constants**: ❌ `loomaeVersion` → ✅ `Version`

## Go Naming Conventions

Follow standard Go naming conventions:

### Package Names
- Short, lowercase, single word
- No underscores or mixedCaps
- Examples: `server`, `cluster`, `shard`, `raft`

### Exported Names
- Use MixedCaps (PascalCase) for exported names
- Examples: `Server`, `ClusterState`, `ShardManager`

### Unexported Names
- Use mixedCaps (camelCase) for unexported names
- Examples: `handleHealth`, `clusterState`, `shardManager`

### Interface Names
- Single-method interfaces: verb + "er" suffix
- Examples: `Reader`, `Writer`, `Coordinator`
- Multi-method interfaces: descriptive noun
- Examples: `Server`, `Manager`, `Storage`

### Avoid Stuttering
- ❌ `server.ServerStart()` → ✅ `server.Start()`
- ❌ `cluster.ClusterState` → ✅ `cluster.State`
- ❌ `shard.ShardManager` → ✅ `shard.Manager`

## Examples

### ✅ Good - Brand Agnostic

```go
package server

type Server struct {
    host string
    port int
}

func New(host string, port int) *Server {
    return &Server{host: host, port: port}
}

func (s *Server) Start() error {
    fmt.Printf("Starting server on %s:%d\n", s.host, s.port)
    return nil
}
```

### ❌ Bad - Brand Specific

```go
package server

type loomaeServer struct {
    host string
    port int
}

func NewloomaeServer(host string, port int) *loomaeServer {
    return &loomaeServer{host: host, port: port}
}

func (s *loomaeServer) Startloomae() error {
    fmt.Printf("Starting loomae on %s:%d\n", s.host, s.port)
    return nil
}
```

## Why This Matters

1. **Reusability**: Code can be forked/reused without renaming everything
2. **Clarity**: Shorter names are easier to read and understand
3. **Go Idioms**: Follows standard Go conventions
4. **Maintainability**: Less coupling to brand name
5. **Professionalism**: Shows understanding of proper Go design

## Documentation is Different

In documentation, user-facing messages, and comments, using the project name is fine:

```go
// Server implements the loomae HTTP server
type Server struct {
    // ...
}

func main() {
    fmt.Println("loomae - Distributed Metrics Storage")
    // ...
}
```

The key is: **code structure and naming should be generic, documentation can be branded**.
