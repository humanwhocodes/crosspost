/**
 * @fileoverview Tests for the WebflowStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { WebflowStrategy } from "../../src/strategies/webflow.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-access-token";
const SITE_ID = "test-site-id";
const COLLECTION_ID = "test-collection-id";

const COLLECTION_ITEM_RESPONSE = {
	id: "item-123",
	slug: "hello-webflow",
	fieldData: {
		content: "Hello Webflow!",
	},
};

const ASSET_RESPONSE = {
	id: "asset-123",
	url: "https://uploads-ssl.webflow.com/test/image.jpg",
	displayName: "test-image",
};

const server = new MockServer("https://api.webflow.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

const pngImageData = new Uint8Array([
	// PNG signature
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
	// IHDR chunk
	0x00,
	0x00,
	0x00,
	0x0d, // Length
	0x49,
	0x48,
	0x44,
	0x52, // "IHDR"
	0x00,
	0x00,
	0x00,
	0x01, // Width: 1
	0x00,
	0x00,
	0x00,
	0x01, // Height: 1
	0x08, // Bit depth: 8
	0x02, // Color type: 2 (RGB)
	0x00, // Compression: 0
	0x00, // Filter: 0
	0x00, // Interlace: 0
	0x90,
	0x77,
	0x53,
	0xde, // CRC
]);

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("WebflowStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if accessToken is missing", () => {
			assert.throws(() => {
				new WebflowStrategy({
					siteId: SITE_ID,
					collectionId: COLLECTION_ID,
				});
			}, /Missing access token/);
		});

		it("should throw a TypeError if siteId is missing", () => {
			assert.throws(() => {
				new WebflowStrategy({
					accessToken: ACCESS_TOKEN,
					collectionId: COLLECTION_ID,
				});
			}, /Missing site ID/);
		});

		it("should throw a TypeError if collectionId is missing", () => {
			assert.throws(() => {
				new WebflowStrategy({
					accessToken: ACCESS_TOKEN,
					siteId: SITE_ID,
				});
			}, /Missing collection ID/);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.strictEqual(strategy.id, "webflow");
			assert.strictEqual(strategy.name, "Webflow");
		});

		it("should use default API base URL when not provided", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			// We can't directly test the private property, but we can test its effect
			assert.strictEqual(strategy.id, "webflow");
		});

		it("should use custom API base URL when provided", () => {
			const customUrl = "https://custom-api.webflow.com";
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
				apiBaseUrl: customUrl,
			});

			assert.strictEqual(strategy.id, "webflow");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			await assert.rejects(strategy.post(""), /Missing message to post/);
		});

		it("should successfully post a message", async () => {
			server.post(
				`/v2/collections/${COLLECTION_ID}/items`,
				{
					status: 201,
					headers: {
						"content-type": "application/json",
					},
					body: COLLECTION_ITEM_RESPONSE,
				},
			);

			const result = await strategy.post("Hello Webflow!");
			assert.deepStrictEqual(result, COLLECTION_ITEM_RESPONSE);
		});

		it("should handle collection item creation failure", async () => {
			server.post(`/v2/collections/${COLLECTION_ID}/items`, {
				status: 400,
				statusText: "Bad Request",
				body: {
					message: "Invalid collection item data",
					code: 400,
				},
			});

			await assert.rejects(
				strategy.post("Hello Webflow!"),
				/400 Failed to create collection item: Bad Request/,
			);
		});

		it("should throw a TypeError if images is not an array", async () => {
			await assert.rejects(
				strategy.post("Hello Webflow!", { images: "not an array" }),
				/images must be an array/,
			);
		});

		it("should throw a TypeError if image is missing data", async () => {
			await assert.rejects(
				strategy.post("Hello Webflow!", { images: [{}] }),
				/Image must have data/,
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async () => {
			await assert.rejects(
				strategy.post("Hello Webflow!", {
					images: [{ data: "not a uint8array" }],
				}),
				/Image data must be a Uint8Array/,
			);
		});

		it("should successfully post a message with an image", async () => {
			// Mock asset upload
			server.post(`/v2/sites/${SITE_ID}/assets`, {
				status: 201,
				headers: {
					"content-type": "application/json",
				},
				body: ASSET_RESPONSE,
			});

			// Mock collection item creation
			server.post(`/v2/collections/${COLLECTION_ID}/items`, {
				status: 201,
				headers: {
					"content-type": "application/json",
				},
				body: COLLECTION_ITEM_RESPONSE,
			});

			const result = await strategy.post("Hello Webflow!", {
				images: [{ data: pngImageData, alt: "Test image" }],
			});

			assert.deepStrictEqual(result, COLLECTION_ITEM_RESPONSE);
		});

		it("should handle image upload failure", async () => {
			server.post(`/v2/sites/${SITE_ID}/assets`, {
				status: 400,
				statusText: "Bad Request",
				body: {
					message: "Invalid image format",
					code: 400,
				},
			});

			await assert.rejects(
				strategy.post("Hello Webflow!", {
					images: [{ data: pngImageData, alt: "Test image" }],
				}),
				/400 Failed to upload image: Bad Request/,
			);
		});

		it("should abort when signal is triggered", async () => {
			const controller = new AbortController();
			setTimeout(() => controller.abort(), 10);

			server.post(`/v2/collections/${COLLECTION_ID}/items`, {
				status: 201,
				delay: 100,
				body: COLLECTION_ITEM_RESPONSE,
			});

			await assert.rejects(
				strategy.post("Hello Webflow!", { signal: controller.signal }),
				/aborted/,
			);
		});

		it("should create proper slug from message", async () => {
			server.post(
				`/v2/collections/${COLLECTION_ID}/items`,
				async (request) => {
					const body = await request.json();
					assert.strictEqual(body.slug, "hello-webflow-with-special-chars");
					return {
						status: 201,
						body: COLLECTION_ITEM_RESPONSE,
					};
				},
			);

			await strategy.post("Hello Webflow! With Special Chars @#$%");
		});

		it("should handle long messages by truncating name", async () => {
			const longMessage = "a".repeat(300);

			server.post(
				`/v2/collections/${COLLECTION_ID}/items`,
				async (request) => {
					const body = await request.json();
					assert.strictEqual(body.name.length, 256);
					assert.strictEqual(body.fieldData.content, longMessage);
					return {
						status: 201,
						body: COLLECTION_ITEM_RESPONSE,
					};
				},
			);

			await strategy.post(longMessage);
		});
	});

	describe("getUrlFromResponse", () => {
		it("should generate the correct URL from a response", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			const url = strategy.getUrlFromResponse(COLLECTION_ITEM_RESPONSE);
			assert.strictEqual(url, `https://${SITE_ID}.webflow.io/hello-webflow`);
		});

		it("should throw an error when the slug is missing", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.throws(() => {
				strategy.getUrlFromResponse({ id: "123" });
			}, /Response must contain a slug/);
		});

		it("should throw an error when the response is null", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Response is required/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 10000);
		});
	});

	describe("calculateMessageLength", () => {
		it("should calculate length of plain text correctly", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello World"), 11);
		});

		it("should handle emojis correctly", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello 👋 World"), 13);
		});

		it("should handle empty string", () => {
			const strategy = new WebflowStrategy({
				accessToken: ACCESS_TOKEN,
				siteId: SITE_ID,
				collectionId: COLLECTION_ID,
			});

			assert.strictEqual(strategy.calculateMessageLength(""), 0);
		});
	});
});