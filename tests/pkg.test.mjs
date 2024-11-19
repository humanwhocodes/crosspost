/**
 * @fileoverview Tests that ESM can access npm package.
 */

import fs from "fs";
import assert from "node:assert";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const url = new URL("../" + pkg.exports.import.default, import.meta.url);

import(`${url}`).then(({ Client }) => {
    assert.strictEqual(typeof Client, "function");
    console.log("ESM load: success");
});
