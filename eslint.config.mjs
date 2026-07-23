// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Compiled output, deps and vendored/minified assets are never linted.
    ignores: ['.homeybuild/**', 'node_modules/**', '**/*.min.js'],
  },
  {
    files: ['**/*.{ts,mts,cts,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Homey flow-card queries and card args are dynamically shaped, so
      // `any` is used deliberately throughout the store and listeners.
      '@typescript-eslint/no-explicit-any': 'off',
      // Homey flow-card and API handlers receive fixed (query, args, settings)
      // signatures whose parameters aren't always used; don't flag those.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { vars: 'all', args: 'none', ignoreRestSiblings: true },
      ],
    },
  },
)
