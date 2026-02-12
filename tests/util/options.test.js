/**
 * @fileoverview Tests for options utilities
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { validatePostOptions } from "../../src/util/options.js";

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("validatePostOptions()", () => {
	it("should not throw error when options is undefined", () => {
		assert.doesNotThrow(() => validatePostOptions());
	});

	it("should not throw error when options is empty object", () => {
		assert.doesNotThrow(() => validatePostOptions({}));
	});
	it("should throw error when images is not an array", () => {
		assert.throws(
			() => validatePostOptions({ images: {} }),
			new TypeError("images must be an array."),
		);
	});

	it("should throw error when image has no data", () => {
		assert.throws(
			() => validatePostOptions({ images: [{}] }),
			new TypeError("Image must have data."),
		);
	});

	it("should throw error when image data is not Uint8Array", () => {
		assert.throws(
			() => validatePostOptions({ images: [{ data: "hello" }] }),
			new TypeError("Image data must be a Uint8Array."),
		);
	});

	it("should not throw error when options are valid", () => {
		const options = {
			images: [{ data: new Uint8Array() }],
		};
		assert.doesNotThrow(() => validatePostOptions(options));
	});

	it("should throw error when cardPreview has no uri", () => {
		assert.throws(
			() =>
				validatePostOptions({
					cardPreview: { title: "t", description: "d" },
				}),
			new TypeError("Card preview must have a uri."),
		);
	});

	it("should throw error when cardPreview has no title", () => {
		assert.throws(
			() =>
				validatePostOptions({
					cardPreview: {
						uri: "https://example.com",
						description: "d",
					},
				}),
			new TypeError("Card preview must have a title."),
		);
	});

	it("should throw error when cardPreview has no description", () => {
		assert.throws(
			() =>
				validatePostOptions({
					cardPreview: { uri: "https://example.com", title: "t" },
				}),
			new TypeError("Card preview must have a description."),
		);
	});

	it("should throw error when cardPreview thumb is not Uint8Array", () => {
		assert.throws(
			() =>
				validatePostOptions({
					cardPreview: {
						uri: "https://example.com",
						title: "t",
						description: "d",
						thumb: "not bytes",
					},
				}),
			new TypeError("Card preview thumb must be a Uint8Array."),
		);
	});

	it("should not throw error when cardPreview is valid", () => {
		assert.doesNotThrow(() =>
			validatePostOptions({
				cardPreview: {
					uri: "https://example.com",
					title: "Example",
					description: "An example",
				},
			}),
		);
	});

	it("should not throw error when cardPreview has valid thumb", () => {
		assert.doesNotThrow(() =>
			validatePostOptions({
				cardPreview: {
					uri: "https://example.com",
					title: "Example",
					description: "An example",
					thumb: new Uint8Array(),
				},
			}),
		);
	});
});
