export default [
    {
        input: "src/index.js",
        output: [
            {
                file: "dist/index.cjs",
                format: "cjs"
            },
            {
                file: "dist/index.mjs",
                format: "esm"
            },
            {
                file: "dist/index.js",
                format: "esm",
                banner: "// @ts-self-types=\"./index.d.ts\""
            }
        ]
    }  
];
