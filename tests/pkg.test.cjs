/**
 * @fileoverview Tests that Common JS can access npm package.
 */

const assert = require("node:assert");
const { Client } = require("../");
assert.strictEqual(typeof Client, "function");
console.log("CommonJS load: success");
