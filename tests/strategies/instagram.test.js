/**
 * @fileoverview Tests for the InstagramStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { InstagramStrategy } from "../../src/strategies/instagram.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const ACCOUNT_ID = "17841400000000000";
const CONTAINER_ID = "18000000000000000";
const MEDIA_ID = "17900000000000000";
const PERMALINK = "https://www.instagram.com/p/ABCDEFGHIJK/";

const CREATE_URL = `/v21.0/${ACCOUNT_ID}/media`;
const PUBLISH_URL = `/v21.0/${ACCOUNT_ID}/media_publish`;
const MEDIA_URL = `/v21.0/${MEDIA_ID}`;

const pngImageData = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
	0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0xff,
	0xff, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
	0x42, 0x60, 0x82,
]);

const server = new MockServer("https://graph.facebook.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Mocks the full happy-path posting flow (create container, publish, permalink).
 * @param {Object} [options] Options for the mocks.
 * @param {string} [options.expectedCaption] The caption expected in the container request.
 * @returns {void}
 */
function mockSuccessfulFlow({ expectedCaption } = {}) {
	server.post(CREATE_URL, async request => {
		const formData = await request.formData();

		assert.strictEqual(formData.get("access_token"), ACCESS_TOKEN);

		if (expectedCaption !== undefined) {
			assert.strictEqual(formData.get("caption"), expectedCaption);
		}

		const image = formData.get("image");
		assert.strictEqual(image.type, "image/png");

		return {
			status: 200,
			headers: { "content-type": "application/json" },
			body: { id: CONTAINER_ID },
		};
	});

	server.post(PUBLISH_URL, async request => {
		const formData = await request.formData();

		assert.strictEqual(formData.get("access_token"), ACCESS_TOKEN);
		assert.strictEqual(formData.get("creation_id"), CONTAINER_ID);

		return {
			status: 200,
			headers: { "content-type": "application/json" },
			body: { id: MEDIA_ID },
		};
	});

	server.get(
		{
			url: MEDIA_URL,
			query: {
				fields: "permalink",
				access_token: ACCESS_TOKEN,
			},
		},
		{
			status: 200,
			headers: { "content-type": "application/json" },
			body: { id: MEDIA_ID, permalink: PERMALINK },
		},
	);
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("InstagramStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => {
					new InstagramStrategy({ accountId: ACCOUNT_ID });
				},
				TypeError,
				"Missing Instagram access token.",
			);
		});

		it("should throw a TypeError if account ID is missing", () => {
			assert.throws(
				() => {
					new InstagramStrategy({ accessToken: ACCESS_TOKEN });
				},
				TypeError,
				"Missing Instagram account ID.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new InstagramStrategy({
				accessToken: ACCESS_TOKEN,
				accountId: ACCOUNT_ID,
			});
			assert.strictEqual(strategy.id, "instagram");
			assert.strictEqual(strategy.name, "Instagram");
		});
	});

	describe("post", () => {
		const options = { accessToken: ACCESS_TOKEN, accountId: ACCOUNT_ID };
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy(options);
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw a TypeError if message is missing", async () => {
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should throw a TypeError if no image is provided", async () => {
			await assert.rejects(async () => {
				await strategy.post("Hello, Instagram!");
			}, /Instagram requires an image to post\./);
		});

		it("should throw a TypeError if images array is empty", async () => {
			await assert.rejects(async () => {
				await strategy.post("Hello, Instagram!", { images: [] });
			}, /Instagram requires an image to post\./);
		});

		it("should successfully post a message with an image", async () => {
			const message = "Hello, Instagram!";
			mockSuccessfulFlow({ expectedCaption: message });

			const response = await strategy.post(message, {
				images: [{ alt: "Test image", data: pngImageData }],
			});

			assert.deepStrictEqual(response, {
				id: MEDIA_ID,
				permalink: PERMALINK,
			});
		});

		it("should use the first image when multiple are provided", async () => {
			const message = "Hello, Instagram!";
			mockSuccessfulFlow({ expectedCaption: message });

			const response = await strategy.post(message, {
				images: [
					{ alt: "First", data: pngImageData },
					{ alt: "Second", data: pngImageData },
				],
			});

			assert.deepStrictEqual(response, {
				id: MEDIA_ID,
				permalink: PERMALINK,
			});
		});

		it("should throw an error when container creation fails", async () => {
			server.post(CREATE_URL, {
				status: 400,
				headers: { "content-type": "application/json" },
				body: {
					error: {
						message: "Invalid image",
						type: "OAuthException",
						code: 100,
					},
				},
			});

			await assert.rejects(async () => {
				await strategy.post("Hello, Instagram!", {
					images: [{ alt: "Test image", data: pngImageData }],
				});
			}, /400 Failed to create media container: Invalid image/);
		});

		it("should throw an error when publishing fails", async () => {
			server.post(CREATE_URL, {
				status: 200,
				headers: { "content-type": "application/json" },
				body: { id: CONTAINER_ID },
			});

			server.post(PUBLISH_URL, {
				status: 400,
				headers: { "content-type": "application/json" },
				body: {
					error: {
						message: "Media not ready",
						type: "OAuthException",
						code: 9007,
					},
				},
			});

			await assert.rejects(async () => {
				await strategy.post("Hello, Instagram!", {
					images: [{ alt: "Test image", data: pngImageData }],
				});
			}, /400 Failed to publish media: Media not ready/);
		});

		it("should abort when the signal is triggered", async () => {
			const controller = new AbortController();

			server.post(CREATE_URL, {
				status: 200,
				headers: { "content-type": "application/json" },
				body: { id: CONTAINER_ID },
				delay: 100,
			});

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post("Hello, Instagram!", {
					images: [{ alt: "Test image", data: pngImageData }],
					signal: controller.signal,
				});
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy({
				accessToken: ACCESS_TOKEN,
				accountId: ACCOUNT_ID,
			});
		});

		it("should return the permalink from a response", () => {
			const url = strategy.getUrlFromResponse({
				id: MEDIA_ID,
				permalink: PERMALINK,
			});
			assert.strictEqual(url, PERMALINK);
		});

		it("should throw an error when the permalink is missing", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse({ id: MEDIA_ID });
			}, /Permalink not found in response/);
		});

		it("should throw an error when the response is null", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Permalink not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy({
				accessToken: ACCESS_TOKEN,
				accountId: ACCOUNT_ID,
			});
		});

		it("should have a MAX_MESSAGE_LENGTH property", () => {
			assert.ok(
				Object.prototype.hasOwnProperty.call(
					strategy,
					"MAX_MESSAGE_LENGTH",
				),
				"MAX_MESSAGE_LENGTH property is missing",
			);
			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 2200);
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy({
				accessToken: ACCESS_TOKEN,
				accountId: ACCOUNT_ID,
			});
		});

		it("should calculate length of plain text correctly", () => {
			const message = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(message),
				message.length,
			);
		});

		it("should count Unicode characters correctly", () => {
			const message = "Hello 👋 world";
			assert.strictEqual(
				strategy.calculateMessageLength(message),
				[...message].length,
			);
		});
	});
});
