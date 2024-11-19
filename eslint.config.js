import js from "@eslint/js";

export default [
	{
		ignores: ["tests/fixtures"],
	},
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				process: false,
				URL: false,
				console: false,
			},
		},
		rules: {
			indent: ["error", 4],
			"linebreak-style": ["error", "unix"],
			quotes: ["error", "double"],
			semi: ["error", "always"],
		},
	},
	{
		files: ["tests/**/*.js"],
		languageOptions: {
			globals: {
				describe: false,
				it: false,
				beforeEach: false,
				afterEach: false,
			},
		},
	},
];
