# Code Style & Conventions

## TypeScript & Linting
- **ESLint**: Extends Grafana ESLint config (v9)
  - Uses eslint-plugin-react, @typescript-eslint/eslint-plugin
  - React in JSX scope rule disabled (React 17+)
- **TypeScript**: ~5, strict mode expected
- **Parser**: @typescript-eslint/parser
- **Formatter**: Prettier v3 (Grafana preset via .config/.prettierrc.js)

## React & Component Conventions
- **React Version**: 19.2.1 (latest)
- **CSS-in-JS**: @emotion/css (Grafana standard)
- **Testing Library**: React Testing Library v16

## File Naming
- Components: PascalCase.tsx (e.g., QueryEditor.tsx, ConfigEditor.tsx)
- Files: lowercase or PascalCase based on content
- Types: types.ts for type definitions

## Import/Export Style
- Grafana components from @grafana/ui, @grafana/data, @grafana/runtime
- React hooks directly from react
- ESM module format (import/export)

## No Docstrings/Comments
- Code should be self-documenting
- Comments only for complex logic (not enforced by config)

## Build Config
- Webpack 5 with TypeScript support
- SWC for compilation (faster than Babel)
- Live reload support in development mode
