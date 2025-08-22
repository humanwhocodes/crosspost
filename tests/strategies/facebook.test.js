/**
 * @fileoverview Tests for the FacebookStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { FacebookStrategy } from "../../src/strategies/facebook.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const ACCESS_TOKEN = "test-token-123";
const POST_URL = "/v18.0/me/feed";
const PHOTO_URL = "/v18.0/me/photos";

const CREATE_POST_RESPONSE = {
	id: "123456789_987654321",
};

const CREATE_PHOTO_RESPONSE = {
	id: "photo123456789",
	post_id: "123456789_987654321",
};

const server = new MockServer("https://graph.facebook.com");
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("FacebookStrategy", () => {
	describe("constructor", () => {
		it("should throw a TypeError if access token is missing", () => {
			assert.throws(
				() => new FacebookStrategy({}),
				{
					name: "TypeError",
					message: "Missing access token.",
				},
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.strictEqual(strategy.id, "facebook");
			assert.strictEqual(strategy.name, "Facebook");
		});
	});

	describe("post", () => {
		beforeEach(() => {
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			await assert.rejects(
				() => strategy.post(""),
				{
					name: "TypeError",
					message: "Missing message to post.",
				},
			);
		});

		it("should successfully post a message", async () => {
			server.post(
				{
					url: POST_URL,
				},
				{
					status: 200,
					body: CREATE_POST_RESPONSE,
				},
			);

			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const result = await strategy.post("Hello, world!");

			assert.deepStrictEqual(result, CREATE_POST_RESPONSE);
		});

		it("should handle post failure", async () => {
			server.post(
				{
					url: POST_URL,
				},
				{
					status: 401,
					body: {
						error: {
							message: "Invalid access token",
							type: "OAuthException",
							code: 190,
						},
					},
				},
			);

			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			await assert.rejects(
				() => strategy.post("Hello, world!"),
				{
					name: "Error",
					message: "401 Failed to create post: Invalid access token",
				},
			);
		});

		it("should successfully post a message with an image", async () => {
			server.post(
				{
					url: PHOTO_URL,
				},
				{
					status: 200,
					body: CREATE_PHOTO_RESPONSE,
				},
			);

			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const imageData = new Uint8Array([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 
				0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
			]);

			const result = await strategy.post("Hello with image!", {
				images: [{ data: imageData, alt: "Test image" }],
			});

			assert.deepStrictEqual(result, CREATE_PHOTO_RESPONSE);
		});

		it("should handle image upload failure", async () => {
			server.post(
				{
					url: PHOTO_URL,
				},
				{
					status: 400,
					body: {
						error: {
							message: "Invalid image format",
							type: "FacebookApiException",
							code: 1,
						},
					},
				},
			);

			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			// Use valid PNG header to pass image type validation
			const imageData = new Uint8Array([
				0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 
				0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
			]);

			await assert.rejects(
				() => strategy.post("Hello with image!", {
					images: [{ data: imageData }],
				}),
				{
					name: "Error",
					message: "400 Failed to create photo post: Invalid image format",
				},
			);
		});

		it("should throw a TypeError if images is not an array", async () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			await assert.rejects(
				() => strategy.post("Hello, world!", {
					images: "not an array",
				}),
				{
					name: "TypeError",
					message: "images must be an array.",
				},
			);
		});

		it("should throw a TypeError if image is missing data", async () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			await assert.rejects(
				() => strategy.post("Hello, world!", {
					images: [{}],
				}),
				{
					name: "TypeError",
					message: "Image must have data.",
				},
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			await assert.rejects(
				() => strategy.post("Hello, world!", {
					images: [{ data: "not a Uint8Array" }],
				}),
				{
					name: "TypeError",
					message: "Image data must be a Uint8Array.",
				},
			);
		});

		it("should abort when signal is triggered", async () => {
			server.post(
				{
					url: POST_URL,
				},
				{
					status: 200,
					body: CREATE_POST_RESPONSE,
					delay: 100,
				},
			);

			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const controller = new AbortController();
			setTimeout(() => controller.abort(), 50);

			await assert.rejects(
				() => strategy.post("Hello, world!", {
					signal: controller.signal,
				}),
				{
					name: "AbortError",
					message: "This operation was aborted",
				},
			);
		});
	});

	describe("getUrlFromResponse", () => {
		it("should generate the correct URL from a post response", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const response = { id: "123456789_987654321" };
			const url = strategy.getUrlFromResponse(response);

			assert.strictEqual(url, "https://www.facebook.com/123456789/posts/987654321");
		});

		it("should generate the correct URL from a photo response", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const response = { 
				id: "photo123456789",
				post_id: "123456789_987654321"
			};
			const url = strategy.getUrlFromResponse(response);

			assert.strictEqual(url, "https://www.facebook.com/123456789/posts/987654321");
		});

		it("should handle fallback URL format for different ID formats", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const response = { id: "simple123456789" };
			const url = strategy.getUrlFromResponse(response);

			assert.strictEqual(url, "https://www.facebook.com/posts/simple123456789");
		});

		it("should throw an error when the ID is missing", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.throws(
				() => strategy.getUrlFromResponse({}),
				{
					name: "Error",
					message: "Post ID not found in response",
				},
			);
		});

		it("should throw an error when the response is null", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.throws(
				() => strategy.getUrlFromResponse(null),
				{
					name: "Error",
					message: "Post ID not found in response",
				},
			);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 63206);
		});
	});

	describe("calculateMessageLength", () => {
		it("should calculate length of plain text correctly", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello, world!"), 13);
		});

		it("should calculate length of Unicode text correctly", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.strictEqual(strategy.calculateMessageLength("Hello, 🌍!"), 9);
		});

		it("should calculate length of empty string correctly", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			assert.strictEqual(strategy.calculateMessageLength(""), 0);
		});

		it("should calculate length of text with URLs correctly", () => {
			const strategy = new FacebookStrategy({
				accessToken: ACCESS_TOKEN,
			});

			const message = "Check this out: https://example.com/very-long-url-path";
			assert.strictEqual(strategy.calculateMessageLength(message), message.length);
		});
	});
});