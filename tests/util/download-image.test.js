/**
 * @fileoverview Tests for the image download utility.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { downloadImage } from "../../src/util/download-image.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures", "images");

// RIFF....WEBP header
const WEBP_DATA = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("downloadImage()", () => {
	/** @type {http.Server} */
	let server;
	let baseUrl;
	let pngData;

	before(async () => {
		pngData = await readFile(join(FIXTURES_DIR, "smiley.png"));

		server = http.createServer((req, res) => {
			switch (req.url) {
				case "/smiley.png":
				case "/my%20smiley.png":
					res.writeHead(200, { "content-type": "image/png" });
					res.end(pngData);
					break;

				case "/no-content-type":
					res.writeHead(200);
					res.end(pngData);
					break;

				case "/chunked.png":
					// no content-length, so the size can only be known by reading
					res.writeHead(200, { "content-type": "image/png" });
					res.write(pngData);
					res.end(pngData);
					break;

				case "/page.html":
					res.writeHead(200, { "content-type": "text/html" });
					res.end("<html></html>");
					break;

				case "/photo.webp":
					res.writeHead(200, { "content-type": "image/webp" });
					res.end(WEBP_DATA);
					break;

				case "/mislabeled.png":
					res.writeHead(200, { "content-type": "image/png" });
					res.end(WEBP_DATA);
					break;

				case "/empty.png":
					res.writeHead(200, {
						"content-type": "image/png",
						"content-length": "0",
					});
					res.end();
					break;

				case "/slow.png":
					// never respond
					break;

				default:
					res.writeHead(404, { "content-type": "image/png" });
					res.end("Not Found");
			}
		});

		await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
		const address = /** @type {import("node:net").AddressInfo} */ (
			server.address()
		);
		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	after(done => {
		server.closeAllConnections();
		server.close(done);
	});

	it("should download a PNG image", async () => {
		const result = await downloadImage(`${baseUrl}/smiley.png`);

		assert.deepStrictEqual(result.data, new Uint8Array(pngData));
		assert.strictEqual(result.url, `${baseUrl}/smiley.png`);
		assert.strictEqual(result.filename, "smiley.png");
	});

	it("should decode the filename", async () => {
		const result = await downloadImage(`${baseUrl}/my%20smiley.png`);

		assert.strictEqual(result.filename, "my smiley.png");
	});

	it("should accept an image without a content-type", async () => {
		const result = await downloadImage(`${baseUrl}/no-content-type`);

		assert.deepStrictEqual(result.data, new Uint8Array(pngData));
	});

	it("should throw a TypeError for an invalid URL", async () => {
		await assert.rejects(
			downloadImage("not a url"),
			new TypeError("Invalid URL: not a url"),
		);
	});

	it("should throw a TypeError for a non-HTTP URL", async () => {
		await assert.rejects(
			downloadImage("file:///etc/passwd"),
			new TypeError(
				"Unsupported URL protocol: file: (only http: and https: are supported).",
			),
		);
	});

	it("should throw an error with the status for a non-2xx response", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/missing.png`),
			/The server responded with 404 Not Found\./u,
		);
	});

	it("should throw an error for a non-image content-type", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/page.html`),
			/The URL did not return an image \(content-type: text\/html\)\./u,
		);
	});

	it("should throw an error for an unsupported image format", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/photo.webp`),
			/Unsupported image format \(content-type: image\/webp\)\. Only PNG, JPEG, and GIF are supported\./u,
		);
	});

	it("should throw an error when the content-type doesn't match the data", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/mislabeled.png`),
			/Unsupported image format/u,
		);
	});

	it("should throw an error for an empty response", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/empty.png`),
			/The server returned an empty response\./u,
		);
	});

	it("should throw an error when content-length exceeds the maximum", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/smiley.png`, { maxBytes: 10 }),
			/The image is larger than the maximum of 10 bytes\./u,
		);
	});

	it("should throw an error when the body exceeds the maximum without a content-length", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/chunked.png`, {
				maxBytes: pngData.length + 1,
			}),
			new RegExp(
				`The image is larger than the maximum of ${pngData.length + 1} bytes\\.`,
				"u",
			),
		);
	});

	it("should throw an error when the download times out", async () => {
		await assert.rejects(
			downloadImage(`${baseUrl}/slow.png`, { timeout: 50 }),
			/The download timed out after 50ms\./u,
		);
	});
});
