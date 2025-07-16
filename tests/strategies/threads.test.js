/**
 * @fileoverview Tests for the ThreadsStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { ThreadsStrategy } from "../../src/strategies/threads.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const USER_ID = "123456789";
const ACCESS_TOKEN = "test_access_token";
const CREATE_CONTAINER_URL = `/v1.0/${USER_ID}/threads`;
const PUBLISH_POST_URL = `/v1.0/${USER_ID}/threads_publish`;

const CONTAINER_RESPONSE = {
	id: "container_123",
};

const POST_RESPONSE = {
	id: "post_123",
};

const ERROR_RESPONSE = {
	error: {
		message: "Invalid access token",
		type: "OAuthException",
		code: 190,
	},
};

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Creates a mock image.
 * @returns {Uint8Array} A mock PNG image.
 */
function createMockImage() {
	// PNG signature + minimal PNG data
	return new Uint8Array([
		137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
		0, 0, 0, 13, // IHDR chunk length
		73, 72, 68, 82, // IHDR
		0, 0, 0, 1, // width: 1
		0, 0, 0, 1, // height: 1
		8, // bit depth: 8
		2, // color type: RGB
		0, // compression method
		0, // filter method
		0, // interlace method
		144, 119, 53, 241, // CRC
	]);
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

const server = new MockServer("https://graph.threads.net");
const fetchMocker = new FetchMocker({
	servers: [server],
});

describe("ThreadsStrategy", () => {
	beforeEach(() => {
		fetchMocker.mockGlobal();
	});

	afterEach(() => {
		fetchMocker.unmockGlobal();
		server.clear();
	});

	describe("constructor", () => {
		it("should throw a TypeError if accessToken is missing", () => {
			assert.throws(() => {
				new ThreadsStrategy({ userId: USER_ID });
			}, /Missing access token/);
		});

		it("should throw a TypeError if userId is missing", () => {
			assert.throws(() => {
				new ThreadsStrategy({ accessToken: ACCESS_TOKEN });
			}, /Missing user ID/);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				userId: USER_ID,
			});

			assert.strictEqual(strategy.id, "threads");
			assert.strictEqual(strategy.name, "Threads");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				userId: USER_ID,
			});
		});

		it("should throw an Error if message is missing", async () => {
			await assert.rejects(
				async () => strategy.post(""),
				/Missing message to post/,
			);
		});

		it("should successfully post a message", async () => {
			server.post(
				{
					url: CREATE_CONTAINER_URL,
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CONTAINER_RESPONSE,
				},
			);

			server.post(
				{
					url: PUBLISH_POST_URL,
					headers: {
						"content-type": "application/x-www-form-urlencoded",
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: POST_RESPONSE,
				},
			);

			const result = await strategy.post("Hello, Threads!");

			assert.deepStrictEqual(result, POST_RESPONSE);
		});

		it("should handle container creation failure", async () => {
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
					body: ERROR_RESPONSE,
				},
			);

			await assert.rejects(
				async () => strategy.post("Hello, Threads!"),
				/Failed to create container/,
			);
		});

		it("should handle post publish failure", async () => {
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CONTAINER_RESPONSE,
				},
			);

			server.post(
				{ url: PUBLISH_POST_URL },
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
					body: ERROR_RESPONSE,
				},
			);

			await assert.rejects(
				async () => strategy.post("Hello, Threads!"),
				/Failed to publish post/,
			);
		});

		it("should successfully post a message with emojis", async () => {
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CONTAINER_RESPONSE,
				},
			);

			server.post(
				{ url: PUBLISH_POST_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: POST_RESPONSE,
				},
			);

			const result = await strategy.post("Hello 👋 Threads! 🧵");

			assert.deepStrictEqual(result, POST_RESPONSE);
		});

		it("should throw a TypeError if images is not an array", async () => {
			await assert.rejects(
				async () =>
					strategy.post("Hello", {
						images: "not an array",
					}),
				/images must be an array/,
			);
		});

		it("should throw a TypeError if image is missing data", async () => {
			await assert.rejects(
				async () =>
					strategy.post("Hello", {
						images: [{ alt: "test" }],
					}),
				/Image must have data/,
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async () => {
			await assert.rejects(
				async () =>
					strategy.post("Hello", {
						images: [{ data: "not a Uint8Array" }],
					}),
				/Image data must be a Uint8Array/,
			);
		});

		it("should successfully post a message with an image", async () => {
			const imageUploadResponse = { id: "media_123" };

			// Mock image upload
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: imageUploadResponse,
				},
			);

			// Mock container creation
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CONTAINER_RESPONSE,
				},
			);

			// Mock post publish
			server.post(
				{ url: PUBLISH_POST_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: POST_RESPONSE,
				},
			);

			const mockImage = createMockImage();
			const result = await strategy.post("Hello with image!", {
				images: [{ data: mockImage, alt: "A test image" }],
			});

			assert.deepStrictEqual(result, POST_RESPONSE);
		});

		it("should handle image upload failure", async () => {
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 400,
					headers: {
						"content-type": "application/json",
					},
					body: ERROR_RESPONSE,
				},
			);

			const mockImage = createMockImage();

			await assert.rejects(
				async () =>
					strategy.post("Hello with image!", {
						images: [{ data: mockImage }],
					}),
				/Failed to upload image/,
			);
		});

		it("should abort when signal is triggered", async () => {
			server.post(
				{ url: CREATE_CONTAINER_URL },
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: CONTAINER_RESPONSE,
					delay: 100,
				},
			);

			const controller = new AbortController();
			const promise = strategy.post("Hello, Threads!", {
				signal: controller.signal,
			});

			// Abort after a short delay
			setTimeout(() => controller.abort(), 50);

			await assert.rejects(promise, /aborted/);
		});
	});

	describe("getUrlFromResponse", () => {
		let strategy;

		beforeEach(() => {
			strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				userId: USER_ID,
			});
		});

		it("should generate the correct URL from a response", () => {
			const response = { id: "post_123" };
			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(url, "https://www.threads.net/t/post_123");
		});

		it("should throw an error when the ID is missing", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse({});
			}, /Post ID not found in response/);
		});

		it("should throw an error when the response is null", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Post ID not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			const strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				userId: USER_ID,
			});

			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 500);
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;

		beforeEach(() => {
			strategy = new ThreadsStrategy({
				accessToken: ACCESS_TOKEN,
				userId: USER_ID,
			});
		});

		it("should calculate length of plain text correctly", () => {
			assert.strictEqual(strategy.calculateMessageLength("Hello"), 5);
			assert.strictEqual(
				strategy.calculateMessageLength("Hello, world!"),
				13,
			);
		});

		it("should count emoji characters correctly", () => {
			assert.strictEqual(strategy.calculateMessageLength("👋"), 1);
			assert.strictEqual(strategy.calculateMessageLength("Hello 👋"), 7);
		});

		it("should count URLs at their actual length", () => {
			const messageWithUrl =
				"Check out https://example.com for more info";
			assert.strictEqual(
				strategy.calculateMessageLength(messageWithUrl),
				messageWithUrl.length,
			);
		});
	});
});