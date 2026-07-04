// ESLint flat config (ESLint 9) for the Cadi React app.
//
// Scope: the React SPA under src/ plus root config files. Edge functions under
// supabase/functions/ are Deno TypeScript and have their own toolchain — they are
// intentionally NOT linted here (a JS parser chokes on TS + Deno globals).
//
// Philosophy: catch real bugs (undefined vars, broken hooks), stay quiet on style
// (Prettier owns formatting). Noisy-but-not-dangerous rules are 'warn' so CI, which
// fails only on errors, isn't blocked by the pre-existing backlog.

import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'build/**',
      'node_modules/**',
      'supabase/**', // Deno TS — separate toolchain
      'public/**',
      'coverage/**',
      'scripts/**', // node utility scripts, not app code
      '.vercel/**',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2023,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,

      // React 19 automatic JSX runtime — no need to import React in scope.
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // The app doesn't use PropTypes; types are documented via JSDoc where it matters.
      'react/prop-types': 'off',
      // Unescaped apostrophes in copy are everywhere and harmless.
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',

      // Classic React hooks linting. We intentionally do NOT enable
      // eslint-plugin-react-hooks@7's new React-Compiler rules (set-state-in-effect,
      // static-components, purity, immutability, …): this app doesn't use the
      // compiler, and they'd flag ~150 advisory issues across the existing tree.
      // rules-of-hooks is a genuine correctness rule → error; deps → warn.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Noise / style — warn so the existing backlog doesn't block CI. Tighten
      // to 'error' once burned down.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',

      // Hard errors — these catch genuine mistakes that break at runtime.
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-self-assign': 'error',
      'react/jsx-no-undef': 'error',
    },
  },

  // Node context for root config files.
  {
    files: ['*.config.{js,mjs}', 'vite.config.js', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Test files run under Vitest globals (vitest config sets globals: true).
  {
    files: ['**/*.test.{js,jsx,mjs}', 'src/test/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },

  // Prettier last — turns off all formatting-related rules.
  prettier,
];
