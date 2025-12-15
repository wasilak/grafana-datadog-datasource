# Contributing Guide

Thank you for your interest in contributing to the Grafana Datadog datasource plugin! This guide will help you get started with contributing code, documentation, or bug reports.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 18+** and **Yarn** for frontend development
- **Go 1.21+** for backend development
- **Git** for version control
- **Grafana 9.0+** for testing
- A **Datadog account** with API access for testing

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/grafana-datadog-datasource.git
   cd grafana-datadog-datasource
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/wasilak/grafana-datadog-datasource.git
   ```
4. **Install dependencies**:
   ```bash
   yarn install
   go mod download
   ```
5. **Build the plugin**:
   ```bash
   make build
   ```

See the [Development Setup Guide](setup.md) for detailed instructions.

## Ways to Contribute

### 🐛 Bug Reports

Help us improve by reporting bugs:

1. **Search existing issues** to avoid duplicates
2. **Use the bug report template** when creating issues
3. **Provide detailed information**:
   - Plugin version
   - Grafana version
   - Browser and OS
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if helpful

### 💡 Feature Requests

Suggest new features or improvements:

1. **Check existing feature requests** first
2. **Use the feature request template**
3. **Explain the use case** and why it's valuable
4. **Provide examples** of how it would work
5. **Consider implementation complexity**

### 📝 Documentation

Improve documentation:

- Fix typos or unclear explanations
- Add missing examples
- Update outdated information
- Translate documentation
- Create tutorials or guides

### 🔧 Code Contributions

Contribute code improvements:

- Bug fixes
- New features
- Performance improvements
- Code refactoring
- Test coverage improvements

## Development Workflow

### 1. Create a Branch

Create a feature branch from the latest main:

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

### Branch Naming Convention

Use descriptive branch names:

- `feature/logs-autocomplete` - New features
- `fix/memory-leak-query-cache` - Bug fixes
- `docs/update-installation-guide` - Documentation
- `refactor/simplify-parser-logic` - Code refactoring
- `test/add-unit-tests-parser` - Test improvements

### 2. Make Changes

#### Code Style

**Frontend (TypeScript/React)**:
- Follow Grafana's React/TypeScript conventions
- Use functional components with hooks
- Implement proper TypeScript types
- Follow ESLint rules: `yarn lint`
- Format code: `yarn format`

**Backend (Go)**:
- Follow Go best practices and idioms
- Use proper error handling
- Write clear, self-documenting code
- Format code: `go fmt ./...`
- Follow linting rules: `golangci-lint run`

#### Testing

**Write tests for your changes**:

```bash
# Frontend tests
yarn test

# Backend tests
go test ./pkg/plugin/...

# Run specific tests
yarn test src/utils/parser.test.ts
go test -run TestLogsQuery ./pkg/plugin/
```

#### Documentation

Update documentation when:
- Adding new features
- Changing existing behavior
- Fixing bugs that affect user experience
- Adding new configuration options

### 3. Commit Changes

#### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(logs): add autocomplete support for log levels
fix(cache): resolve memory leak in query caching
docs(readme): update installation instructions
test(parser): add unit tests for query parsing
refactor(api): simplify request builder interface
```

#### Commit Best Practices

- **Make atomic commits**: One logical change per commit
- **Write clear messages**: Explain what and why, not how
- **Keep commits small**: Easier to review and revert if needed
- **Test before committing**: Ensure tests pass

### 4. Push and Create Pull Request

```bash
# Push your branch
git push origin feature/your-feature-name

# Create pull request on GitHub
```

## Pull Request Process

### 1. Pull Request Template

Use the provided PR template and fill out all sections:

- **Description**: What does this PR do?
- **Type of Change**: Bug fix, feature, documentation, etc.
- **Testing**: How was this tested?
- **Checklist**: Ensure all items are checked

### 2. Pull Request Guidelines

**Before submitting**:
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated if needed
- [ ] No merge conflicts with main branch

**PR Description should include**:
- Clear description of changes
- Motivation and context
- Screenshots for UI changes
- Breaking changes (if any)
- Related issues (use "Fixes #123")

### 3. Review Process

**What to expect**:
1. **Automated checks**: CI/CD pipeline runs tests
2. **Code review**: Maintainers review your code
3. **Feedback**: Address any requested changes
4. **Approval**: PR approved by maintainers
5. **Merge**: PR merged into main branch

**During review**:
- Be responsive to feedback
- Make requested changes promptly
- Ask questions if feedback is unclear
- Be patient - reviews take time

### 4. Addressing Feedback

When reviewers request changes:

```bash
# Make changes locally
git add .
git commit -m "fix: address review feedback"
git push origin feature/your-feature-name
```

**Tips for addressing feedback**:
- Address all comments
- Explain your reasoning if you disagree
- Ask for clarification if needed
- Update tests if logic changes
- Update documentation if behavior changes

## Code Review Guidelines

### For Contributors

**When your PR is being reviewed**:
- Be open to feedback and suggestions
- Explain your approach and reasoning
- Be willing to make changes
- Learn from the review process

### For Reviewers

