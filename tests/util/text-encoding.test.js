/**
 * @fileoverview Tests for text encoding utilities.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { encodeToUnicode } from "../../src/util/text-encoding.js";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("text-encoding", () => {
	describe("encodeToUnicode()", () => {
		const testCases = [
			{
				input: "This is a test message with an emoji: 😊",
				expected:
					"This is a test message with an emoji: \\ud83d\\ude0a",
			},
			{
				input: "Hello, world! 🌍",
				expected: "Hello, world! \\ud83c\\udf0d",
			},
			{
				input: "✨ example mentioning @atproto.com to share the URL 👨‍❤️‍👨",
				expected:
					"\\u2728 example mentioning @atproto.com to share the URL \\ud83d\\udc68\\u200d\\u2764\\ufe0f\\u200d\\ud83d\\udc68",
			},
			{
				input: "สวัสดีชาวโลก!\nHello World!",
				expected:
					"\\u0e2a\\u0e27\\u0e31\\u0e2a\\u0e14\\u0e35\\u0e0a\\u0e32\\u0e27\\u0e42\\u0e25\\u0e01!\nHello World!",
			},
			{
				input: "Line 1\nLine 2\nLine 3",
				expected: "Line 1\nLine 2\nLine 3",
			},
		];

		testCases.forEach(({ input, expected }) => {
			it(`should correctly encode: ${input}`, () => {
				const result = encodeToUnicode(input);
				assert.strictEqual(result, expected);
			});
		});

		it("should not modify ASCII characters", () => {
			const input = "Hello, world! 123";
			assert.strictEqual(encodeToUnicode(input), input);
		});

		it("should preserve newlines", () => {
			const input = "Hello\nWorld\n!";
			assert.strictEqual(encodeToUnicode(input), "Hello\nWorld\n!");
		});
	});
});
