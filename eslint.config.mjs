// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Base JS rules
  eslint.configs.recommended,

  // TypeScript rules
  tseslint.configs.recommended,

  // Treat repo scripts as Node ESM (enable Node globals)
  {
    files: ['scripts/**/*.{js,mjs}', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node, // process, console, Buffer, setTimeout, etc.
        URL: 'readonly', // ensure global URL is recognized
      },
    },
    rules: {},
  },

  // Ignores
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**'],
  }
);
