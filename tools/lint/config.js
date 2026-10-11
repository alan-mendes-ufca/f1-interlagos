import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Config de lint em tools/lint porque o typescript-eslint precisa da API JS do TypeScript 5.x
// (o TypeScript 7 do projeto é nativo e não a expõe). Sem regras type-aware.
export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'tools/lint/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Estilo do projeto: sequências com vírgula em expressões de arte procedural (ex.: canvas).
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
  {
    files: ['**/*.test.ts'],
    languageOptions: { globals: { ...globals.jest } },
  },
);
