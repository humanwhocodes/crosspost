/**
 * @fileoverview Tests for the DevtoStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import assert from "node:assert";
import { DevtoStrategy } from "../../src/strategies/devto.js";
import { MockServer, FetchMocker } from "mentoss";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const API_URL = "https://dev.to";
const API_KEY = "abc123";

const CREATE_ARTICLE_RESPONSE = {
	title: "Hello World",
	body_markdown: "Hello World\n\nThis is a test post.",
	published: true,
	tags: [],
	url: "https://dev.to/test/hello-world-123",
	canonical_url: "https://dev.to/test/hello-world-123",
	id: 123456,
};

const server = new MockServer(API_URL);
const fetchMocker = new FetchMocker({
	servers: [server],
});

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("DevtoStrategy", () => {
	let options;

	beforeEach(() => {
		options = {
			apiKey: API_KEY,
		};
	});

	describe("constructor", () => {
		it("should throw a TypeError if apiKey is missing", () => {
			assert.throws(
				() => {
					new DevtoStrategy({ ...options, apiKey: undefined });
				},
				TypeError,
				"Missing apiKey.",
			);
		});

		it("should create an instance with correct id and name", () => {
			const strategy = new DevtoStrategy(options);
			assert.strictEqual(strategy.id, "devto");
			assert.strictEqual(strategy.name, "Dev.to");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new DevtoStrategy(options);
			fetchMocker.mockGlobal();
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an Error if message is missing", async () => {
			await assert.rejects(
				async () => {
					await strategy.post();
				},
				TypeError,
				"Missing message to post.",
			);
		});

		it("should successfully post an article", async () => {
			const content = "Hello World\n\nThis is a test post.";

			server.post(
				{
					url: "/api/articles",
					headers: {
						"content-type": "application/json",
						"api-key": API_KEY,
					},
					body: {
						article: {
							title: "Hello World",
							body_markdown: content,
							published: true,
						},
					},
				},
				{
					status: 201,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_ARTICLE_RESPONSE,
				},
			);

			const response = await strategy.post(content);
			assert.deepStrictEqual(response, CREATE_ARTICLE_RESPONSE);
		});

		it("should handle post failure", async () => {
			server.post("/api/articles", {
				status: 422,
				body: {
					error: "Validation error",
					status: "422",
				},
			});

			await assert.rejects(async () => {
				await strategy.post("Hello World");
			}, /422 Unprocessable Entity: Failed to post article/);
		});

		it("should successfully post an article with images", async () => {
			const content = "Hello World\n\nThis is a test post.";
			const imageData = new Uint8Array([137, 80, 78, 71]); // Example PNG header
			const base64Data = "iVBORw=="; // Example base64 of the image data

			const expectedContent =
				content +
				"\n\n" +
				`![Test image](data:image/png;base64,${base64Data})\n\n` +
				`![Another image](data:image/png;base64,${base64Data})\n\n`;

			server.post(
				{
					url: "/api/articles",
					headers: {
						"content-type": "application/json",
						"api-key": API_KEY,
					},
					body: {
						article: {
							title: "Hello World",
							body_markdown: expectedContent,
							published: true,
						},
					},
				},
				{
					status: 201,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_ARTICLE_RESPONSE,
				},
			);

			const response = await strategy.post(content, {
				images: [
					{
						alt: "Test image",
						data: imageData,
					},
					{
						alt: "Another image",
						data: imageData,
					},
				],
			});

			assert.deepStrictEqual(response, CREATE_ARTICLE_RESPONSE);
		});

		it("should successfully post an article with JPEG images", async () => {
			const content = "Hello World\n\nThis is a test post.";
			const imageData = new Uint8Array([0xff, 0xd8, 0xff]); // JPEG header
			const base64Data = "/9j/"; // Example base64 of the image data

			const expectedContent =
				content +
				"\n\n" +
				`![Test image](data:image/jpeg;base64,${base64Data})\n\n`;

			server.post(
				{
					url: "/api/articles",
					headers: {
						"content-type": "application/json",
						"api-key": API_KEY,
					},
					body: {
						article: {
							title: "Hello World",
							body_markdown: expectedContent,
							published: true,
						},
					},
				},
				{
					status: 201,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_ARTICLE_RESPONSE,
				},
			);

			const response = await strategy.post(content, {
				images: [
					{
						alt: "Test image",
						data: imageData,
					},
				],
			});

			assert.deepStrictEqual(response, CREATE_ARTICLE_RESPONSE);
		});

		it("should successfully post an article with images without alt text", async () => {
			const content = "Hello World\n\nThis is a test post.";
			const imageData = new Uint8Array([137, 80, 78, 71]); // Example PNG header
			const base64Data = "iVBORw=="; // Example base64 of the image data

			const expectedContent =
				content +
				"\n\n" +
				`![](data:image/png;base64,${base64Data})\n\n`;

			server.post(
				{
					url: "/api/articles",
					headers: {
						"content-type": "application/json",
						"api-key": API_KEY,
					},
					body: {
						article: {
							title: "Hello World",
							body_markdown: expectedContent,
							published: true,
						},
					},
				},
				{
					status: 201,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_ARTICLE_RESPONSE,
				},
			);

			const response = await strategy.post(content, {
				images: [
					{
						data: imageData,
					},
				],
			});

			assert.deepStrictEqual(response, CREATE_ARTICLE_RESPONSE);
		});

		it("should abort when signal is triggered", async () => {
			const content = "Hello World\n\nThis is a test post.";
			const controller = new AbortController();

			server.post(
				{
					url: "/api/articles",
					headers: {
						"content-type": "application/json",
						"api-key": API_KEY,
					},
					body: {
						article: {
							title: "Hello World",
							body_markdown: content,
							published: true,
						},
					},
				},
				{
					status: 201,
					delay: 50,
					headers: {
						"content-type": "application/json",
					},
					body: CREATE_ARTICLE_RESPONSE,
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await strategy.post(content, { signal: controller.signal });
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", function () {
		let strategy;

		beforeEach(function () {
			strategy = new DevtoStrategy({ apiKey: "test-api-key" });
		});

		it("should use the url property when available", function () {
			const response = {
				id: 12345,
				url: "https://dev.to/username/article-slug-12ab",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"https://dev.to/username/article-slug-12ab",
			);
		});

		it("should use the canonical_url property when available and url is not", function () {
			const response = {
				id: 12345,
				canonical_url: "https://blog.example.com/article-original",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				"https://blog.example.com/article-original",
			);
		});

		it("should create a URL from the ID when url and canonical_url are not available", function () {
			const response = {
				id: 12345,
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(url, "https://dev.to/articles/12345");
		});

		it.skip("should throw an error when the ID is missing", function () {
			const response = {};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Article ID not found in response/);
		});

		it.skip("should throw an error when the response is null", function () {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Article ID not found in response/);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		let strategy;
		beforeEach(() => {
			strategy = new DevtoStrategy({ apiKey: "token" });
		});
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			assert.ok(
				Object.prototype.hasOwnProperty.call(
					strategy,
					"MAX_MESSAGE_LENGTH",
				),
				"MAX_MESSAGE_LENGTH property is missing",
			);
			assert.strictEqual(typeof strategy.MAX_MESSAGE_LENGTH, "number");
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;
		beforeEach(() => {
			strategy = new DevtoStrategy({ apiKey: "token" });
		});
		it("should calculate length of plain text correctly", () => {
			const msg = "Hello world!";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				msg.length,
			);
		});
		it("should count URLs as their actual length", () => {
			const msg =
				"Check this out: https://example.com/abcde and http://foo.bar";
			assert.strictEqual(
				strategy.calculateMessageLength(msg),
				[...msg].length,
			);
		});
	});
});
