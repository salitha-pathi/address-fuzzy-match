// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');

// Note: switch recommendedTypeChecked once typescript-eslint supports TS >=7
// https://github.com/typescript-eslint/typescript-eslint/issues/10940
module.exports = tseslint.config(
	{ ignores: ['dist/**', 'coverage/**', 'jest.config.js', 'eslint.config.js'] },

	eslint.configs.recommended,
	tseslint.configs.recommended,

	// Disable ESLint formatting rules that conflict with Prettier
	prettier,

	{
		rules: {
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'eqeqeq': ['error', 'always'],
			'no-console': 'warn',
		},
	},

	// Relax rules in test files
	{
		files: ['src/**/__tests__/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
);
