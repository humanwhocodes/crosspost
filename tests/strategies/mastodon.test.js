/**
 * @fileoverview Tests for the MastodonStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { MastodonStrategy } from "../../src/strategies/mastodon.js";
import assert from "node:assert";
import { FetchMocker, MockServer } from "mentoss";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "images");

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("MastodonStrategy", () => {
	describe("constructor", () => {
		it("should throw an error if accessToken is missing", () => {
			assert.throws(
				() => new MastodonStrategy({ host: "mastodon.social" }),
				TypeError,
				"Missing Mastodon access token.",
			);
		});

		it("should throw an error if host is missing", () => {
			assert.throws(
				() => new MastodonStrategy({ accessToken: "token" }),
				TypeError,
				"Missing Mastodon host.",
			);
		});

		it("should create an instance if both accessToken and host are provided", () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			assert(instance instanceof MastodonStrategy);
		});

		it("should create an instance with correct id and name", () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			assert.strictEqual(instance.id, "mastodon");
			assert.strictEqual(instance.name, "Mastodon");
		});
	});

	describe("post", () => {
		const server = new MockServer("https://mastodon.social");
		const fetchMocker = new FetchMocker({
			servers: [server],
		});

		beforeEach(() => {
			fetchMocker.mockGlobal(fetchMocker.fetch);
		});

		afterEach(() => {
			fetchMocker.unmockGlobal();
			server.clear();
		});

		it("should throw an error if message is missing", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			await assert.rejects(instance.post(), {
				name: "Error",
				message: "Missing message to toot.",
			});
		});

		it("should make a POST request to the correct URL", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const response = { id: "12345" };

			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
						body: {
							status: message,
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: response,
				},
			);

			const result = await instance.post(message);
			assert.deepStrictEqual(result, { id: "12345" });
		});

		it("should handle fetch errors", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";

			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
						body: {
							status: message,
						},
					},
				},
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
					body: {
						error: "Unauthorized",
					},
				},
			);

			await assert.rejects(
				instance.post(message),
				/Failed to post message: 401 Unauthorized/,
			);
		});

		it("should throw a TypeError if images is not an array", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			await assert.rejects(async () => {
				await instance.post("Hello world", { images: "not an array" });
			}, /images must be an array/);
		});

		it("should throw a TypeError if image is missing data", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			await assert.rejects(async () => {
				await instance.post("Hello world", {
					images: [{ alt: "test" }],
				});
			}, /Image must have data/);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			await assert.rejects(async () => {
				await instance.post("Hello world", {
					images: [
						{
							alt: "test",
							data: "not a Uint8Array",
						},
					],
				});
			}, /Image data must be a Uint8Array/);
		});

		it("should throw an error when image data is not an image", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const imageData = new Uint8Array([1, 2, 3, 4]);

			await assert.rejects(async () => {
				await instance.post(message, {
					images: [
						{
							alt: "test image",
							data: imageData,
						},
					],
				});
			}, /Unable to determine image type/);
		});

		it("should successfully post a message with an image", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const imagePath = path.join(FIXTURES_DIR, "smiley.png");
			const imageData = await fs.readFile(imagePath);
			const mediaResponse = {
				id: "123",
				type: "image",
				url: "https://example.com/image.png",
				preview_url: "https://example.com/preview.png",
			};
			const statusResponse = { id: "12345" };

			// Mock the media upload endpoint
			server.post(
				{
					url: "/api/v1/media",
					request: {
						headers: {
							authorization: "Bearer token",
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: mediaResponse,
				},
			);

			// Mock the status creation endpoint
			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
					},
				},
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
					body: statusResponse,
				},
			);

			const result = await instance.post(message, {
				images: [
					{
						alt: "test image",
						data: new Uint8Array(imageData),
					},
				],
			});
			assert.deepStrictEqual(result, statusResponse);
		});

		it("should handle media upload errors", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const imagePath = path.join(FIXTURES_DIR, "smiley.png");
			const imageData = await fs.readFile(imagePath);

			// Mock failed media upload
			server.post(
				{
					url: "/api/v1/media",
					request: {
						headers: {
							authorization: "Bearer token",
						},
					},
				},
				{
					status: 413,
					headers: {
						"content-type": "application/json",
					},
					body: {
						error: "File is too large",
					},
				},
			);

			await assert.rejects(
				async () => {
					await instance.post(message, {
						images: [
							{
								alt: "test image",
								data: new Uint8Array(imageData),
							},
						],
					});
				},
				{
					message:
						"413 Payload Too Large: Failed to upload media: 413 Payload Too Large: File is too large",
				},
			);
		});

		it("should abort when signal is triggered", async () => {
			const options = { accessToken: "token", host: "mastodon.social" };
			const instance = new MastodonStrategy(options);
			const message = "Hello, Mastodon!";
			const controller = new AbortController();

			server.post(
				{
					url: "/api/v1/statuses",
					request: {
						headers: {
							authorization: "Bearer token",
						},
						body: {
							status: message,
						},
					},
				},
				{
					status: 200,
					delay: 50,
					headers: {
						"content-type": "application/json",
					},
					body: { id: "12345" },
				},
			);

			setTimeout(() => controller.abort(), 10);

			await assert.rejects(async () => {
				await instance.post(message, { signal: controller.signal });
			}, /AbortError/);
		});
	});

	describe("getUrlFromResponse", function () {
		let strategy;
		const testOptions = { accessToken: "token", host: "mastodon.social" };

		beforeEach(function () {
			strategy = new MastodonStrategy(testOptions);
		});

		it("should generate the correct URL from a response", function () {
			const response = {
				uri: "https://mastodon.example/users/testuser/statuses/123456789",
			};

			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(
				url,
				`https://${testOptions.host}/@testuser/123456789`,
			);
		});

		it("should throw an error when the URI is missing", function () {
			const response = {
				id: "123456789",
			};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Post URI not found in response/);
		});

		it("should throw an error when the URI has an invalid format", function () {
			const response = {
				uri: "invalid-uri",
			};

			assert.throws(() => {
				strategy.getUrlFromResponse(response);
			}, /Invalid URI format in response/);
		});

		it("should throw an error when the response is null", function () {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /Post URI not found in response/);
		});
	});
});
