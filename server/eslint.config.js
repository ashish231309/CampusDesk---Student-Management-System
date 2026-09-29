import js from '@eslint/js';
import globals from 'globals';

export default [
  // `.client-bundle/` is the verification harness's own build output.
  { ignores: ['node_modules/**', '.client-bundle/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    // The verify script is a developer tool that reports to the terminal.
    files: ['scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },
];
