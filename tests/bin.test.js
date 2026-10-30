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
import fs from "node:fs";
import path from "node:path";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const executablePath = path.resolve("src/bin.js");
const builtExecutablePath = path.resolve("dist/bin.js");

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

	describe("version flag", function () {
		it("should display version with --version flag", done => {
			const child = fork(builtExecutablePath, ["--version"], {
				stdio: "pipe",
			});

			let output = "";

			child.stdout.on("data", data => {
				output += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 0);
				assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
				done();
			});
		});

		it("should display version with -v flag", done => {
			const child = fork(builtExecutablePath, ["-v"], {
				stdio: "pipe",
			});

			let output = "";

			child.stdout.on("data", data => {
				output += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 0);
				assert.match(output.trim(), /^\d+\.\d+\.\d+$/);
				done();
			});
		});

		it("should display correct version from package.json", done => {
			// Read the actual version from package.json
			const packagePath = path.resolve("package.json");
			const packageJson = JSON.parse(
				fs.readFileSync(packagePath, "utf8"),
			);
			const expectedVersion = packageJson.version;

			const child = fork(builtExecutablePath, ["--version"], {
				stdio: "pipe",
			});

			let output = "";

			child.stdout.on("data", data => {
				output += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 0);
				assert.strictEqual(output.trim(), expectedVersion);
				done();
			});
		});
	});

	describe("image flags", function () {
		it("should exit with an error when --image and --image-url are both used", done => {
			const child = fork(
				builtExecutablePath,
				[
					"-t",
					"--image",
					"photo.png",
					"--image-url",
					"https://example.com/photo.png",
					"Hello",
				],
				{
					stdio: "pipe",
				},
			);

			let errorOutput = "";

			child.stderr.on("data", data => {
				errorOutput += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 1);
				assert.match(
					errorOutput,
					/--image and --image-url cannot be used together/u,
				);
				done();
			});
		});

		it("should exit with an error when --image-url is not an http or https URL", done => {
			const child = fork(
				builtExecutablePath,
				["-t", "--image-url", "file:///etc/passwd", "Hello"],
				{
					env: {
						TWITTER_API_CONSUMER_KEY: "foo",
						TWITTER_API_CONSUMER_SECRET: "foo",
						TWITTER_ACCESS_TOKEN_KEY: "foo",
						TWITTER_ACCESS_TOKEN_SECRET: "foo",
					},
					stdio: "pipe",
				},
			);

			let errorOutput = "";

			child.stderr.on("data", data => {
				errorOutput += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 1);
				assert.match(
					errorOutput,
					/Error downloading image: Unsupported URL protocol: file:/u,
				);
				done();
			});
		});
	});

	describe("thread flag", function () {
		it("should exit with an error when --thread is used with --mcp", done => {
			const child = fork(
				builtExecutablePath,
				["--mcp", "--thread", "-t"],
				{
					stdio: "pipe",
				},
			);

			let errorOutput = "";

			child.stderr.on("data", data => {
				errorOutput += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 1);
				assert.match(
					errorOutput,
					/--thread cannot be used with --mcp/u,
				);
				done();
			});
		});

		it("should exit with an error when the thread has no messages", done => {
			const child = fork(
				builtExecutablePath,
				["-t", "--thread", " --- "],
				{
					env: {
						TWITTER_API_CONSUMER_KEY: "foo",
						TWITTER_API_CONSUMER_SECRET: "foo",
						TWITTER_ACCESS_TOKEN_KEY: "foo",
						TWITTER_ACCESS_TOKEN_SECRET: "foo",
					},
					stdio: "pipe",
				},
			);

			let errorOutput = "";

			child.stderr.on("data", data => {
				errorOutput += data.toString();
			});

			child.on("exit", code => {
				assert.strictEqual(code, 1);
				assert.match(
					errorOutput,
					/The thread doesn't contain any messages/u,
				);
				done();
			});
		});
	});
});
