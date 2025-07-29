import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.env*',
      '*.log',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.git/**',
      '.vscode/**',
      '.idea/**',
      '.husky/**',
      '**/prisma/client/**',
      'webpack.config.js',
      'commitlint.config.js',
      '**/data/**',
      '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prettier 集成
      'prettier/prettier': 'error',

      // TypeScript 基础规则
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // 代码质量基础规则
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',

      // NestJS 兼容
      'class-methods-use-this': 'off',
    },
  },
  // 种子文件特殊规则
  {
    files: ['src/prisma/seed/**/*.ts'],
    rules: {
      'no-console': 'off',
      'no-await-in-loop': 'off',
    },
  },
  // 测试文件特殊规则
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  }
);
