/**
 * @fileoverview Tests that Common JS can access npm package.
 */

const { Retrier } = require("../");
new Retrier(() => {});
console.log("CommonJS load: success");
