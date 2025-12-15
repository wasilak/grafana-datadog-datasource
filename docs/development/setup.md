# Development Setup

This guide helps you set up a local development environment for the Grafana Datadog datasource plugin.

## Prerequisites

### Required Software

- **Node.js**: Version 18+ (LTS recommended)
- **Yarn**: Package manager (preferred over npm)
- **Go**: Version 1.21+ for backend development
- **Mage**: Go build tool (`go install github.com/magefile/mage@latest`)
- **Git**: Version control
- **Grafana**: Version 9.0+ for testing

### Development Tools (Recommended)

- **VS Code**: With Go and TypeScript extensions
- **Docker**: For running Grafana in containers
- **Make**: For build automation

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/wasilak/grafana-datadog-datasource.git
cd grafana-datadog-datasource
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
yarn install

# Install Go dependencies (if needed)
go mod download
```

### 3. Build Plugin

```bash
# Build everything
make build

# Or build components separately
make build-frontend  # Build React/TypeScript frontend
make build-backend   # Build Go backend
```

### 4. Verify Build

```bash
# Check dist directory
ls -la dist/

# Should contain:
# - plugin.json
# - module.js
# - gpx_* (backend binaries)
```

## Development Workflow

### Frontend Development

The frontend is built with React, TypeScript, and Grafana UI components.

#### File Structure
```
src/
├── components/           # React components
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
│   ├── autocomplete/    # Autocomplete logic
│   └── __tests__/       # Unit tests
├── types.ts             # TypeScript type definitions
├── datasource.ts        # Main datasource class
└── module.ts            # Plugin entry point
```

#### Development Commands

```bash
# Watch mode for frontend development
yarn dev

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Lint code
yarn lint

# Type checking
yarn typecheck
```

#### Making Changes

1. **Edit source files** in `src/`
2. **Run tests**: `yarn test`
3. **Build**: `make build-frontend`
4. **Test in Grafana**: Restart Grafana to load changes

### Backend Development

The backend is written in Go and handles API communication with Datadog.

#### File Structure
```
pkg/plugin/
├── datasource.go           # Main datasource implementation
├── query_handler.go        # Query routing and handling
├── logs.go                 # Logs query implementation
├── logs_handler.go         # Logs-specific handler
├── logs_response_parser.go # Logs response parsing
├── datadog_*_builder.go    # API request builders
└── *_test.go              # Go tests
```

#### Development Commands

```bash
# Build backend
make build-backend

# Run tests
go test ./pkg/plugin/...

# Run tests with coverage
go test -cover ./pkg/plugin/...

# Run specific test
go test -run TestSpecificFunction ./pkg/plugin/

# Build for specific platform
make build-backend-linux
make build-backend-darwin
make build-backend-windows
```

#### Making Changes

1. **Edit Go files** in `pkg/plugin/`
2. **Run tests**: `go test ./pkg/plugin/...`
3. **Build**: `make build-backend`
4. **Test in Grafana**: Restart Grafana to load new binary

## Testing Setup

### Local Grafana Instance

#### Option 1: Docker (Recommended)

```bash
# Create docker-compose.yml
version: '3.8'
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=wasilak-datadog-datasource
      - GF_DEFAULT_APP_MODE=development
    volumes:
      - ./dist:/var/lib/grafana/plugins/wasilak-datadog-datasource
      - grafana-storage:/var/lib/grafana
volumes:
  grafana-storage:

# Start Grafana
docker-compose up -d

# View logs
docker-compose logs -f grafana
```

#### Option 2: Local Installation

```bash
# Install Grafana (macOS with Homebrew)
brew install grafana

# Configure plugin path
# Edit /usr/local/etc/grafana/grafana.ini
[paths]
plugins = /path/to/your/plugins

[plugins]
allow_loading_unsigned_plugins = wasilak-datadog-datasource

# Start Grafana
brew services start grafana

# Or run directly
grafana-server --config=/usr/local/etc/grafana/grafana.ini
```

### Plugin Installation

```bash
# Create symlink to development build
ln -s /path/to/grafana-datadog-datasource/dist /var/lib/grafana/plugins/wasilak-datadog-datasource

