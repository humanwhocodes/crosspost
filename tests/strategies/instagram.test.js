/**
 * @fileoverview Tests for the InstagramStrategy class.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Requirements
//-----------------------------------------------------------------------------

import { InstagramStrategy } from "../../src/strategies/instagram.js";
import nock from "nock";
import assert from "node:assert";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const message = "Check out this amazing post! #instagram #crosspost";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "images");

const validOptions = {
	accessToken: "valid_access_token",
	instagramAccountId: "123456789",
};

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("InstagramStrategy", () => {
	describe("constructor", () => {
		it("should throw an error when the access token is missing", () => {
			assert.throws(() => {
				new InstagramStrategy({
					instagramAccountId: "123456789",
				});
			}, /access token/i);
		});

		it("should throw an error when the Instagram account ID is missing", () => {
			assert.throws(() => {
				new InstagramStrategy({
					accessToken: "valid_access_token",
				});
			}, /account ID/i);
		});

		it("should create an instance when valid options are provided", () => {
			assert.doesNotThrow(() => {
				new InstagramStrategy(validOptions);
			});
		});

		it("should have correct id and name properties", () => {
			const strategy = new InstagramStrategy(validOptions);
			assert.strictEqual(strategy.id, "instagram");
			assert.strictEqual(strategy.name, "Instagram");
		});
	});

	describe("post", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy(validOptions);
		});

		afterEach(() => {
			nock.cleanAll();
		});

		it("should throw an Error if message is missing", async () => {
			await assert.rejects(
				async () => {
					await strategy.post("");
				},
				{
					name: "TypeError",
					message: "Missing message for Instagram post.",
				}
			);
		});

		it("should throw an Error for text-only posts", async () => {
			await assert.rejects(
				async () => {
					await strategy.post(message);
				},
				{
					name: "Error",
					message: "Instagram requires at least one image. Text-only posts are not supported.",
				}
			);
		});

		it("should throw an Error for multiple images", async () => {
			const imageBuffer = await fs.readFile(path.join(FIXTURES_DIR, "smiley.png"));
			const images = [
				{ data: new Uint8Array(imageBuffer), alt: "Test image 1" },
				{ data: new Uint8Array(imageBuffer), alt: "Test image 2" },
			];

			await assert.rejects(
				async () => {
					await strategy.post(message, { images });
				},
				{
					name: "Error",
					message: "Instagram strategy currently supports only single image posts.",
				}
			);
		});

		it("should throw an Error when image upload is not implemented", async () => {
			const imageBuffer = await fs.readFile(path.join(FIXTURES_DIR, "smiley.png"));
			const images = [{ data: new Uint8Array(imageBuffer), alt: "Test image" }];

			await assert.rejects(
				async () => {
					await strategy.post(message, { images });
				},
				{
					name: "Error",
					message: /Image upload not implemented/,
				}
			);
		});

		it("should throw a TypeError if images is not an array", async () => {
			await assert.rejects(
				async () => {
					await strategy.post(message, { images: "not an array" });
				},
				{
					name: "TypeError",
					message: "images must be an array.",
				}
			);
		});

		it("should throw a TypeError if image is missing data", async () => {
			await assert.rejects(
				async () => {
					await strategy.post(message, { images: [{ alt: "Test image" }] });
				},
				{
					name: "TypeError",
					message: "Image must have data.",
				}
			);
		});

		it("should throw a TypeError if image data is not a Uint8Array", async () => {
			await assert.rejects(
				async () => {
					await strategy.post(message, { images: [{ data: "not a Uint8Array", alt: "Test image" }] });
				},
				{
					name: "TypeError",
					message: "Image data must be a Uint8Array.",
				}
			);
		});
	});

	describe("getUrlFromResponse", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy(validOptions);
		});

		it("should generate the correct URL from a response", () => {
			const response = { id: "media_123456789" };
			const url = strategy.getUrlFromResponse(response);
			assert.strictEqual(url, "https://www.instagram.com/p/media_123456789");
		});

		it("should throw an error when the media ID is missing", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse({});
			}, /media ID not found/i);
		});

		it("should throw an error when the response is null", () => {
			assert.throws(() => {
				strategy.getUrlFromResponse(null);
			}, /media ID not found/i);
		});
	});

	describe("MAX_MESSAGE_LENGTH", () => {
		it("should have a MAX_MESSAGE_LENGTH property", () => {
			const strategy = new InstagramStrategy(validOptions);
			assert.strictEqual(strategy.MAX_MESSAGE_LENGTH, 2200);
		});
	});

	describe("calculateMessageLength", () => {
		let strategy;

		beforeEach(() => {
			strategy = new InstagramStrategy(validOptions);
		});

		it("should calculate length of plain text correctly", () => {
			const length = strategy.calculateMessageLength("Hello world!");
			assert.strictEqual(length, 12);
		});

		it("should count emojis correctly", () => {
			const length = strategy.calculateMessageLength("Hello 🌍!");
			assert.strictEqual(length, 8);
		});

		it("should count hashtags and mentions", () => {
			const length = strategy.calculateMessageLength("Hello @user #hashtag!");
			assert.strictEqual(length, 21);
		});

		it("should count line breaks", () => {
			const length = strategy.calculateMessageLength("Line 1\nLine 2\nLine 3");
			assert.strictEqual(length, 20);
		});

		it("should handle empty string", () => {
			const length = strategy.calculateMessageLength("");
			assert.strictEqual(length, 0);
		});

		it("should count URLs as their full length", () => {
			const message = "Check out https://example.com/very/long/path";
			const length = strategy.calculateMessageLength(message);
			assert.strictEqual(length, message.length);
		});
	});
});