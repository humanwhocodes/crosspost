export default [
	{
		input: "src/index.js",
		output: [
			{
				file: "dist/cjs/index.cjs",
				format: "cjs",
			},
			{
				file: "dist/esm/index.js",
				format: "esm",
				banner: '// @ts-self-types="./index.d.ts"',
			},
		],
	},
	{
		input: "src/bin.js",
		output: [
			{
				file: "dist/esm/bin.js",
				format: "esm",
				banner: "#!/usr/bin/env node\n",
			},
		],
	},
];
