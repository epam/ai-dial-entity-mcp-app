import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-nested-ternary': 'error',
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': 'error',
    },
  },
  { files: ['**/*.tsx'], ...jsxA11y.flatConfigs.recommended },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.spec.{ts,tsx}', '**/test-setup.ts'],
    rules: { 'prefer-arrow-callback': 'off' },
  },
  {
    files: ['libs/mcp-app-kit/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/apps/**',
                'ai-dial-skill-mcp-app',
                'ai-dial-skill-mcp-app/*',
              ],
              message: 'The kit must not import app code.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/*/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@modelcontextprotocol/*'],
              message: 'Use @epam/ai-dial-mcp-app-kit instead of the MCP SDK.',
            },
            {
              group: ['**/libs/**'],
              message: 'Import the kit by package name.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'parent',
          message: 'Talk to the host through the kit.',
        },
        {
          object: 'globalThis',
          property: 'parent',
          message: 'Talk to the host through the kit.',
        },
        {
          object: 'self',
          property: 'parent',
          message: 'Talk to the host through the kit.',
        },
        {
          property: 'postMessage',
          message: 'Talk to the host through the kit.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'parent', message: 'Talk to the host through the kit.' },
        { name: 'postMessage', message: 'Talk to the host through the kit.' },
      ],
    },
  },
);
