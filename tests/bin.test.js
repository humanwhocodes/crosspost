/**
 * @fileoverview Tests for the bin file.
 * @author Nicholas C. Zakas
 */

/* global clearTimeout */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { strict as assert } from "node:assert";
import { fork } from "node:child_process";
import path from "node:path";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const executablePath = path.resolve("src/bin.js");

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("bin", function () {
	it("should not print anything to stdout", done => {
		const child = fork(executablePath, ["--mcp", "-l"], {
			env: {
				LINKEDIN_ACCESS_TOKEN: "foo",
			},
			stdio: "pipe",
		});

		const tid = setTimeout(() => {
			child.kill();
		}, 500);

		let failed;

		// check if anything comes out on stdout and fail if so
		child.stdout.on("data", data => {
			clearTimeout(tid);
			failed = data;
			child.kill();
		});

		child.on("exit", () => {
			clearTimeout(tid);

			if (failed) {
				assert.fail(`stdout was not empty:${failed}`);
			}

			done();
		});
	});
});