# Or copy files
cp -r dist/* /var/lib/grafana/plugins/wasilak-datadog-datasource/
```

### Test Data Setup

1. **Create Datadog Account**: Get free trial or use existing account
2. **Generate API Keys**: Create API Key and App Key
3. **Configure Datasource**: In Grafana, add Datadog datasource with your keys
4. **Test Connection**: Verify "Save & Test" passes

## Debugging

### Frontend Debugging

#### Browser DevTools

1. **Open DevTools** (F12)
2. **Console Tab**: Check for JavaScript errors
3. **Network Tab**: Monitor API requests
4. **Sources Tab**: Set breakpoints in TypeScript code

#### React DevTools

```bash
# Install React DevTools browser extension
# Available for Chrome and Firefox
```

#### Debug Logging

```typescript
// Add debug logging in your code
console.log('Debug info:', data);
console.warn('Warning:', warning);
console.error('Error:', error);
```

### Backend Debugging

#### Go Debugging

```bash
# Build with debug symbols
go build -gcflags="all=-N -l" -o dist/gpx_datadog-datasource_linux_amd64 ./pkg

# Use delve debugger
dlv exec ./dist/gpx_datadog-datasource_linux_amd64
```

#### Logging

```go
// Add logging in Go code
import "github.com/grafana/grafana-plugin-sdk-go/backend/log"

logger := log.DefaultLogger
logger.Info("Debug info", "key", value)
logger.Warn("Warning", "error", err)
logger.Error("Error", "error", err)
```

#### Grafana Logs

```bash
# View Grafana logs
tail -f /var/log/grafana/grafana.log

# Or with Docker
docker-compose logs -f grafana
```

## Code Quality

### Linting and Formatting

#### Frontend

```bash
# ESLint
yarn lint
yarn lint:fix

# Prettier
yarn format

# TypeScript checking
yarn typecheck
```

#### Backend

```bash
# Go formatting
go fmt ./...

# Go linting (install golangci-lint first)
golangci-lint run

# Go vet
go vet ./...
```

### Testing

#### Frontend Tests

```bash
# Run all tests
yarn test

# Run specific test file
yarn test src/utils/autocomplete/parser.test.ts

# Run tests with coverage
yarn test --coverage

# Update snapshots
yarn test --updateSnapshot
```

#### Backend Tests

```bash
# Run all tests
go test ./pkg/plugin/...

# Run with coverage
go test -cover ./pkg/plugin/...

# Run specific test
go test -run TestLogsQuery ./pkg/plugin/

# Verbose output
go test -v ./pkg/plugin/...
```

### Pre-commit Hooks

Set up pre-commit hooks to ensure code quality:

```bash
# Install pre-commit (if using Python)
pip install pre-commit

# Or with Homebrew
brew install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Build System

### Makefile Targets

```bash
# Build everything
make build
make all

# Build components
make build-frontend
make build-backend
make build-backend-all

# Platform-specific builds
make build-backend-linux
make build-backend-darwin
make build-backend-windows

# Clean
make clean

# Install dependencies
make install
```

### Mage Targets

```bash
# List available targets
mage -l

# Build backend
mage build:backend

# Build for all platforms
mage build:backend:all

# Clean
mage clean
```

## Release Process

### Version Management

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Create git tag**: `git tag v1.2.3`
4. **Push tag**: `git push origin v1.2.3`

### Building Release

```bash
# Clean previous builds
make clean

# Build for all platforms
make build-backend-all
make build-frontend

# Create release archive
tar -czf wasilak-datadog-datasource-v1.2.3.tar.gz dist/
```

## Contributing

### Code Style

- **Frontend**: Follow Grafana's React/TypeScript conventions
- **Backend**: Follow Go best practices and Grafana plugin patterns
- **Documentation**: Use clear, concise language with examples

### Pull Request Process

1. **Fork repository**
2. **Create feature branch**: `git checkout -b feature/my-feature`
3. **Make changes** with tests
4. **Run tests**: `make test`
5. **Build**: `make build`
6. **Commit changes**: Use conventional commit format
7. **Push branch**: `git push origin feature/my-feature`
8. **Create pull request**

### Commit Messages

Use conventional commit format:

```
feat: add logs autocomplete support
fix: resolve memory leak in query caching
docs: update installation guide
test: add unit tests for parser
refactor: simplify query builder logic
```

## Troubleshooting Development Issues

### Build Failures

**Frontend build fails**:
- Check Node.js version (18+)
- Clear node_modules: `rm -rf node_modules && yarn install`
- Check for TypeScript errors: `yarn typecheck`

**Backend build fails**:
- Check Go version (1.21+)
- Update dependencies: `go mod tidy`
- Check for syntax errors: `go vet ./...`

### Plugin Not Loading

**Plugin not appearing in Grafana**:
- Check plugin directory path
- Verify `allow_loading_unsigned_plugins` setting
- Check Grafana logs for errors
- Restart Grafana after changes

### Development Server Issues

**Hot reload not working**:
- Restart development server
- Check file watchers aren't at limit
- Verify file permissions

**API requests failing**:
- Check CORS settings
- Verify API credentials
- Check network connectivity
- Review browser console for errors

## Resources

- [Grafana Plugin Development Guide](https://grafana.com/docs/grafana/latest/developers/plugins/)
- [Grafana Plugin SDK for Go](https://github.com/grafana/grafana-plugin-sdk-go)
- [React Documentation](https://reactjs.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Go Documentation](https://golang.org/doc/)
- [Datadog API Documentation](https://docs.datadoghq.com/api/)