# Essential Commands for Development

## Installation & Setup
```bash
yarn install          # Install all dependencies
```

## Development
```bash
yarn dev              # Watch mode - continuously rebuild on changes
yarn build            # Production build
yarn server           # Run development server with Docker Compose
```

## Code Quality
```bash
yarn lint             # Run ESLint checks
yarn lint:fix         # Fix linting issues + run Prettier
yarn typecheck        # TypeScript type checking
```

## Testing
```bash
yarn test             # Run tests in watch mode (only changed)
yarn test:ci          # Run all tests once (CI mode, max 4 workers)
```

## Plugin Management
```bash
yarn sign             # Sign the plugin for deployment
```

## Docker
```bash
yarn server           # Start Grafana dev environment via docker-compose
                      # Accessible at http://localhost:3000
```

## Git Utilities (macOS)
```bash
git status            # Check working tree status
git diff              # View unstaged changes
git log               # View commit history
grep -r "pattern" .   # Search codebase
```

## Important Notes
- **Node Version**: Use Node >=14 (check .nvmrc for current version)
- **Before committing code**: Always run `yarn lint:fix` and `yarn typecheck`
- **Tests should pass**: Run `yarn test:ci` before submitting PR
- **Docker development**: `yarn server` requires Docker & Docker Compose installed
