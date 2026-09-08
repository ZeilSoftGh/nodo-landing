import js from '@eslint/js';
import globals from 'globals';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  // JSX accessibility rules for .astro templates (self-scoped to *.astro by the preset).
  ...astro.configs['jsx-a11y-recommended'],
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.tsx'],
    // The preset does not define `files`, so it is spread inside this scoped block.
    ...jsxA11y.flatConfigs.recommended,
    languageOptions: {
      // Merge (do not replace) to keep the preset's JSX parserOptions.
      ...jsxA11y.flatConfigs.recommended.languageOptions,
      globals: { ...globals.browser },
    },
  },
];
