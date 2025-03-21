/**
 * @fileoverview Tests for image utility functions.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { getImageMimeType } from "../../src/util/images.js";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "images");

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("getImageMimeType()", () => {
	it("should return image/png for PNG files", async () => {
		const pngData = await readFile(join(FIXTURES_DIR, "smiley.png"));
		assert.strictEqual(
			getImageMimeType(new Uint8Array(pngData)),
			"image/png",
		);
	});

	it("should return image/jpeg for JPEG files", async () => {
		const jpegData = await readFile(join(FIXTURES_DIR, "smiley.jpg"));
		assert.strictEqual(
			getImageMimeType(new Uint8Array(jpegData)),
			"image/jpeg",
		);
	});

	it("should return image/jpeg for JPEG files", async () => {
		assert.strictEqual(
			getImageMimeType(new Uint8Array([0xff, 0xd8, 0xff])),
			"image/jpeg",
		);
	});

	it("should return image/gif for GIF files", async () => {
		const gifData = await readFile(join(FIXTURES_DIR, "smiley.gif"));
		assert.strictEqual(
			getImageMimeType(new Uint8Array(gifData)),
			"image/gif",
		);
	});

	it("should throw TypeError for files with insufficient data", () => {
		assert.throws(
			() => getImageMimeType(new Uint8Array([0x89, 0x50])),
			TypeError,
		);
		assert.throws(() => getImageMimeType(new Uint8Array([])), TypeError);
	});

	it("should throw TypeError for unsupported image types", () => {
		const fakeData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
		assert.throws(() => getImageMimeType(fakeData), TypeError);
	});

	it("should handle null or undefined input gracefully", () => {
		assert.throws(() => getImageMimeType(null), TypeError);
		assert.throws(() => getImageMimeType(undefined), TypeError);
	});
});
