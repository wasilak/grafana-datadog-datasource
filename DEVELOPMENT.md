# Development Guide

This guide covers local development setup, building, and contributing to the Grafana Datadog Datasource Plugin.

## Prerequisites

- **Node.js** (LTS version)
- **Yarn** package manager
- **Go** 1.21+
- **Mage** build tool
- **Docker & Docker Compose**

## Quick Start with Docker

```bash
# Clone repository
git clone https://github.com/wasilak/grafana-datadog-datasource.git
cd grafana-datadog-datasource

# Install dependencies and build
make build

# Start Grafana with plugin loaded
docker compose up --build
```

This will start Grafana at `http://localhost:3000` with:
- **Anonymous authentication enabled** (no login required)
- **Plugin pre-loaded** and trusted
- **Debug logging enabled** for development
- **Hot reload** - changes to `dist/` are reflected immediately

## Manual Setup

```bash
# Install dependencies
yarn install

# Build plugin
make build

# Start development server (watch mode)
make watch

# In another terminal, start Grafana
docker compose up --build
```

## Build Commands

```bash
make build                    # Build frontend + backend for current platform
make build-backend-all        # Build backend for all platforms
make clean                    # Clean build artifacts
make lint                     # Run linting
make test                     # Run tests
make watch                    # Start development server (watch mode)
```

## Docker Configuration Details

The included `docker-compose.yaml` provides a complete development environment:

```yaml
services:
  grafana:
    build:
      context: ./.config
      args:
        grafana_image: grafana                    # Use OSS Grafana
        grafana_version: 12.3.0                  # Grafana version
        development: true                        # Development mode
        anonymous_auth_enabled: true             # No login required
    ports:
      - 3000:3000/tcp
    volumes:
      - ./dist:/var/lib/grafana/plugins/wasilak-datadog-datasource  # Plugin files
      - .:/root/wasilak-datadog-datasource                          # Source code
    environment:
      GF_LOG_FILTERS: plugin.wasilak-datadog-datasource:debug      # Plugin debug logs
      GF_LOG_LEVEL: debug                                           # Grafana debug logs
      GF_DATAPROXY_LOGGING: 1                                      # HTTP proxy debug logs
      GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS: wasilak-datadog-datasource  # Trust plugin
```

## Environment Variables

You can customize the Docker setup with environment variables:

```bash
# Use Grafana Enterprise
GRAFANA_IMAGE=grafana-enterprise docker compose up

# Use different Grafana version
GRAFANA_VERSION=11.0.0 docker compose up

# Combine both
GRAFANA_IMAGE=grafana-enterprise GRAFANA_VERSION=11.0.0 docker compose up
```

## Project Structure

```
├── src/                          # Frontend TypeScript code
│   ├── components/              # React components
│   ├── utils/                   # Utility functions
│   │   └── autocomplete/        # Autocomplete logic
│   ├── types.ts                 # TypeScript type definitions
│   └── QueryEditor.tsx          # Main query editor component
├── pkg/                         # Backend Go code
│   └── plugin/                  # Plugin implementation
├── dist/                        # Built plugin files
├── .config/                     # Build configuration
├── Magefile.go                  # Build tasks
├── docker-compose.yaml          # Development environment
└── Makefile                     # Build shortcuts
```

## Development Workflow

1. **Make changes** to source code in `src/` or `pkg/`
2. **Build** with `make build` or use `make watch` for auto-rebuild
3. **Test** in Grafana at `http://localhost:3000`
4. **Debug** using browser dev tools and Grafana logs
5. **Commit** changes with descriptive messages

## Testing

### Frontend Tests
```bash
yarn test                        # Run Jest tests
yarn test:ci                     # Run tests in CI mode
```

### Backend Tests
```bash
mage test                        # Run Go tests
```

### Manual Testing
1. Start the development environment
2. Create a Datadog datasource in Grafana
3. Test query editor functionality
4. Verify autocomplete features work correctly

## Debugging

### Frontend Debugging
- Use browser developer tools
- Check console for JavaScript errors
- Use React Developer Tools extension

### Backend Debugging
- Check Grafana logs: `docker compose logs grafana`
- Add debug logging in Go code
- Use `GF_LOG_LEVEL=debug` environment variable

### Plugin Debugging
- Enable plugin debug logs: `GF_LOG_FILTERS=plugin.wasilak-datadog-datasource:debug`
- Check network requests in browser dev tools
- Verify API responses from Datadog

## Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes
4. **Add tests** if applicable
5. **Commit** changes: `git commit -m 'Add amazing feature'`
6. **Push** to branch: `git push origin feature/amazing-feature`
7. **Submit** a pull request

### Code Style

- **Frontend**: Follow TypeScript and React best practices
- **Backend**: Follow Go conventions and idioms
- **Commits**: Use conventional commit messages
- **Tests**: Add tests for new functionality

### Pull Request Guidelines

- Provide clear description of changes
- Include screenshots for UI changes
- Ensure all tests pass
- Update documentation if needed
- Keep changes focused and atomic

## Release Process

Releases are automated via GitHub Actions:

1. **Update version** in `package.json`
2. **Create tag**: `git tag v1.0.0`
3. **Push tag**: `git push origin v1.0.0`
4. **GitHub Actions** will build and create release automatically

## Troubleshooting

### Common Issues

**Build fails with Go errors**
- Ensure Go 1.21+ is installed
- Run `go mod tidy` to clean dependencies

**Frontend build fails**
- Delete `node_modules` and run `yarn install`
- Check Node.js version (use LTS)

**Plugin not loading in Grafana**
- Check `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS` is set
- Verify plugin files are in correct directory
- Check Grafana logs for errors

**Autocomplete not working**
- Verify Datadog API credentials are correct
- Check browser network tab for API errors
- Ensure CORS is properly configured

### Getting Help

- **Issues**: Create GitHub issue with detailed description
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check README.md and this development guide