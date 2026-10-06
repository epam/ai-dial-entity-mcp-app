import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const appHostGlobals = [
  { name: 'parent', message: 'Talk to the host through the kit.' },
  { name: 'postMessage', message: 'Talk to the host through the kit.' },
];

const kitNoAppImports = {
  group: ['**/apps/**', 'ai-dial-entity-card', 'ai-dial-entity-card/*'],
  message: 'The kit must not import app code.',
};

const kitNoBuildToolImports = {
  group: [
    'vite',
    'vite/*',
    '@vitejs/*',
    'vite-plugin-singlefile',
    'vite-plugin-singlefile/*',
  ],
  message: 'Build tooling belongs in the kit vite layer.',
};

/**
 * Relative import patterns that reach a sibling kit layer from any depth
 * under `libs/mcp-app-kit/src/<layer>/`.
 * @param layers - sibling layer directory names
 */
const relativeLayers = (layers) =>
  layers.flatMap((layer) =>
    ['..', '../..', '../../..'].flatMap((up) => [
      `${up}/${layer}`,
      `${up}/${layer}/*`,
    ]),
  );

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
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
    files: [
      'apps/*/src/**/*.{ts,tsx}',
      'libs/mcp-app-kit/src/{core,react,testing,styles}/**/*.{ts,tsx}',
      'libs/mcp-app-kit/src/test-setup.ts',
      'libs/mcp-app-kit/dev-host/{main,presets}.ts',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      '**/*.{js,mjs,cjs}',
      '**/{vite,vitest}.config.ts',
      'libs/mcp-app-kit/src/vite/**/*.ts',
      'libs/mcp-app-kit/dev-host/devHostServer.ts',
      'tools/**/*.ts',
      '**/*.spec.{ts,tsx}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.spec.{ts,tsx}', '**/test-setup.ts'],
    rules: { 'prefer-arrow-callback': 'off' },
  },
  {
    files: ['libs/mcp-app-kit/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [kitNoAppImports] }],
    },
  },
  {
    files: ['libs/mcp-app-kit/src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            kitNoAppImports,
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message: 'Kit core is framework-free; React belongs in ../react.',
            },
            kitNoBuildToolImports,
            {
              group: relativeLayers(['react', 'vite', 'testing']),
              message:
                'Kit core must not depend on the react, vite or testing layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['libs/mcp-app-kit/src/react/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            kitNoAppImports,
            kitNoBuildToolImports,
            {
              group: relativeLayers(['vite']),
              message: 'The kit react layer must not depend on the vite layer.',
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
      'no-restricted-globals': ['error', ...appHostGlobals],
    },
  },
  {
    files: ['apps/*/src/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.spec.{ts,tsx}', '**/test-setup.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...appHostGlobals,
        ...[
          'fetch',
          'XMLHttpRequest',
          'WebSocket',
          'EventSource',
          'top',
          'opener',
        ].map((name) => ({
          name,
          message:
            'The app talks to the outside only through the host via the kit.',
        })),
      ],
    },
  },
);
