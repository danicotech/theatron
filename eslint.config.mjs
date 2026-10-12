import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // 生成的 client 不歸我們管:契約要改就去改 hestia/proto 再重跑 pnpm gen:api。
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '.husky/**',
      'web/src/lib/api/gen/**',
      // public/ 是靜態資產，不是我們寫的原始碼：裡面的 .js 有第三方凍結產物
      // （3D 的 23 個模組、anime.min.js），也有 lab 生成的執行期。
      // 它們不在 tsconfig 的 project 裡，type-aware 的規則一碰就是 parsing error，
      // 而那不是「程式有問題」，是「這些檔本來就不該被當成專案原始碼」。
      '**/public/**',
      // Byte-preserved canonical lab snapshot; validated by runtime/source tests.
      'sources/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // lab 生成的標記常數（lunjianMarkup.ts、loadoutMarkup.ts…）。
  // 裡面用來排版的全形空白是中文內容，不是程式碼 ——
  // no-irregular-whitespace 要抓的是不小心打進程式裡的怪空白，不是這個。
  // 而且這些檔是生成的，手改會在下次重跑腳本時被蓋掉。
  {
    files: ['web/src/app/**/*Markup.ts'],
    rules: { 'no-irregular-whitespace': 'off' },
  },

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

  // Canonical lab JavaScript is also bundled by the judge view. Lint its JS rules,
  // without pretending that the generated runtime is a TypeScript project file.
  {
    ...tseslint.configs.disableTypeChecked,
    files: [
      'web/src/features/bracket/bracketTreeRuntime.js',
      'web/src/features/sportsbook/*Runtime.js',
    ],
    languageOptions: { parserOptions: { projectService: false } },
  },

  {
    files: ['web/src/features/sportsbook/*Runtime.js'],
    rules: { 'no-irregular-whitespace': ['error', { skipComments: true, skipRegExps: true }] },
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
