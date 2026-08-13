import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**', '.husky/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      // 生成的 API client 是型別安全的,用 any 等於把它丟掉
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // packages/ui 是純展示層。這一段是「各活動客製視覺」能成立的前提,
  // 不是風格偏好 —— 見 packages/ui/README.md。
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@danicotech/*-api',
                '**/lib/api',
                '**/lib/api/*',
                '@theatron/web',
                '@theatron/web/*',
              ],
              message: 'packages/ui 不 import API 型別。它只收 props。',
            },
            {
              group: ['next/*', 'next'],
              message: 'packages/ui 不綁框架。要用 Next 的東西就代表這個元件屬於 web/。',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/ui 不取資料。資料由 web/src/features 傳進來。' },
      ],
    },
  },

  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
);
