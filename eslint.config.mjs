import { defineConfig } from 'eslint/config';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import grafanaConfig from '@grafana/eslint-config/flat.js';

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));

export default defineConfig([
  ...grafanaConfig,
  includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
  {
    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
]);
