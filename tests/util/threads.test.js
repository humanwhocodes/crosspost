/**
 * @fileoverview Tests for thread utilities.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import {
	ThreadError,
	joinThreadEntries,
	postThreadEntries,
	splitThread,
	validateThreadEntries,
} from "../../src/util/threads.js";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("validateThreadEntries()", () => {
	it("should throw when entries is not an array", () => {
		assert.throws(
			() => validateThreadEntries("nope"),
			new TypeError("Expected an array argument."),
		);
	});

	it("should throw when entries is empty", () => {
		assert.throws(
			() => validateThreadEntries([]),
			new TypeError("Expected at least one entry."),
		);
	});

	it("should throw when an entry has no message", () => {
		assert.throws(
			() => validateThreadEntries([{ message: "First" }, {}]),
			new TypeError("Missing message in thread entry 2."),
		);
	});

	it("should throw when an entry has invalid images", () => {
		assert.throws(
			() => validateThreadEntries([{ message: "First", images: "nope" }]),
			new TypeError("images must be an array."),
		);
	});

	it("should not throw for valid entries", () => {
		assert.doesNotThrow(() =>
			validateThreadEntries([
				{ message: "First" },
				{
					message: "Second",
					images: [{ data: new Uint8Array([1]), alt: "Image" }],
				},
			]),
		);
	});
});

describe("postThreadEntries()", () => {
	it("should post entries in order with the previous responses", async () => {
		const calls = [];

		const responses = await postThreadEntries(
			[{ message: "First" }, { message: "Second" }],
			undefined,
			async (entry, previous) => {
				calls.push([entry.message, [...previous]]);
				return `${entry.message}!`;
			},
		);

		assert.deepStrictEqual(responses, ["First!", "Second!"]);
		assert.deepStrictEqual(calls, [
			["First", []],
			["Second", ["First!"]],
		]);
	});

	it("should throw a ThreadError with the published responses when an entry fails", async () => {
		const cause = new Error("boom");

		await assert.rejects(
			postThreadEntries(
				[
					{ message: "First" },
					{ message: "Second" },
					{ message: "Third" },
				],
				undefined,
				async entry => {
					if (entry.message === "Second") {
						throw cause;
					}

					return entry.message;
				},
			),
			error => {
				assert.ok(error instanceof ThreadError);
				assert.strictEqual(
					error.message,
					"Failed to post entry 2 of 3 in the thread: boom",
				);
				assert.deepStrictEqual(error.responses, ["First"]);
				assert.strictEqual(error.cause, cause);
				return true;
			},
		);
	});

	it("should stop posting when the signal is aborted", async () => {
		const controller = new AbortController();
		const posted = [];

		await assert.rejects(
			postThreadEntries(
				[{ message: "First" }, { message: "Second" }],
				{ signal: controller.signal },
				async entry => {
					posted.push(entry.message);
					controller.abort();
					return entry.message;
				},
			),
			error => {
				assert.ok(error instanceof ThreadError);
				assert.deepStrictEqual(error.responses, ["First"]);
				assert.strictEqual(error.cause.name, "AbortError");
				return true;
			},
		);

		assert.deepStrictEqual(posted, ["First"]);
	});
});

describe("joinThreadEntries()", () => {
	it("should join messages with blank lines and combine images", () => {
		const image1 = { data: new Uint8Array([1]), alt: "One" };
		const image2 = { data: new Uint8Array([2]), alt: "Two" };

		assert.deepStrictEqual(
			joinThreadEntries([
				{ message: "First", images: [image1] },
				{ message: "Second" },
				{ message: "Third", images: [image2] },
			]),
			{
				message: "First\n\nSecond\n\nThird",
				images: [image1, image2],
			},
		);
	});

	it("should return undefined images when no entry has images", () => {
		assert.deepStrictEqual(
			joinThreadEntries([{ message: "First" }, { message: "Second" }]),
			{
				message: "First\n\nSecond",
				images: undefined,
			},
		);
	});
});

describe("splitThread()", () => {
	it("should split at lines containing only ---", () => {
		assert.deepStrictEqual(splitThread("First\n---\nSecond\n---\nThird"), [
			"First",
			"Second",
			"Third",
		]);
	});

	it("should keep line breaks within an entry", () => {
		assert.deepStrictEqual(splitThread("Line 1\nLine 2\n---\nSecond"), [
			"Line 1\nLine 2",
			"Second",
		]);
	});

	it("should handle Windows line endings", () => {
		assert.deepStrictEqual(splitThread("First\r\n---\r\nSecond\r\n"), [
			"First",
			"Second",
		]);
	});

	it("should allow spaces around the separator", () => {
		assert.deepStrictEqual(splitThread("First\n  ---\t\nSecond"), [
			"First",
			"Second",
		]);
	});

	it("should not split at --- within a line or longer dashes", () => {
		assert.deepStrictEqual(splitThread("First---Second\n----\nThird"), [
			"First---Second\n----\nThird",
		]);
	});

	it("should drop empty entries", () => {
		assert.deepStrictEqual(
			splitThread("---\nFirst\n---\n\n---\nSecond\n---\n"),
			["First", "Second"],
		);
	});

	it("should return one entry when there's no separator", () => {
		assert.deepStrictEqual(splitThread("Just one post"), ["Just one post"]);
	});
});
