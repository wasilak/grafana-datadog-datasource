.PHONY: help all clean build build-frontend build-backend build-backend-all build-backend-linux build-backend-linux-arm build-backend-darwin build-backend-windows install verify

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

# Plugin identifier
PLUGIN_ID := wasilak-datadog-datasource
PLUGIN_NAME := Datadog Datasource

# Directories
DIST_DIR := dist
SOURCE_DIR := src
PKG_DIR := pkg

##############################################################################
# Help
##############################################################################

help:
	@echo "$(BLUE)========================================$(NC)"
	@echo "$(BLUE)$(PLUGIN_NAME) - Build Targets$(NC)"
	@echo "$(BLUE)========================================$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Main targets:"
	@echo "  $(GREEN)all$(NC)                   - Build frontend + backend for current platform"
	@echo "  $(GREEN)build$(NC)                 - Same as 'all'"
	@echo "  $(GREEN)clean$(NC)                 - Clean dist/ directory"
	@echo ""
	@echo "Frontend targets:"
	@echo "  $(GREEN)build-frontend$(NC)        - Build frontend only (webpack)"
	@echo ""
	@echo "Backend targets:"
	@echo "  $(GREEN)build-backend$(NC)         - Build backend for current platform"
	@echo "  $(GREEN)build-backend-all$(NC)     - Build backend for all platforms"
	@echo "  $(GREEN)build-backend-linux$(NC)   - Build backend for Linux x86-64"
	@echo "  $(GREEN)build-backend-linux-arm$(NC) - Build backend for Linux ARM64"
	@echo "  $(GREEN)build-backend-darwin$(NC)  - Build backend for macOS"
	@echo "  $(GREEN)build-backend-windows$(NC) - Build backend for Windows"
	@echo ""
	@echo "Utility targets:"
	@echo "  $(GREEN)install$(NC)               - Install frontend dependencies"
	@echo "  $(GREEN)verify$(NC)                - Verify build artifacts"
	@echo "  $(GREEN)help$(NC)                  - Show this message"
	@echo ""

##############################################################################
# Main Targets
##############################################################################

all: build

build: install build-frontend build-backend verify
	@echo ""
	@echo "$(GREEN)✓ Build complete$(NC)"
	@echo "$(BLUE)Output directory: $(DIST_DIR)/$(NC)"
	@echo ""

##############################################################################
# Cleanup
##############################################################################

clean:
	@echo "$(BLUE)Cleaning dist/ directory...$(NC)"
	@rm -rf $(DIST_DIR)
	@mkdir -p $(DIST_DIR)
	@echo "$(GREEN)✓ Cleaned$(NC)"

##############################################################################
# Frontend Build
##############################################################################

install:
	@echo "$(BLUE)Installing frontend dependencies...$(NC)"
	@yarn install --silent 2>/dev/null || yarn install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

build-frontend: install
	@echo "$(BLUE)Building frontend (webpack)...$(NC)"
	@yarn build
	@if [ -f "$(DIST_DIR)/module.js" ]; then \
		echo "$(GREEN)✓ Frontend built$(NC)"; \
	else \
		echo "$(RED)✗ Frontend build failed$(NC)"; \
		exit 1; \
	fi

##############################################################################
# Backend Build
##############################################################################

build-backend:
	@echo "$(BLUE)Building backend (current platform)...$(NC)"
	@mage build:backend
	@echo "$(GREEN)✓ Backend built$(NC)"

build-backend-all:
	@echo "$(BLUE)Building backend for all platforms...$(NC)"
	@mage build:backendLinux
	@mage build:backendLinuxArm
	@mage build:backendDarwin
	@mage build:backendWindows
	@echo "$(GREEN)✓ All backends built$(NC)"

build-backend-linux:
	@echo "$(BLUE)Building backend for Linux x86-64...$(NC)"
	@mage build:backendLinux
	@echo "$(GREEN)✓ Linux backend built$(NC)"

build-backend-linux-arm:
	@echo "$(BLUE)Building backend for Linux ARM64...$(NC)"
	@mage build:backendLinuxArm
	@echo "$(GREEN)✓ Linux ARM backend built$(NC)"

build-backend-darwin:
	@echo "$(BLUE)Building backend for macOS...$(NC)"
	@mage build:backendDarwin
	@echo "$(GREEN)✓ macOS backend built$(NC)"

build-backend-windows:
	@echo "$(BLUE)Building backend for Windows...$(NC)"
	@mage build:backendWindows
	@echo "$(GREEN)✓ Windows backend built$(NC)"

##############################################################################
# Verification
##############################################################################

verify:
	@echo "$(BLUE)Verifying build output...$(NC)"
	@if [ -f "$(DIST_DIR)/module.js" ] && [ -f "$(DIST_DIR)/plugin.json" ]; then \
		echo "$(GREEN)✓ Frontend artifacts found$(NC)"; \
	else \
		echo "$(RED)✗ Frontend artifacts missing$(NC)"; \
		exit 1; \
	fi
	@if [ -f "$(DIST_DIR)/gpx_$(PLUGIN_ID)"* ]; then \
		echo "$(GREEN)✓ Backend binaries found$(NC)"; \
	fi
	@echo "$(GREEN)✓ All artifacts verified$(NC)"

##############################################################################
# Development
##############################################################################

watch:
	@echo "$(BLUE)Starting development server (watch mode)...$(NC)"
	@yarn dev

lint:
	@echo "$(BLUE)Running linter...$(NC)"
	@yarn lint

lint-fix:
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	@yarn lint:fix

test:
	@echo "$(BLUE)Running tests...$(NC)"
	@yarn test:ci

typecheck:
	@echo "$(BLUE)Type checking...$(NC)"
	@yarn typecheck
