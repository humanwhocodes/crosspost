/**
 * @fileoverview Tests that ESM can access npm package.
 */

import fs from "fs";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));
const url = new URL("../" + pkg.exports.import.default, import.meta.url);

import(`${url}`).then(({ Retrier }) => {
    new Retrier(() => {});
    console.log("ESM load: success");
});
