export default [
    {
        input: "src/index.js",
        output: [
            {
                file: "dist/cjs/index.cjs",
                format: "cjs"
            },
            {
                file: "dist/esm/index.js",
                format: "esm",
                banner: "// @ts-self-types=\"./index.d.ts\""
            }
        ]
    }  
];
