# Build Commands

## Use Makefile for All Builds

This project uses Makefile for all build operations. Do NOT use `task`, `mage`, or direct `go build` commands.

### Frontend Build
- ✅ `make build-frontend` - Build frontend only
- ✅ `make install` - Install frontend dependencies
- ❌ `yarn build` - Don't use directly, use make targets

### Backend Build
- ✅ `make build-backend` - Build backend for current platform
- ✅ `make build-backend-all` - Build backend for all platforms
- ✅ `make build-backend-linux` - Build backend for Linux
- ✅ `make build-backend-darwin` - Build backend for macOS
- ✅ `make build-backend-windows` - Build backend for Windows
- ❌ `mage build:backend` - Don't use mage directly
- ❌ `go build` - Don't use go build directly

### Complete Build
- ✅ `make build` - Build both frontend and backend
- ✅ `make all` - Same as build
- ✅ `make clean` - Clean dist directory

### Why Use Makefile
- Consistent build process across environments
- Proper dependency management
- Unified interface for all build operations
- Handles platform-specific builds correctly
- Includes verification steps

### When to Use
- Always use `make` commands for building
- When suggesting build commands to users, use `make` syntax
- When writing documentation, reference `make` commands
- When creating CI/CD scripts, use `make` commands