**When reviewing PRs**:
- Be constructive and helpful
- Explain the reasoning behind suggestions
- Acknowledge good practices
- Focus on code quality and maintainability
- Test the changes locally if needed

## Testing Guidelines

### Frontend Testing

**Unit Tests**:
```bash
# Run all tests
yarn test

# Run specific test file
yarn test src/utils/parser.test.ts

# Run tests in watch mode
yarn test --watch

# Run tests with coverage
yarn test --coverage
```

**Test Structure**:
```typescript
describe('QueryParser', () => {
  describe('parseMetricsQuery', () => {
    it('should parse basic metric query', () => {
      const result = parseMetricsQuery('avg:system.cpu.user{*}');
      expect(result.metric).toBe('system.cpu.user');
      expect(result.aggregation).toBe('avg');
    });
  });
});
```

### Backend Testing

**Unit Tests**:
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

**Test Structure**:
```go
func TestLogsQuery(t *testing.T) {
    tests := []struct {
        name     string
        query    string
        expected string
    }{
        {
            name:     "basic error query",
            query:    "status:ERROR",
            expected: "status:ERROR",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := translateLogsQuery(tt.query)
            assert.Equal(t, tt.expected, result)
        })
    }
}
```

### Integration Testing

Test the plugin with a real Grafana instance:

1. **Build the plugin**: `make build`
2. **Install in Grafana**: Copy to plugins directory
3. **Configure datasource**: Add your Datadog credentials
4. **Test functionality**: Create queries and dashboards
5. **Verify behavior**: Ensure everything works as expected

## Documentation Guidelines

### Writing Style

- **Clear and concise**: Use simple, direct language
- **User-focused**: Write from the user's perspective
- **Example-driven**: Include practical examples
- **Structured**: Use headings, lists, and formatting
- **Accurate**: Keep information up-to-date

### Documentation Types

**User Documentation**:
- Getting started guides
- Feature explanations
- Configuration instructions
- Troubleshooting guides
- Examples and tutorials

**Developer Documentation**:
- API references
- Architecture overviews
- Development setup
- Contributing guidelines
- Code comments

### Documentation Updates

Update documentation when:
- Adding new features
- Changing existing behavior
- Fixing bugs that affect users
- Adding configuration options
- Improving error messages

## Release Process

### Version Management

The project uses semantic versioning (SemVer):

- **Major** (1.0.0): Breaking changes
- **Minor** (0.1.0): New features, backward compatible
- **Patch** (0.0.1): Bug fixes, backward compatible

### Release Checklist

For maintainers preparing releases:

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Test thoroughly** in staging environment
4. **Create release branch**: `release/v1.2.3`
5. **Build release artifacts**: `make build-all`
6. **Create GitHub release** with artifacts
7. **Update documentation** if needed
8. **Announce release** in relevant channels

## Community Guidelines

### Code of Conduct

We follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/). Please read and follow these guidelines:

- **Be respectful**: Treat everyone with respect and kindness
- **Be inclusive**: Welcome people of all backgrounds and experience levels
- **Be collaborative**: Work together constructively
- **Be patient**: Help others learn and grow
- **Be professional**: Maintain a professional tone in all interactions

### Communication

**GitHub Issues**:
- Use for bug reports and feature requests
- Search before creating new issues
- Provide detailed information
- Follow issue templates

**Pull Requests**:
- Use for code contributions
- Follow PR templates
- Respond to feedback promptly
- Keep discussions focused

**Discussions**:
- Use GitHub Discussions for questions
- Help other community members
- Share tips and best practices

## Getting Help

### For Contributors

**Development Questions**:
- Check existing documentation first
- Search GitHub issues and discussions
- Ask specific, detailed questions
- Provide context and examples

**Code Review Help**:
- Ask for clarification on feedback
- Request additional review if needed
- Seek help with complex changes

### For Maintainers

**Review Guidelines**:
- Provide constructive feedback
- Explain reasoning behind suggestions
- Help contributors improve their skills
- Maintain consistent standards

**Community Management**:
- Welcome new contributors
- Help resolve conflicts
- Maintain project direction
- Ensure code quality

## Recognition

### Contributors

All contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Documentation acknowledgments

### Types of Contributions

We value all types of contributions:
- **Code**: Features, bug fixes, improvements
- **Documentation**: Guides, examples, translations
- **Testing**: Bug reports, test cases, QA
- **Community**: Helping others, discussions, feedback
- **Design**: UI/UX improvements, graphics, branding

## Resources

### Documentation
- [Development Setup](setup.md)
- [Architecture Overview](architecture.md)
- [API Reference](api.md)
- [User Documentation](../README.md)

### External Resources
- [Grafana Plugin Development](https://grafana.com/docs/grafana/latest/developers/plugins/)
- [Datadog API Documentation](https://docs.datadoghq.com/api/)
- [Go Documentation](https://golang.org/doc/)
- [React Documentation](https://reactjs.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### Tools
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

## Questions?

If you have questions about contributing:

1. **Check the documentation** first
2. **Search existing issues** and discussions
3. **Create a new discussion** for general questions
4. **Create an issue** for specific bugs or features

Thank you for contributing to the Grafana Datadog datasource plugin! Your contributions help make this project better for everyone.